'use client';

import { type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import type { ReactNode } from 'react';
import VideoTile from './VideoTile';

// One stable React key per track reference. Shared by every layout so a given
// participant's tile keeps its identity as the layout changes around it.
export function trackKey(trackRef: TrackReferenceOrPlaceholder) {
  return `${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication?.trackSid ?? 'placeholder'}`;
}

// The one-big-plus-strip shape: a focused main area with a strip of participant
// thumbnails alongside (a horizontal filmstrip on mobile, a right column on
// desktop). Used both when someone is presenting and when a tile is pinned.
export default function FocusLayout({
  main,
  stripTracks,
  activeIdentity,
  onTogglePin,
  onRequestControl,
  localName,
  statusRail,
}: {
  main: ReactNode;
  stripTracks: TrackReferenceOrPlaceholder[];
  activeIdentity: string | undefined;
  // When provided, strip tiles (except the local self-view) get a pin button.
  // The presentation case omits it — a presentation owns the stage and a pin
  // would have nothing to do.
  onTogglePin?: (identity: string) => void;
  onRequestControl?: (identity: string) => void;
  // The local participant's known name, applied only to its docked self-view
  // tile in the strip (see VideoTile's `fallbackName`).
  localName?: string;
  // Optional persistent status below the focused content. It occupies layout
  // space instead of overlaying a presentation or Remote Control desktop.
  statusRail?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col p-3 pb-24 sm:p-4 sm:pb-28">
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Main focused area — centers both axes so a contain-fitted tile sits
            centered when letterboxed on any viewport shape. */}
        <div className="flex min-h-0 flex-1 items-center justify-center sm:min-w-0">
          <div className="relative h-full w-full max-h-full max-w-full">{main}</div>
        </div>

        {/* Strip: mobile = horizontal filmstrip capped at 5.5rem,
            desktop = right column, scrollable. */}
        {stripTracks.length > 0 && (
          <div className="mt-3 flex max-h-[5.5rem] shrink-0 gap-3 overflow-x-auto sm:ml-4 sm:mt-0 sm:max-h-none sm:w-56 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
            {stripTracks.map((trackRef) => (
              <div key={trackKey(trackRef)} className="aspect-video h-[5.5rem] flex-shrink-0 sm:h-auto sm:w-full">
                <VideoTile
                  trackRef={trackRef}
                  active={trackRef.participant.identity === activeIdentity && stripTracks.length > 1}
                  onTogglePin={onTogglePin && !trackRef.participant.isLocal ? () => onTogglePin(trackRef.participant.identity) : undefined}
                  onRequestControl={onRequestControl && !trackRef.participant.isLocal ? () => onRequestControl(trackRef.participant.identity) : undefined}
                  fallbackName={trackRef.participant.isLocal ? localName : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {statusRail && <div className="mt-3 shrink-0">{statusRail}</div>}
    </div>
  );
}
