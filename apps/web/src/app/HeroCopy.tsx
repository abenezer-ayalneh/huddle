import HuddleIcon from '@/components/HuddleIcon';

// Server-rendered marketing copy. Lives next to the lobby so search engines and
// AI crawlers see the H1, product positioning, and key features in the initial
// HTML — none of this needs interactivity, so it stays out of the client bundle.
export default function HeroCopy() {
  return (
    <div className="space-y-7 text-center lg:text-left">
      <div className="flex items-center justify-center gap-3 lg:justify-start">
        <HuddleIcon className="size-10 drop-shadow-[0_0_12px_rgba(217,70,168,0.5)]" />
        <span className="font-display text-2xl font-bold tracking-[0.3em] text-white">
          HUD<span className="text-magenta text-glow-magenta">DLE</span>
        </span>
      </div>
      <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
        Meetings,
        <br />
        <span className="text-magenta text-glow-magenta">reimagined.</span>
      </h1>
      <p className="mx-auto max-w-md text-lg text-white/65 lg:mx-0">
        Self-hosted, real-time video for teams who want control. Guests join with just a link — no account, no installs.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
        {['Self-hosted', 'Knock-to-join', 'Record & download'].map((t) => (
          <span key={t} className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-sm text-white/75 backdrop-blur">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
