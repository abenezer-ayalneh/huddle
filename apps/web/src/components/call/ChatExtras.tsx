'use client';

import { useEffect, useRef, useState } from 'react';
import { fileMessage, uploadChatFile } from './chatFiles';

const EMOJI = ['😀', '😂', '❤️', '👍', '👎', '👏', '🎉', '🙏', '🤔', '👋', '✅', '🚀'];
export default function ChatExtras({
  room,
  token,
  onSend,
  onEmoji,
}: {
  room?: string;
  token?: string;
  onSend: (message: string) => Promise<unknown>;
  onEmoji: (emoji: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  const send = async (id: string) => {
    setSending(true);
    try {
      await onSend(fileMessage(id));
      setPending(null);
      setNotice('File shared. It expires after 24 hours.');
    } catch {
      setPending(id);
      setNotice('Uploaded, but the message could not be sent. Retry sharing.');
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="border-t border-current/15 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <details>
          <summary className="cursor-pointer rounded-md px-2 py-1" aria-label="Add emoji">
            😀 Emoji
          </summary>
          <div className="flex max-w-56 flex-wrap gap-1 py-2">
            {EMOJI.map((emoji) => (
              <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => onEmoji(emoji)} className="rounded p-2 text-lg">
                {emoji}
              </button>
            ))}
          </div>
        </details>
        {room && token && (
          <>
            <input
              ref={input}
              type="file"
              className="hidden"
              aria-label="Choose chat attachment"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                const abort = new AbortController();
                controller.current = abort;
                setNotice('');
                setProgress(0);
                try {
                  const id = await uploadChatFile(room, token, file, abort.signal, setProgress);
                  setProgress(null);
                  await send(id);
                } catch (failure) {
                  setNotice(abort.signal.aborted ? 'Upload cancelled.' : failure instanceof Error ? failure.message : 'Upload failed.');
                } finally {
                  setProgress(null);
                  controller.current = null;
                }
              }}
            />
            <button
              type="button"
              disabled={progress !== null || !!pending || sending}
              onClick={() => input.current?.click()}
              className="rounded-md border border-current/25 px-2 py-1 disabled:opacity-50"
            >
              Attach file
            </button>
          </>
        )}
        {progress !== null && (
          <>
            <span role="status">Uploading {progress}%</span>
            <button type="button" onClick={() => controller.current?.abort()} className="underline">
              Cancel upload
            </button>
          </>
        )}
        {pending && (
          <button type="button" disabled={sending} onClick={() => void send(pending)} className="underline disabled:opacity-50">
            Retry sharing file
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-1">
          {notice}
        </p>
      )}
    </div>
  );
}
