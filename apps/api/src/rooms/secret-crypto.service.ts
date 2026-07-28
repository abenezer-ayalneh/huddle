import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Encrypts the two durable OAuth secrets in this feature: the Google refresh
// token and an in-progress resumable upload URI. Access tokens never pass this
// boundary because they stay in memory for one worker attempt only.
@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const configured = config.get<string>('CLOUD_CREDENTIALS_ENCRYPTION_KEY');
    this.key = configured ? this.decodeKey(configured) : null;
  }

  encrypt(value: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  decrypt(payload: string): string {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new InternalServerErrorException('Stored cloud credentials are invalid');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.requireKey(), Buffer.from(ivEncoded, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Stored cloud credentials are unreadable');
    }
  }

  private requireKey(): Buffer {
    if (!this.key) throw new InternalServerErrorException('Cloud credential encryption is not configured');
    return this.key;
  }

  private decodeKey(value: string): Buffer {
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException('CLOUD_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
    return key;
  }
}
