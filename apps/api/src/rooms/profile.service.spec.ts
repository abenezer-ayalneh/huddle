import sharp from 'sharp';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const livekit = {
    listActiveRooms: jest.fn().mockResolvedValue([{ name: 'room-1' }]),
    syncAccountProfile: jest.fn().mockResolvedValue(undefined),
  };
  const state = { updatePendingKnocksForUser: jest.fn().mockResolvedValue(undefined) };
  const storage = {
    publicApiUrl: 'https://api.example.test',
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ProfileService(prisma as never, livekit as never, state as never, storage as never);

  beforeEach(() => jest.clearAllMocks());

  it('trims and persists names, then refreshes active participants and waiting-room entries', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Ada Lovelace', image: null });

    await expect(service.updateName('user-1', '  Ada Lovelace  ')).resolves.toEqual({ id: 'user-1', name: 'Ada Lovelace', image: null });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Ada Lovelace' } }));
    expect(state.updatePendingKnocksForUser).toHaveBeenCalledWith('room-1', 'user-1', 'Ada Lovelace', null);
    expect(livekit.syncAccountProfile).toHaveBeenCalledWith('user-1', 'Ada Lovelace', null);
  });

  it('decodes accepted image bytes and stores only a resized WebP at an opaque key', async () => {
    const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#b03060' } })
      .png()
      .toBuffer();
    prisma.user.findUnique.mockResolvedValue({ image: null });
    const avatarUrl = 'https://api.example.test/profile/avatar/9ddf33c8-acde-4c58-b963-4dc22d6fd42b.webp';
    prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Ada', image: avatarUrl });

    const result = await service.uploadAvatar('user-1', { buffer, size: buffer.byteLength });

    expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/^huddle-avatars\/[a-f0-9-]+\.webp$/), expect.any(Buffer), 'image/webp');
    expect(result.image).toBe(avatarUrl);
  });

  it('rejects mislabeled or unsupported image content before storage', async () => {
    await expect(service.uploadAvatar('user-1', { buffer: Buffer.from('not an image'), size: 12 })).rejects.toThrow('Choose a valid JPEG, PNG, or WebP image');
    await expect(service.uploadAvatar('user-1', { buffer: Buffer.alloc(1), size: 5 * 1024 * 1024 + 1 })).rejects.toThrow('no larger than 5 MiB');
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('removes the previously stored Huddle avatar and publishes the initials fallback', async () => {
    const previousImage = 'https://api.example.test/profile/avatar/9ddf33c8-acde-4c58-b963-4dc22d6fd42b.webp';
    prisma.user.findUnique.mockResolvedValue({ image: previousImage });
    prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Ada', image: null });

    await expect(service.removeAvatar('user-1')).resolves.toEqual({ image: null });

    expect(storage.deleteObject).toHaveBeenCalledWith('huddle-avatars/9ddf33c8-acde-4c58-b963-4dc22d6fd42b.webp');
    expect(livekit.syncAccountProfile).toHaveBeenCalledWith('user-1', 'Ada', null);
  });

  it('keeps a saved profile change and retries temporary live synchronization failures', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Ada', image: null });
    livekit.syncAccountProfile.mockRejectedValueOnce(new Error('temporary LiveKit outage')).mockRejectedValueOnce(new Error('still offline'));

    await expect(service.updateName('user-1', 'Ada')).resolves.toMatchObject({ name: 'Ada' });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(livekit.syncAccountProfile).toHaveBeenCalledTimes(3);
  });
});
