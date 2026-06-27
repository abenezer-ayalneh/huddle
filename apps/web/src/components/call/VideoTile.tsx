'use client';

import { VideoTrack, isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { MicOff, MonitorUp, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { useMirrorLocalCamera } from './useMirrorLocalCamera';
import { useParticipantMedia } from './useParticipantMedia';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  const word = parts[0] || '';
  return word.length >= 2 ? word.slice(0, 2).toUpperCase() : word.toUpperCase() || '?';
}

// The Avatar URL is carried in the participant's token metadata (docs/adr/0016),
// alongside `role`. Absent for anonymous guests and accounts without a picture.
function getAvatarUrl(metadata?: string): string | undefined {
  if (!metadata) return undefined;
  try {
    const url = (JSON.parse(metadata) as { avatarUrl?: unknown }).avatarUrl;
    return typeof url === 'string' && url ? url : undefined;
  } catch {
    return undefined;
  }
}

export default function VideoTile({
  trackRef,
  active,
  pinned,
  onTogglePin,
  fallbackName,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  active: boolean;
  // Pin affordance — omitted (undefined) means no pin button is rendered
  // (the floating Self-view and the presentation strip pass nothing).
  pinned?: boolean;
  onTogglePin?: () => void;
  // The already-known display name, passed only by the local render sites. See
  // the label note below for why the local tile needs it.
  fallbackName?: string;
}) {
  const participant = trackRef.participant;
  const { cameraOn, micOn } = useParticipantMedia(participant);

  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const isLocal = participant.isLocal;
  const showVideo = isTrackReference(trackRef) && (isScreenShare || cameraOn);
  const mirror = useMirrorLocalCamera(trackRef);

  // The local participant connects with an empty name/identity: livekit-client
  // builds it as `new LocalParticipant('', '', …)` and only fills these in when
  // the server's JoinResponse lands a beat later. Without `fallbackName` the
  // local tile would flash a placeholder before the name resolves, so the local
  // render sites pass the already-known display name. Remote tiles arrive with
  // their name on their token and need no fallback.
  const label = participant.name || fallbackName || participant.identity || 'Participant';
  const initials = getInitials(label);

  // Avatar shown in the camera-off placeholder in place of the initials. A
  // broken/blocked image is not a Fault — it silently falls back to initials.
  // We remember which URL failed (not a bare boolean) so a tile reused for a
  // different participant re-tries the new Avatar without a reset effect.
  const avatarUrl = getAvatarUrl(participant.metadata);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | undefined>(undefined);
  const showAvatar = !!avatarUrl && failedAvatarUrl !== avatarUrl;

  return (
    <div className="group relative h-full w-full min-h-0 min-w-0">
      <div className={`cyber-clip h-full w-full transition-shadow ${active ? 'cyber-frame-active' : 'cyber-frame'}`}>
        <div className={`cyber-clip relative h-full w-full overflow-hidden bg-[oklch(0.12_0.02_280)] ${active ? 'scanlines' : ''}`}>
          {showVideo ? (
            <VideoTrack
              trackRef={trackRef}
              // Both screen shares and cameras use contain (letterboxed against
              // the dark tile) rather than cover: a screen must show its whole
              // frame, and a camera must always show the full face on every
              // viewport shape rather than cropping it (ADR-0014). The local
              // camera is mirrored — but only when front-facing; the back camera
              // shows the world un-flipped (useMirrorLocalCamera, ADR-0014).
              className={`h-full w-full object-contain ${mirror ? '-scale-x-100' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.18_0.03_300)] to-[oklch(0.13_0.02_270)]">
              <div
                className={`flex aspect-square w-[clamp(2.5rem,18%,5rem)] items-center justify-center overflow-hidden rounded-full font-display text-2xl font-semibold text-white/90 ${
                  active ? 'neon-magenta' : ''
                } bg-[oklch(0.66_0.27_350_/_0.18)] ring-1 ring-magenta/40`}
              >
                {showAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote avatar (Google CDN); next/image needs remotePatterns config and gains nothing here
                  <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailedAvatarUrl(avatarUrl)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
            </div>
          )}

          {/* Pin toggle — top-left so it clears the active-speaker HUD
              (top-right) and the name pill (bottom-left). Hidden until hover on
              pointer devices; always shown on touch (no hover to reveal it). */}
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
              className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/90 opacity-0 backdrop-blur transition hover:bg-black/75 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}

          {/* HUD readout — active speaker only. */}
          {active && (
            <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/90 text-glow-cyan">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
              live
            </div>
          )}

          {/* Name pill + status. */}
          <div className="pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 backdrop-blur">
            {!micOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-magenta" />}
            {isScreenShare && <MonitorUp className="h-3.5 w-3.5 shrink-0 text-cyan" />}
            <span className="truncate text-xs font-medium text-white/90">
              {label}
              {isLocal && !isScreenShare ? ' (You)' : ''}
              {isScreenShare ? ' — screen' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
