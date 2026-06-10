"use client";

import { useSpeakingParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useMemo } from "react";
import { isAgentIdentity } from "@/lib/controlProtocol";
import VideoTile from "./VideoTile";

export default function VideoGrid({ presentationOverlay }: { presentationOverlay?: React.ReactNode }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const speaking = useSpeakingParticipants();
  const activeIdentity = speaking[0]?.identity;

  const screenTrack = useMemo(() => tracks.find((t) => t.source === Track.Source.ScreenShare) ?? null, [tracks]);
  // Control Agents are plumbing, not people: their screen share renders like
  // anyone's, but they must never get a (placeholder) camera tile.
  const cameraTracks = useMemo(() => tracks.filter((t) => t.source === Track.Source.Camera && !isAgentIdentity(t.participant.identity)), [tracks]);

  if (screenTrack) {
    return <PresentationLayout screenTrack={screenTrack} cameraTracks={cameraTracks} activeIdentity={activeIdentity} overlay={presentationOverlay} />;
  }

  return <EqualGrid cameraTracks={cameraTracks} activeIdentity={activeIdentity} />;
}

function trackKey(trackRef: (typeof useTracks extends (...a: never[]) => infer R ? R : never)[number]) {
  return `${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication?.trackSid ?? "placeholder"}`;
}

function EqualGrid({ cameraTracks, activeIdentity }: { cameraTracks: ReturnType<typeof useTracks>; activeIdentity: string | undefined }) {
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
          gridAutoRows: "1fr",
        }}
      >
        {cameraTracks.map((trackRef) => (
          <VideoTile key={trackKey(trackRef)} trackRef={trackRef} active={trackRef.participant.identity === activeIdentity && cameraTracks.length > 1} />
        ))}
      </div>
    </div>
  );
}

function PresentationLayout({
  screenTrack,
  cameraTracks,
  activeIdentity,
  overlay,
}: {
  screenTrack: ReturnType<typeof useTracks>[number];
  cameraTracks: ReturnType<typeof useTracks>;
  activeIdentity: string | undefined;
  // Remote-control input capture mounts over the presented video; it finds
  // the <video> through this shared positioning context.
  overlay?: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col p-3 pb-24 sm:flex-row sm:p-4 sm:pb-28">
      {/* Main presentation area — centers the tile both axes so the
          object-contain video never overflows and sits centered when
          letterboxed on any viewport shape. */}
      <div className="flex min-h-0 flex-1 items-center justify-center sm:min-w-0">
        <div className="relative h-full w-full max-h-full max-w-full">
          <VideoTile trackRef={screenTrack} active={false} />
          {overlay}
        </div>
      </div>

      {/* Sidebar: mobile = horizontal filmstrip capped at 5.5rem,
          desktop = right column, scrollable. */}
      {cameraTracks.length > 0 && (
        <div className="mt-3 flex max-h-[5.5rem] shrink-0 gap-3 overflow-x-auto sm:ml-4 sm:mt-0 sm:max-h-none sm:w-56 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
          {cameraTracks.map((trackRef) => (
            <div key={trackKey(trackRef)} className="aspect-video h-[5.5rem] flex-shrink-0 sm:h-auto sm:w-full">
              <VideoTile trackRef={trackRef} active={trackRef.participant.identity === activeIdentity && cameraTracks.length > 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
