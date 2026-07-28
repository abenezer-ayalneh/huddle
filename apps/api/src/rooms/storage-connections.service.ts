import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CloudStorageConnection } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Inject } from '@nestjs/common';
import { SecretCryptoService } from './secret-crypto.service';

export class DriveAuthorizationError extends Error {}

export interface GoogleDriveConnectionSummary {
  connected: boolean;
  status: 'connected' | 'action_required' | 'disconnected';
  providerEmail: string | null;
  connectedAt: string | null;
  backfillAvailable: boolean;
}

type TokenResponse = { access_token?: string; refresh_token?: string; error?: string; error_description?: string };

@Injectable()
export class StorageConnectionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly crypto: SecretCryptoService,
  ) {}

  async statusFor(userId: string): Promise<GoogleDriveConnectionSummary> {
    const connection = await this.prisma.cloudStorageConnection.findUnique({
      where: { userId_provider: { userId, provider: 'google_drive' } },
    });
    return this.toSummary(connection);
  }

  async beginGoogleDrive(userId: string): Promise<{ authorizationUrl: string }> {
    const clientId = this.requireGoogleClientId();
    const redirectUri = this.requireRedirectUri();
    const state = randomBytes(32).toString('base64url');
    const stored = await this.redis.set(this.oauthStateKey(state), userId, 'EX', 10 * 60, 'NX');
    if (stored !== 'OK') throw new InternalServerErrorException('Could not start Google Drive connection');
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}` };
  }

  // Called only from the browser redirect. State is atomically consumed so a
  // copied callback URL cannot replace another Host's cloud connection.
  async completeGoogleDrive(state: string, code: string): Promise<string> {
    const userId = await this.redis.getdel(this.oauthStateKey(state));
    if (!userId) throw new BadRequestException('Google Drive connection has expired or was already used');
    const tokens = await this.exchangeCode(code);
    if (!tokens.access_token) throw new BadRequestException('Google Drive did not return an access token');

    const identity = await this.googleJson<{ user?: { emailAddress?: string } }>(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      tokens.access_token,
    );
    const existing = await this.prisma.cloudStorageConnection.findUnique({
      where: { userId_provider: { userId, provider: 'google_drive' } },
    });
    const refreshToken = tokens.refresh_token ?? (existing?.encryptedRefreshToken ? this.crypto.decrypt(existing.encryptedRefreshToken) : null);
    if (!refreshToken) throw new BadRequestException('Google Drive did not grant offline access; try connecting again');

    await this.prisma.cloudStorageConnection.upsert({
      where: { userId_provider: { userId, provider: 'google_drive' } },
      create: {
        userId,
        provider: 'google_drive',
        providerEmail: identity.user?.emailAddress ?? null,
        encryptedRefreshToken: this.crypto.encrypt(refreshToken),
        driveFolderId: null,
        status: 'connected',
        backfillRequestedAt: null,
      },
      update: {
        providerEmail: identity.user?.emailAddress ?? null,
        encryptedRefreshToken: this.crypto.encrypt(refreshToken),
        driveFolderId: null,
        status: 'connected',
        backfillRequestedAt: null,
        disconnectedAt: null,
      },
    });
    return userId;
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.getConnection(userId);
    if (connection?.encryptedRefreshToken) {
      try {
        const refreshToken = this.crypto.decrypt(connection.encryptedRefreshToken);
        await fetch(`https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token: refreshToken })}`, { method: 'POST' });
      } catch {
        // Revocation is deliberately best effort; discard our token either way.
      }
    }
    if (connection) {
      await this.prisma.cloudStorageConnection.update({
        where: { id: connection.id },
        data: { status: 'disconnected', encryptedRefreshToken: null, disconnectedAt: new Date() },
      });
    }
  }

  async activeConnection(userId: string): Promise<CloudStorageConnection | null> {
    const connection = await this.getConnection(userId);
    return connection?.status === 'connected' && connection.encryptedRefreshToken ? connection : null;
  }

  async refreshAccessToken(connection: CloudStorageConnection): Promise<string> {
    if (!connection.encryptedRefreshToken) throw new DriveAuthorizationError('Google Drive connection is unavailable');
    const clientId = this.requireGoogleClientId();
    const clientSecret = this.requireGoogleClientSecret();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: this.crypto.decrypt(connection.encryptedRefreshToken),
      grant_type: 'refresh_token',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok || !json.access_token) {
      if (json.error === 'invalid_grant' || response.status === 400 || response.status === 401) {
        throw new DriveAuthorizationError(json.error_description || 'Google Drive authorization is no longer valid');
      }
      throw new Error(`Google token refresh failed (${response.status})`);
    }
    return json.access_token;
  }

  async markActionRequired(connectionId: string): Promise<void> {
    await this.prisma.cloudStorageConnection.update({ where: { id: connectionId }, data: { status: 'action_required' } });
  }

  async updateFolder(connectionId: string, driveFolderId: string): Promise<void> {
    await this.prisma.cloudStorageConnection.update({ where: { id: connectionId }, data: { driveFolderId } });
  }

  private async getConnection(userId: string): Promise<CloudStorageConnection | null> {
    return this.prisma.cloudStorageConnection.findUnique({ where: { userId_provider: { userId, provider: 'google_drive' } } });
  }

  private async exchangeCode(code: string): Promise<TokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.requireGoogleClientId(),
        client_secret: this.requireGoogleClientSecret(),
        redirect_uri: this.requireRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const json = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok) throw new BadRequestException(json.error_description || 'Google Drive authorization failed');
    return json;
  }

  private async googleJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new BadRequestException('Could not read the Google Drive account');
    return (await response.json()) as T;
  }

  private toSummary(connection: CloudStorageConnection | null): GoogleDriveConnectionSummary {
    return {
      connected: connection?.status === 'connected' && Boolean(connection.encryptedRefreshToken),
      status: (connection?.status as GoogleDriveConnectionSummary['status'] | undefined) ?? 'disconnected',
      providerEmail: connection?.providerEmail ?? null,
      connectedAt: connection?.status === 'connected' ? connection.createdAt.toISOString() : null,
      backfillAvailable: connection?.status === 'connected' && connection.backfillRequestedAt == null,
    };
  }

  private oauthStateKey(state: string): string {
    return `huddle:google-drive-oauth:${state}`;
  }

  private requireGoogleClientId(): string {
    const value = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!value) throw new InternalServerErrorException('Google Drive client ID is not configured');
    return value;
  }

  private requireGoogleClientSecret(): string {
    const value = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!value) throw new InternalServerErrorException('Google Drive client secret is not configured');
    return value;
  }

  private requireRedirectUri(): string {
    const value = this.config.get<string>('GOOGLE_DRIVE_REDIRECT_URI');
    if (!value) throw new InternalServerErrorException('GOOGLE_DRIVE_REDIRECT_URI is not configured');
    return value;
  }
}
