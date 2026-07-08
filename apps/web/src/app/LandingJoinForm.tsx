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
      return (
        trimmed
          .replace(/^\/+|\/+$/g, '')
          .split('/')
          .filter(Boolean)
          .at(-1) ?? ''
      );
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
    <form
      onSubmit={submit}
      className="rounded-lg border border-cyan/[0.18] bg-background/80 p-4 shadow-[0_18px_60px_oklch(0.03_0.01_280/0.42),inset_0_1px_0_oklch(1_0_0/0.06)]"
    >
      <div className="mb-3 space-y-1">
        <label htmlFor="landing-room" className="block font-display text-base font-semibold text-white">
          Room code or meeting link
        </label>
        <p id="landing-room-help" className="text-sm leading-5 text-white/[0.56]">
          Paste a room code or full Huddle URL.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/[0.15] bg-white/[0.055] px-3 py-2.5 focus-within:border-cyan/70 focus-within:ring-2 focus-within:ring-cyan/25">
          <Hash className="size-4 shrink-0 text-cyan" strokeWidth={1.8} />
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
            placeholder="team-checkin"
            className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/[0.42]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-w-32 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-magenta px-4 py-2.5 font-display font-semibold text-background transition-all hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Join room
          <ArrowRight className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      {error && <p className="mt-2 px-1 text-sm text-magenta">{error}</p>}
    </form>
  );
}
