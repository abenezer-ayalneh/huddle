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
