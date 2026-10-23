'use client';

import { type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Maximize, Minimize } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import VideoTile from './VideoTile';
import RecordingIndicator from './RecordingIndicator';

export default function SharedScreenView({ trackRef, recordingActive = false }: { trackRef: TrackReferenceOrPlaceholder; recordingActive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [failure, setFailure] = useState(false);

  useEffect(() => {
    setSupported(!!document.fullscreenEnabled && !!containerRef.current?.requestFullscreen);
    const update = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggle = async () => {
    setFailure(false);
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch {
      setFailure(true);
    }
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-black">
      <VideoTile trackRef={trackRef} active={false} />
      {fullscreen && recordingActive && (
        <div className="absolute inset-x-0 top-3 z-20 flex justify-center">
          <RecordingIndicator active startedAt={null} />
        </div>
      )}
      {supported && (
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={fullscreen ? 'Exit shared screen fullscreen' : 'View shared screen fullscreen'}
          className="absolute right-3 top-3 z-20 rounded-md bg-black/75 p-2 text-white focus-visible:outline-2 focus-visible:outline-yellow-400"
        >
          {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      )}
      {failure && (
        <p role="status" className="absolute left-3 top-3 z-20 rounded bg-black/85 p-2 text-sm text-white">
          Fullscreen could not open. Try again.
        </p>
      )}
    </div>
  );
}
