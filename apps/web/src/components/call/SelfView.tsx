'use client';

import { type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import VideoTile from './VideoTile';

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

// Corner anchors. The bottom corners are lifted above the control bar
// (bottom-center) so the float never sits under the call controls.
const CORNER_CLASS: Record<Corner, string> = {
  tl: 'left-3 top-3 sm:left-6 sm:top-6',
  tr: 'right-3 top-3 sm:right-6 sm:top-6',
  bl: 'bottom-24 left-3 sm:bottom-28 sm:left-6',
  br: 'bottom-24 right-3 sm:bottom-28 sm:right-6',
};

// The floating self-view: the local camera, shown small and draggable while at
// least one other participant is on the call. Dragging snaps to the nearest of
// the four corners on release.
export default function SelfView({
  trackRef,
  corner,
  onCornerChange,
  fallbackName,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  corner: Corner;
  onCornerChange: (corner: Corner) => void;
  // The local participant's known name — this float always shows the local
  // camera, so forward it so the tile never flashes a placeholder on join.
  fallbackName?: string;
}) {
  // Live drag offset from the resting corner; null when not dragging.
  const [delta, setDelta] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDelta({ x: 0, y: 0 });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    setDelta({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    // Snap to the corner of the viewport quadrant the pointer ended in.
    const horiz = e.clientX < window.innerWidth / 2 ? 'l' : 'r';
    const vert = e.clientY < window.innerHeight / 2 ? 't' : 'b';
    onCornerChange(`${vert}${horiz}` as Corner);
    startRef.current = null;
    setDelta(null);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={delta ? { transform: `translate(${delta.x}px, ${delta.y}px)` } : undefined}
      className={`absolute z-20 aspect-video w-28 touch-none cursor-grab select-none active:cursor-grabbing sm:w-44 ${CORNER_CLASS[corner]}`}
    >
      <VideoTile trackRef={trackRef} active={false} fallbackName={fallbackName} />
    </div>
  );
}
