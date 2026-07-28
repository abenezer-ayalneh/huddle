import { InternalServerErrorException } from '@nestjs/common';
import { SecretCryptoService } from './secret-crypto.service';

describe('SecretCryptoService', () => {
  const config = (key?: string) => ({ get: (name: string) => (name === 'CLOUD_CREDENTIALS_ENCRYPTION_KEY' ? key : undefined) }) as never;

  it('round-trips a durable OAuth secret without returning its plaintext in storage', () => {
    const service = new SecretCryptoService(config(Buffer.alloc(32, 7).toString('base64')));
    const encrypted = service.encrypt('refresh-token-secret');
    expect(encrypted).not.toContain('refresh-token-secret');
    expect(service.decrypt(encrypted)).toBe('refresh-token-secret');
  });

  it('rejects missing or malformed encryption configuration', () => {
    expect(() => new SecretCryptoService(config('short'))).toThrow(InternalServerErrorException);
    const service = new SecretCryptoService(config());
    expect(() => service.encrypt('secret')).toThrow(InternalServerErrorException);
  });
});
