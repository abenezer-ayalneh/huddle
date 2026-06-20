'use client';

// The room-wide Recording Indicator (docs/adr/0011): shown to every participant
// whenever a recording is active, regardless of who started it. Its source of
// truth is the room metadata `recording` flag (see useRecording), so it appears
// and clears for everyone at once. Purpose is consent.
export default function RecordingIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-red-500/40 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      Recording
    </div>
  );
}
