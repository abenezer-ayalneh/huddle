'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Hash } from 'lucide-react';
import { useState } from 'react';

export default function LandingJoinForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function roomFromInput(input: string): string {
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
    <form onSubmit={submit} className="rounded-lg border border-white/10 bg-background/70 p-3 shadow-[0_18px_60px_oklch(0_0_0/0.35)]">
      <label htmlFor="landing-room" className="sr-only">
        Room code or meeting link
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-cyan/60 focus-within:ring-2 focus-within:ring-cyan/25">
          <Hash className="size-4 shrink-0 text-cyan" />
          <input
            id="landing-room"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Room code or meeting link"
            className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/38"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan px-4 py-2.5 font-display font-semibold text-black transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60"
        >
          Join
          <ArrowRight className="size-4" />
        </button>
      </div>
      {error && <p className="mt-2 px-1 text-sm text-magenta">{error}</p>}
    </form>
  );
}
