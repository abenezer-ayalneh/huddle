import type Redis from 'ioredis';
import { FakeRedis } from '../redis/fake-redis';
import { StorageConnectionsService } from './storage-connections.service';

describe('StorageConnectionsService OAuth start', () => {
  const config = {
    get: (name: string) =>
      ({
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GOOGLE_DRIVE_REDIRECT_URI: 'https://api.example.com/storage-connections/google-drive/callback',
      })[name],
  };

  it('uses a one-time Redis state and only requests the narrow offline drive.file scope', async () => {
    const redis = new FakeRedis();
    const service = new StorageConnectionsService(config as never, {} as never, redis as unknown as Redis, {} as never);

    const { authorizationUrl } = await service.beginGoogleDrive('host-1');
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get('state');

    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(state).toEqual(expect.any(String));
    await expect(redis.get(`huddle:google-drive-oauth:${state}`)).resolves.toBe('host-1');
  });
});

describe('StorageConnectionsService account deletion revocation', () => {
  const config = { get: () => undefined };
  const connection = { id: 'drive-1', encryptedRefreshToken: 'encrypted-refresh-token' };
  const prisma = {
    cloudStorageConnection: {
      findUnique: jest.fn().mockResolvedValue(connection),
      update: jest.fn().mockResolvedValue(undefined),
    },
  };
  const crypto = { decrypt: jest.fn().mockReturnValue('refresh-token') };
  const service = new StorageConnectionsService(config as never, prisma as never, new FakeRedis() as unknown as Redis, crypto as never);

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    prisma.cloudStorageConnection.findUnique.mockResolvedValue(connection);
  });

  it('keeps the encrypted token so account cleanup can retry when Google is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));

    await expect(service.disconnectForAccountDeletion('user-1')).rejects.toThrow('Google token revocation returned HTTP 503');
    expect(prisma.cloudStorageConnection.update).not.toHaveBeenCalled();
  });

  it('clears Huddle access after Google confirms revocation or reports an already-invalid token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 400 }));

    await service.disconnectForAccountDeletion('user-1');

    const [update] = prisma.cloudStorageConnection.update.mock.calls[0] as unknown as [
      {
        where: { id: string };
        data: { status: string; encryptedRefreshToken: string | null; disconnectedAt: Date };
      },
    ];
    expect(update.where.id).toBe('drive-1');
    expect(update.data.status).toBe('disconnected');
    expect(update.data.encryptedRefreshToken).toBeNull();
    expect(update.data.disconnectedAt).toBeInstanceOf(Date);
  });
});
