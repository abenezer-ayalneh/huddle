import { Injectable } from '@nestjs/common';
import type { CloudStorageConnection, Recording } from '@prisma/client';
import type { Readable } from 'node:stream';
import { StorageService } from './storage.service';
import { StorageConnectionsService } from './storage-connections.service';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_CHUNK_BYTES = 8 * 1024 * 1024;

export class DriveApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: string,
  ) {
    super(`Google Drive request failed (${status}${reason ? `: ${reason}` : ''})`);
  }
}

type DriveFile = { id?: string; name?: string; size?: string; trashed?: boolean; webViewLink?: string; files?: DriveFile[] };

@Injectable()
export class GoogleDriveService {
  constructor(
    private readonly connections: StorageConnectionsService,
    private readonly storage: StorageService,
  ) {}

  async ensureFolder(connection: CloudStorageConnection, accessToken: string): Promise<{ id: string; connectionChanged: boolean }> {
    if (connection.driveFolderId) {
      try {
        const current = await this.request<DriveFile>(`${DRIVE_FILES_URL}/${encodeURIComponent(connection.driveFolderId)}?fields=id,trashed`, accessToken);
        if (current.id && !current.trashed) return { id: current.id, connectionChanged: false };
      } catch (error) {
        if (!(error instanceof DriveApiError) || (error.status !== 404 && error.status !== 403)) throw error;
      }
    }
    const found = await this.request<DriveFile>(
      `${DRIVE_FILES_URL}?${new URLSearchParams({
        q: "name = 'Huddle Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        spaces: 'drive',
        pageSize: '1',
        fields: 'files(id,name,trashed)',
      })}`,
      accessToken,
    );
    const existing = found.files?.[0];
    if (existing?.id) {
      await this.connections.updateFolder(connection.id, existing.id);
      return { id: existing.id, connectionChanged: true };
    }
    const created = await this.request<DriveFile>(DRIVE_FILES_URL, accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Huddle Recordings', mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!created.id) throw new Error('Google Drive did not create the Huddle Recordings folder');
    await this.connections.updateFolder(connection.id, created.id);
    return { id: created.id, connectionChanged: true };
  }

  // App properties make delivery idempotent across a worker restart after
  // Google has accepted the final chunk but before Huddle recorded completion.
  async findVerifiedExisting(recording: Recording, accessToken: string): Promise<DriveFile | null> {
    const escaped = recording.id.replace(/'/g, "\\'");
    const found = await this.request<DriveFile>(
      `${DRIVE_FILES_URL}?${new URLSearchParams({
        q: `appProperties has { key='huddleRecordingId' and value='${escaped}' } and trashed = false`,
        spaces: 'drive',
        pageSize: '100',
        fields: 'files(id,size,trashed,webViewLink)',
      })}`,
      accessToken,
    );
    return found.files?.find((file) => file.id && this.isExact(recording, file)) ?? null;
  }

  async upload(params: {
    recording: Recording;
    folderId: string;
    accessToken: string;
    sessionUrl: string | null;
    offset: number;
    onSession: (url: string | null, offset: number) => Promise<void>;
    heartbeat: () => Promise<void>;
  }): Promise<DriveFile> {
    const size = Number(params.recording.sizeBytes);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('Recording size is unavailable for Drive verification');
    let sessionUrl = params.sessionUrl;
    let offset = params.offset;
    if (!sessionUrl) {
      const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id,size,trashed,webViewLink`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': 'video/mp4',
          'x-upload-content-length': String(size),
        },
        body: JSON.stringify({
          name: params.recording.objectKey.split('/').pop() || 'recording.mp4',
          mimeType: 'video/mp4',
          parents: [params.folderId],
          appProperties: { huddleRecordingId: params.recording.id },
        }),
      });
      if (!response.ok) throw await this.apiError(response);
      sessionUrl = response.headers.get('location');
      if (!sessionUrl) throw new Error('Google Drive did not return a resumable upload session');
      offset = 0;
      await params.onSession(sessionUrl, offset);
    }

    while (offset < size) {
      await params.heartbeat();
      const end = Math.min(offset + DRIVE_CHUNK_BYTES, size) - 1;
      const { body } = await this.storage.getObjectRange(params.recording.objectKey, offset, end);
      const chunk = await this.read(body);
      if (chunk.length !== end - offset + 1) throw new Error('Object storage returned an incomplete recording range');
      const response = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          'content-length': String(chunk.length),
          'content-type': 'video/mp4',
          'content-range': `bytes ${offset}-${end}/${size}`,
        },
        body: new Uint8Array(chunk),
      });
      if (response.status === 308) {
        const range = response.headers.get('range');
        const last = range?.match(/-(\d+)$/)?.[1];
        offset = last ? Number(last) + 1 : end + 1;
        await params.onSession(sessionUrl, offset);
        continue;
      }
      if (response.status === 404 || response.status === 410) {
        // Session expired. Clearing state lets a later job restart safely; the
        // app-property lookup on the next attempt prevents duplicate files.
        await params.onSession(null, 0);
        throw new DriveApiError(response.status, 'resumable session expired');
      }
      if (!response.ok) throw await this.apiError(response);
      const file = (await response.json()) as DriveFile;
      if (!file.id || !this.isExact(params.recording, file)) throw new Error('Google Drive did not verify the completed recording size');
      await params.onSession(null, size);
      return file;
    }
    throw new Error('Google Drive upload ended without a file result');
  }

  async verify(recording: Recording, fileId: string, accessToken: string): Promise<DriveFile> {
    const file = await this.request<DriveFile>(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,size,trashed,webViewLink`, accessToken);
    if (!file.id || !this.isExact(recording, file)) throw new Error('Google Drive delivery verification failed');
    return file;
  }

  async shareReader(fileId: string, email: string, accessToken: string): Promise<string | null> {
    const permission = await this.request<{ id?: string }>(
      `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true&fields=id`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email }),
      },
    );
    return permission.id ?? null;
  }

  private isExact(recording: Recording, file: DriveFile): boolean {
    return file.trashed !== true && file.size === String(recording.sizeBytes);
  }

  private async request<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${accessToken}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
    });
    if (!response.ok) throw await this.apiError(response);
    return (await response.json()) as T;
  }

  private async apiError(response: Response): Promise<DriveApiError> {
    const json = (await response.json().catch(() => ({}))) as { error?: { errors?: Array<{ reason?: string }>; message?: string } };
    return new DriveApiError(response.status, json.error?.errors?.[0]?.reason ?? json.error?.message);
  }

  private async read(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const value of stream) {
      const chunk: unknown = value;
      if (Buffer.isBuffer(chunk)) {
        chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        throw new Error('Object storage returned an invalid recording range');
      }
    }
    return Buffer.concat(chunks);
  }
}
