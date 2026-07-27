'use client';

import { useSpeakingParticipants, useTracks, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { MonitorOff, MonitorUp, PinOff } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import FocusLayout, { trackKey } from './FocusLayout';
import SelfView, { type Corner } from './SelfView';
import VideoTile from './VideoTile';
import { isControlAgentParticipant, type RemoteControlSession } from '@/lib/controlProtocol';

export default function VideoGrid({
  iAmPresenting = false,
  onStopPresenting,
  onStageTrackChange,
  localName,
  remoteControlSession,
  isRemoteSharer = false,
  onRequestControl,
  remoteControlStatus,
  remoteControlInput,
}: {
  // When the local participant is the Presenter, they see their own shared
  // track through the protected local-only PresenterPreview below.
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
  remoteControlSession?: RemoteControlSession | null;
  isRemoteSharer?: boolean;
  onRequestControl?: (identity: string) => void;
  // Persistent room-wide Remote Control state. The layout gives this rail its
  // own row below stage content so it never covers the published desktop.
  remoteControlStatus?: ReactNode;
  remoteControlInput?: ReactNode;
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

  const screenTrack = useMemo(() => {
    const screenTracks = tracks.filter((t) => t.source === Track.Source.ScreenShare);
    if (remoteControlSession) return screenTracks.find((t) => t.participant.identity === remoteControlSession.agentIdentity) ?? null;
    return screenTracks.find((t) => !isControlAgentParticipant(t.participant)) ?? null;
  }, [remoteControlSession, tracks]);
  const cameraTracks = useMemo(() => tracks.filter((t) => t.source === Track.Source.Camera && !isControlAgentParticipant(t.participant)), [tracks]);

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
  // below — reported up for Picture-in-Picture to mirror. A normal Presenter
  // sees their live screen inside PresenterPreview; the local shared track is
  // still omitted from PiP. Remote Control keeps its static local safety surface.
  const hideOwnStage = iAmPresenting || isRemoteSharer;
  const stageTrack: TrackReferenceOrPlaceholder | null =
    remoteControlSession && !screenTrack
      ? null
      : screenTrack && !hideOwnStage
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
          isRemoteSharer ? (
            // A Remote Control Sharer never sees the agent's own desktop track.
            // Its native capture has a dedicated static safety surface; ordinary
            // browser presentations use the live, tinted PresenterPreview below.
            <RemoteControlPlaceholder />
          ) : iAmPresenting ? (
            <PresenterPreview key={trackKey(screenTrack)} trackRef={screenTrack} onStop={onStopPresenting} />
          ) : (
            <>
              <VideoTile trackRef={screenTrack} active={false} />
              {remoteControlInput}
            </>
          )
        }
        stripTracks={cameraTracks}
        activeIdentity={activeIdentity}
        localName={localName}
        onRequestControl={onRequestControl}
        statusRail={remoteControlStatus}
      />
    );
  }

  // An active agent may be between publications while the Sharer changes
  // displays. Never let the normal layout promote another participant's
  // camera or screen into the Remote Control stage during that protected gap.
  if (remoteControlSession) {
    return (
      <FocusLayout
        main={<RemoteControlSwitchingSurface />}
        stripTracks={cameraTracks}
        activeIdentity={activeIdentity}
        localName={localName}
        onRequestControl={onRequestControl}
        statusRail={remoteControlStatus}
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
        onRequestControl={onRequestControl}
        localName={localName}
        statusRail={remoteControlStatus}
      />
    );
  }

  // Alone — the local camera just fills the stage as the only tile.
  if (remoteTracks.length === 0) {
    return (
      <EqualGrid
        cameraTracks={localTrack ? [localTrack] : []}
        activeIdentity={activeIdentity}
        localName={localName}
        onRequestControl={onRequestControl}
        statusRail={remoteControlStatus}
      />
    );
  }

  // Others present — equal grid of the remotes, local camera floating.
  return (
    <>
      <EqualGrid
        cameraTracks={remoteTracks}
        activeIdentity={activeIdentity}
        onTogglePin={togglePin}
        onRequestControl={onRequestControl}
        statusRail={remoteControlStatus}
      />
      {localTrack && <SelfView trackRef={localTrack} corner={selfCorner} onCornerChange={setSelfCorner} fallbackName={localName} />}
    </>
  );
}

function EqualGrid({
  cameraTracks,
  activeIdentity,
  onTogglePin,
  onRequestControl,
  statusRail,
  localName,
}: {
  cameraTracks: ReturnType<typeof useTracks>;
  activeIdentity: string | undefined;
  onTogglePin?: (identity: string) => void;
  onRequestControl?: (identity: string) => void;
  statusRail?: ReactNode;
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
  // Portrait Equal Grid shows up to four equal rows at once. Additional
  // remote tiles remain available through the vertical scroll surface; the
  // local participant is still rendered separately as the floating Self-view.
  const portraitVisibleRows = Math.min(cameraTracks.length || 1, 4);

  return (
    <div className="absolute inset-0 flex flex-col p-3 pb-24 sm:p-6 sm:pb-28">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="portrait-equal-grid grid h-full w-full gap-3 sm:gap-4"
          style={
            {
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: '1fr',
              '--portrait-visible-rows': portraitVisibleRows,
            } as CSSProperties
          }
        >
          {cameraTracks.map((trackRef) => (
            <VideoTile
              key={trackKey(trackRef)}
              trackRef={trackRef}
              active={trackRef.participant.identity === activeIdentity && cameraTracks.length > 1}
              onTogglePin={onTogglePin && !trackRef.participant.isLocal ? () => onTogglePin(trackRef.participant.identity) : undefined}
              onRequestControl={onRequestControl && !trackRef.participant.isLocal ? () => onRequestControl(trackRef.participant.identity) : undefined}
              fallbackName={trackRef.participant.isLocal ? localName : undefined}
            />
          ))}
        </div>
      </div>
      {statusRail && <div className="mt-3 shrink-0">{statusRail}</div>}
    </div>
  );
}

// The Remote Control Sharer sees this static confirmation surface instead of
// the native agent's desktop track. Unlike a normal browser presentation, that
// capture remains hidden from the Sharer (see PresenterPreview below).
function RemoteControlPlaceholder() {
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
            <p className="font-display text-lg font-semibold text-white/90">Your entire selected display is visible</p>
            <p className="text-sm text-white/55">
              Remote Control keeps the physical display — including the Control Agent window — on the main stage. Everyone in this room can see it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoteControlSwitchingSurface() {
  return (
    <div
      aria-live="polite"
      aria-label="Switching display"
      className="pointer-events-none relative flex h-full w-full items-center justify-center overflow-hidden bg-[oklch(0.08_0.02_230)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,oklch(0.22_0.06_230_/_0.55),transparent_62%)]" />
      <div className="relative flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <div className="neon-cyan flex aspect-square w-14 items-center justify-center rounded-full bg-cyan/10 ring-1 ring-cyan/35">
          <MonitorUp className="h-6 w-6 animate-pulse text-cyan" />
        </div>
        <p className="font-display text-xl font-semibold text-white/90">Switching display</p>
        <p className="text-sm text-white/60">
          The desktop is temporarily hidden while the Sharer changes displays. Control is paused until the new display is live.
        </p>
      </div>
    </div>
  );
}

// The normal Presenter sees the live browser screen they are publishing. The
// default tint makes a recursively captured call much less distracting, but it
// deliberately remains a live preview: the Presenter can reveal it on demand.
// This state is local to the component and resets when the screen track ends.
function PresenterPreview({ trackRef, onStop }: { trackRef: TrackReferenceOrPlaceholder; onStop?: () => void }) {
  const [isRevealed, setIsRevealed] = useState(false);

  const stopControl = onStop && (
    <button
      type="button"
      onClick={onStop}
      className="neon-magenta inline-flex items-center gap-2 rounded-full border border-magenta/70 bg-magenta/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-magenta/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta/80"
    >
      <MonitorOff className="h-4 w-4" />
      Stop presenting
    </button>
  );

  return (
    <div className="relative h-full w-full">
      <VideoTile trackRef={trackRef} active={false} />
      {isRevealed ? (
        <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsRevealed(false)}
            className="neon-cyan inline-flex items-center gap-2 rounded-full border border-cyan/70 bg-[oklch(0.16_0.04_240_/_0.78)] px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/80"
          >
            Hide my screen
          </button>
          {stopControl}
        </div>
      ) : (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[oklch(0.13_0.025_280_/_0.76)] p-6 backdrop-blur-[1px]">
          <div className="flex max-w-md flex-col items-center text-center">
            <p className="font-display text-xl font-semibold text-white sm:text-2xl">You are presenting</p>
            <p className="mt-2 text-sm font-medium text-white/80">This is here to avoid infinite mirroring</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsRevealed(true)}
                className="neon-cyan inline-flex items-center gap-2 rounded-full border border-cyan/70 bg-cyan/10 px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/80"
              >
                Show my screen anyway
              </button>
              {stopControl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
