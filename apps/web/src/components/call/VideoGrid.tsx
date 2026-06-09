"use client";

import { useSpeakingParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useMemo } from "react";
import VideoTile from "./VideoTile";

// Auto-grid of participant tiles. Camera tracks (with placeholders so a
// camera-off participant still gets a tile) plus any screen shares. Column
// count scales with participant count; tiles fill their cells via object-cover
// so the grid never overflows the call area.
export default function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const speaking = useSpeakingParticipants();
  const activeIdentity = speaking[0]?.identity;

  const cols = useMemo(() => {
    const n = tracks.length || 1;
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
  }, [tracks.length]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 pb-24 sm:p-6 sm:pb-28">
      <div
        className="grid h-full w-full gap-3 sm:gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: "1fr",
        }}
      >
        {tracks.map((trackRef) => {
          const key = `${trackRef.participant.identity}:${trackRef.source}:${
            trackRef.publication?.trackSid ?? "placeholder"
          }`;
          const isScreenShare = trackRef.source === Track.Source.ScreenShare;
          // The loudest speaker's camera tile gets the active treatment (not the
          // screen share, which gets prominence instead).
          const isActive =
            trackRef.source === Track.Source.Camera &&
            trackRef.participant.identity === activeIdentity &&
            tracks.length > 1;
          return (
            <VideoTile
              key={key}
              trackRef={trackRef}
              active={isActive}
              prominent={isScreenShare && cols >= 2}
            />
          );
        })}
      </div>
    </div>
  );
}
