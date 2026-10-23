'use client';

import { useEffect, useState } from 'react';
import { chatDownloadUrl, chatFileRequest, fileMessageId, type ChatFileInfo } from './chatFiles';

export default function ChatFileMessage({ message, room, token, sender }: { message: string; room?: string; token?: string; sender?: string }) {
  const id = fileMessageId(message);
  const [info, setInfo] = useState<ChatFileInfo | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id || !room || !token) return;
    const controller = new AbortController();
    void chatFileRequest<ChatFileInfo>(room, token, `/${id}`, { signal: controller.signal })
      .then((file) => {
        if (sender && file.identity !== sender) {
          setError('File sender could not be verified.');
          return;
        }
        setInfo(file);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'File unavailable');
      });
    return () => controller.abort();
  }, [id, room, token, sender]);
  if (!id) return <>{message}</>;
  if (!room || !token) return <>File attachment — open the full call to download.</>;
  return (
    <span className="flex flex-col gap-1">
      {info ? (
        <button
          type="button"
          className="break-all text-left underline"
          onClick={async () => {
            try {
              setError('');
              const fresh = await chatFileRequest<ChatFileInfo>(room, token, `/${id}`);
              const anchor = document.createElement('a');
              anchor.href = chatDownloadUrl(room, fresh);
              anchor.target = '_blank';
              anchor.rel = 'noopener noreferrer';
              anchor.click();
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'File unavailable');
            }
          }}
        >
          Download {info.name} ({new Intl.NumberFormat().format(info.size)} bytes)
        </button>
      ) : (
        !error && 'Loading attachment…'
      )}
      {info && <small>Expires {new Date(info.expiresAt).toLocaleString()}</small>}
      {error && <small role="status">{error}</small>}
    </span>
  );
}
