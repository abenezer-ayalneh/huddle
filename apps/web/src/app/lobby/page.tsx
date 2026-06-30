import type { Metadata } from 'next';
import HeroCopy from '../HeroCopy';
import LobbyAuthCard from '../LobbyAuthCard';

export const metadata: Metadata = {
  title: 'Lobby',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function LobbyPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Ambient neon wash behind the auth/dashboard shell. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-drift absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-magenta/20 blur-[120px]" />
        <div className="animate-drift absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan/15 blur-[120px] [animation-delay:5s]" />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <HeroCopy />
        <div className="glass-strong w-full max-w-md justify-self-center rounded-2xl p-8 shadow-[0_8px_60px_oklch(0_0_0/0.5)] lg:justify-self-end">
          <LobbyAuthCard />
        </div>
      </div>
    </main>
  );
}
