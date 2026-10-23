'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Smile } from 'lucide-react';
import { fileMessage, uploadChatFile } from './chatFiles';

export default function ChatExtras({
  room,
  token,
  onSend,
  onFocusMessage,
}: {
  room?: string;
  token?: string;
  onSend: (message: string) => Promise<unknown>;
  onFocusMessage: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [emojiHint, setEmojiHint] = useState('');
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
        <button
          type="button"
          aria-label="Add emoji"
          title="Use system emoji picker"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-current/25 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => {
            onFocusMessage();
            const platform = navigator.userAgent;
            setEmojiHint(
              /iPhone|iPad|iPod|Android/i.test(platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
                ? 'Use the emoji key on your keyboard.'
                : /Mac/i.test(platform)
                  ? 'Press Control + Command + Space to open your emoji picker.'
                  : /Windows/i.test(platform)
                    ? 'Press Windows + . to open your emoji picker.'
                    : 'Use your system’s emoji picker or keyboard to add emoji.',
            );
          }}
        >
          <Smile aria-hidden="true" className="h-4 w-4" />
        </button>
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
              aria-label="Attach file"
              title="Attach file"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-current/25 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              <Paperclip aria-hidden="true" className="h-4 w-4" />
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
      {emojiHint && (
        <p role="status" className="mt-1">
          {emojiHint}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-1">
          {notice}
        </p>
      )}
    </div>
  );
}
