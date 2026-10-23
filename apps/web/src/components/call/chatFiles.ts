import { API_URL } from '@/lib/api';

export const fileMessage = (id: string) => `huddle-file:${id}`;
export const fileMessageId = (message: string) => /^huddle-file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(message)?.[1] ?? null;
export type ChatFileInfo = { id: string; name: string; size: number; identity: string; expiresAt: number; downloadToken: string };

export async function chatFileRequest<T>(room: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-participant-token', token);
  if (typeof init.body === 'string') headers.set('content-type', 'application/json');
  const response = await fetch(`${API_URL}/rooms/${encodeURIComponent(room)}/chat-files${path}`, { ...init, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.message === 'string' ? error.message : 'Chat file request failed. Try again.');
  }
  return response.json();
}

export async function uploadChatFile(room: string, token: string, file: File, signal: AbortSignal, progress: (percent: number) => void) {
  const upload = await chatFileRequest<{ id: string; partSize: number }>(room, token, '', {
    method: 'POST',
    body: JSON.stringify({ name: file.name, size: file.size }),
    signal,
  });
  try {
    for (let offset = 0, part = 1; offset < file.size; offset += upload.partSize, part++) {
      await chatFileRequest(room, token, `/${upload.id}/parts/${part}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: file.slice(offset, offset + upload.partSize),
        signal,
      });
      progress(Math.round((Math.min(offset + upload.partSize, file.size) / file.size) * 100));
    }
    await chatFileRequest(room, token, `/${upload.id}/complete`, { method: 'POST', signal });
    return upload.id;
  } catch (error) {
    await chatFileRequest(room, token, `/${upload.id}`, { method: 'DELETE' }).catch(() => {});
    throw error;
  }
}

export function chatDownloadUrl(room: string, file: ChatFileInfo) {
  return `${API_URL}/rooms/${encodeURIComponent(room)}/chat-files/${file.id}/download?token=${encodeURIComponent(file.downloadToken)}`;
}
