'use client';

import { VideoTrack, isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { MicOff, MonitorUp } from 'lucide-react';
import { useParticipantMedia } from './useParticipantMedia';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  const word = parts[0] || '';
  return word.length >= 2 ? word.slice(0, 2).toUpperCase() : word.toUpperCase() || '?';
}

export default function VideoTile({ trackRef, active }: { trackRef: TrackReferenceOrPlaceholder; active: boolean }) {
  const participant = trackRef.participant;
  const { cameraOn, micOn } = useParticipantMedia(participant);

  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const isLocal = participant.isLocal;
  const showVideo = isTrackReference(trackRef) && (isScreenShare || cameraOn);

  const label = participant.name || participant.identity || 'Guest';
  const initials = getInitials(label);

  return (
    <div className="relative h-full w-full min-h-0 min-w-0">
      <div className={`cyber-clip h-full w-full transition-shadow ${active ? 'cyber-frame-active' : 'cyber-frame'}`}>
        <div className={`cyber-clip relative h-full w-full overflow-hidden bg-[oklch(0.12_0.02_280)] ${active ? 'scanlines' : ''}`}>
          {showVideo ? (
            <VideoTrack
              trackRef={trackRef}
              // Screen shares must show the whole frame — contain (letterboxed
              // against the dark tile) rather than cover, which would crop it.
              // Cameras still cover so faces fill the tile; only the local
              // camera is mirrored.
              className={`h-full w-full ${isScreenShare ? 'object-contain' : 'object-cover'} ${isLocal && !isScreenShare ? '-scale-x-100' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[oklch(0.18_0.03_300)] to-[oklch(0.13_0.02_270)]">
              <div
                className={`flex aspect-square w-[clamp(2.5rem,18%,5rem)] items-center justify-center rounded-full font-display text-2xl font-semibold text-white/90 ${
                  active ? 'neon-magenta' : ''
                } bg-[oklch(0.66_0.27_350_/_0.18)] ring-1 ring-magenta/40`}
              >
                {initials}
              </div>
            </div>
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
