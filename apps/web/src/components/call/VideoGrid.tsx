'use client';

import { useSpeakingParticipants, useTracks, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { MonitorOff, MonitorUp, PinOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FocusLayout, { trackKey } from './FocusLayout';
import SelfView, { type Corner } from './SelfView';
import VideoTile from './VideoTile';

export default function VideoGrid({
  iAmPresenting = false,
  onStopPresenting,
  onStageTrackChange,
  localName,
}: {
  // When the local participant is the Presenter, we must never render their own
  // presented track back to them — see PresenterPlaceholder below.
  iAmPresenting?: boolean;
  onStopPresenting?: () => void;
  // Reports the feed that owns the main stage so it can be mirrored into
  // Picture-in-Picture. Same precedence the layout below uses: presented screen
  // → Pin → Active Speaker → a representative remote → the local camera.
  onStageTrackChange?: (trackRef: TrackReferenceOrPlaceholder | null) => void;
  // The local participant's already-known display name, threaded down to its
  // tile so it never flashes a placeholder before LiveKit populates the name
  // (see VideoTile's `fallbackName`). Used wherever the local tile renders.
  localName?: string;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const speaking = useSpeakingParticipants();
  const activeIdentity = speaking[0]?.identity;

  const screenTrack = useMemo(() => tracks.find((t) => t.source === Track.Source.ScreenShare) ?? null, [tracks]);
  const cameraTracks = useMemo(() => tracks.filter((t) => t.source === Track.Source.Camera), [tracks]);

  // The local camera leaves the grid: with others present it floats as the
  // Self-view; the rest are the remote tiles that fill the grid.
  const localTrack = useMemo(() => cameraTracks.find((t) => t.participant.isLocal) ?? null, [cameraTracks]);
  const remoteTracks = useMemo(() => cameraTracks.filter((t) => !t.participant.isLocal), [cameraTracks]);

  // Local view-state — never synced, never lifted. Lives here so it survives a
  // presentation starting and stopping (this component stays mounted).
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);
  const [selfCorner, setSelfCorner] = useState<Corner>('bl');

  const pinnedTrack = remoteTracks.find((t) => t.participant.identity === pinnedIdentity) ?? null;
  // The pinned participant left — drop the stale pin at render time (the same
  // pattern CallView uses for its launchCode / unread counters).
  if (pinnedIdentity !== null && !pinnedTrack) {
    setPinnedIdentity(null);
  }

  const togglePin = (identity: string) => setPinnedIdentity((cur) => (cur === identity ? null : identity));

  // The feed that owns the main stage, by the same precedence the layout uses
  // below — reported up for Picture-in-Picture to mirror. The Presenter's own
  // screen is excluded (they never see it; see PresenterPlaceholder).
  const stageTrack: TrackReferenceOrPlaceholder | null =
    screenTrack && !iAmPresenting
      ? screenTrack
      : pinnedTrack
        ? pinnedTrack
        : (remoteTracks.find((t) => t.participant.identity === activeIdentity) ?? remoteTracks[0] ?? localTrack ?? null);
  // Report only when the chosen feed actually changes (its key), not on every
  // render. The effect closes over the `stageTrack` from that render, which is
  // the correct value for the new key.
  const stageKey = stageTrack ? trackKey(stageTrack) : null;
  useEffect(() => {
    onStageTrackChange?.(stageTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by stageKey; onStageTrackChange is a stable setter
  }, [stageKey]);

  // A presentation owns the stage — it preempts the Pin, which is restored when
  // the share ends.
  if (screenTrack) {
    return (
      <FocusLayout
        main={
          iAmPresenting ? (
            // The Presenter is never shown their own live feed. Rendering it
            // would be captured and re-broadcast, producing the infinite-mirror
            // (Droste) tunnel when the shared surface contains the call. A
            // *static* card breaks the recursion in the captured stream — a
            // blurred *live* feed would not. See CONTEXT.md "Presenter
            // Placeholder".
            <PresenterPlaceholder onStop={onStopPresenting} />
          ) : (
            <VideoTile trackRef={screenTrack} active={false} />
          )
        }
        stripTracks={cameraTracks}
        activeIdentity={activeIdentity}
        localName={localName}
      />
    );
  }

  // A pinned tile focuses the same one-big-plus-strip shape a presentation uses.
  // Strip = everyone but the pinned participant: the other remotes plus the
  // local self-view, docked rather than floating.
  if (pinnedTrack) {
    const stripTracks = [...remoteTracks.filter((t) => t !== pinnedTrack), ...(localTrack ? [localTrack] : [])];
    return (
      <FocusLayout
        main={
          <>
            <VideoTile trackRef={pinnedTrack} active={pinnedTrack.participant.identity === activeIdentity} />
            <button
              type="button"
              onClick={() => setPinnedIdentity(null)}
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
            >
              <PinOff className="h-3.5 w-3.5" />
              Unpin
            </button>
          </>
        }
        stripTracks={stripTracks}
        activeIdentity={activeIdentity}
        onTogglePin={togglePin}
        localName={localName}
      />
    );
  }

  // Alone — the local camera just fills the stage as the only tile.
  if (remoteTracks.length === 0) {
    return <EqualGrid cameraTracks={localTrack ? [localTrack] : []} activeIdentity={activeIdentity} localName={localName} />;
  }

  // Others present — equal grid of the remotes, local camera floating.
  return (
    <>
      <EqualGrid cameraTracks={remoteTracks} activeIdentity={activeIdentity} onTogglePin={togglePin} />
      {localTrack && <SelfView trackRef={localTrack} corner={selfCorner} onCornerChange={setSelfCorner} fallbackName={localName} />}
    </>
  );
}

function EqualGrid({
  cameraTracks,
  activeIdentity,
  onTogglePin,
  localName,
}: {
  cameraTracks: ReturnType<typeof useTracks>;
  activeIdentity: string | undefined;
  onTogglePin?: (identity: string) => void;
  // The local participant's known name, applied only to its own tile.
  localName?: string;
}) {
  const cols = useMemo(() => {
    const n = cameraTracks.length || 1;
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
  }, [cameraTracks.length]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 pb-24 sm:p-6 sm:pb-28">
      <div
        className="grid h-full w-full gap-3 sm:gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: '1fr',
        }}
      >
        {cameraTracks.map((trackRef) => (
          <VideoTile
            key={trackKey(trackRef)}
            trackRef={trackRef}
            active={trackRef.participant.identity === activeIdentity && cameraTracks.length > 1}
            onTogglePin={onTogglePin && !trackRef.participant.isLocal ? () => onTogglePin(trackRef.participant.identity) : undefined}
            fallbackName={trackRef.participant.isLocal ? localName : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// What the Presenter sees in place of their own presented content: a static,
// frosted-glass card — never a live <VideoTrack>. The backdrop is purely
// decorative (fixed gradient + blurred neon blobs), so the screen capture of
// this region is a constant image and the mirror recursion never forms.
function PresenterPlaceholder({ onStop }: { onStop?: () => void }) {
  return (
    <div className="cyber-clip relative h-full w-full overflow-hidden bg-[oklch(0.12_0.02_280)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.2_0.05_320)] to-[oklch(0.13_0.03_265)]" />
      <div className="pointer-events-none absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-magenta/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-1/4 h-72 w-72 rounded-full bg-cyan/15 blur-3xl" />

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass-strong flex max-w-sm flex-col items-center gap-4 rounded-2xl px-8 py-7 text-center">
          <div className="neon-cyan flex aspect-square w-16 items-center justify-center rounded-full bg-cyan/15 ring-1 ring-cyan/40">
            <MonitorUp className="h-7 w-7 text-cyan" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-lg font-semibold text-white/90">You&apos;re presenting to everyone</p>
            <p className="text-sm text-white/55">Your screen is live for the room. We hide it here so you don&apos;t see an endless mirror.</p>
          </div>
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="neon-magenta mt-1 inline-flex items-center gap-2 rounded-full bg-magenta px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/60"
            >
              <MonitorOff className="h-4 w-4" />
              Stop presenting
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
