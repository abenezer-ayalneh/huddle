'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Hash } from 'lucide-react';
import { useState } from 'react';

export function roomFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const roomSegment = url.pathname.split('/').filter(Boolean).at(-1);
    return roomSegment ?? '';
  } catch {
    return trimmed.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).at(-1) ?? '';
  }
}

export default function LandingJoinForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const room = roomFromInput(value);
    if (!room) {
      setError('Enter a room code or meeting link.');
      return;
    }
    setError(null);
    router.push(`/rooms/${encodeURIComponent(room)}`);
  }

  return (
    <form onSubmit={submit} className="landing-join-form">
      <div className="landing-join-form-heading">
        <label htmlFor="landing-room" className="landing-field-label">
          Room code or meeting link
        </label>
        <p id="landing-room-help">Paste a code like <code>abc-defg-hij</code> or a full Huddle URL.</p>
      </div>
      <div className="landing-join-row">
        <div className="landing-input-wrap">
          <Hash className="size-4 shrink-0" aria-hidden="true" />
          <input
            id="landing-room"
            type="text"
            autoComplete="off"
            aria-describedby="landing-room-help"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="abc-defg-hij"
            className="landing-room-input"
          />
        </div>
        <button type="submit" className="landing-primary-button landing-join-button">
          Join room
          <ArrowRight className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      {error && <p className="landing-form-error" role="alert">{error}</p>}
    </form>
  );
}
