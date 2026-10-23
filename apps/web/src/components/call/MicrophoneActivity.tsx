'use client';

import { useLocalParticipant, useTrackVolume } from '@livekit/components-react';
import { Track } from 'livekit-client';

// Analyze the call's published track; never request a second microphone stream.
// Mounted only while the mic is enabled, so muting also releases the analyser.
export default function MicrophoneActivity({ speaking }: { speaking: boolean }) {
  const { localParticipant, microphoneTrack } = useLocalParticipant();
  const volume = useTrackVolume(
    microphoneTrack
      ? {
          participant: localParticipant,
          publication: microphoneTrack,
          source: Track.Source.Microphone,
        }
      : undefined,
  );
  const level = speaking && Number.isFinite(volume) ? Math.min(1, Math.max(0, volume) * 3) : 0;

  return (
    <span className="signal-call-mic-activity" role="img" aria-label={speaking ? 'You are speaking' : 'Microphone on'}>
      {[0.65, 1, 0.65].map((weight, index) => (
        <span key={index} aria-hidden="true" style={{ height: `${4 + 16 * level * weight}px` }} />
      ))}
    </span>
  );
}
