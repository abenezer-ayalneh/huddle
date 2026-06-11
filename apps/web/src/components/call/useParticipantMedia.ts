import { type Participant, ParticipantEvent } from 'livekit-client';
import { useEffect, useState } from 'react';

// Reactive camera/mic enabled state for a participant. The LiveKit track-loop
// hooks re-render on track add/remove, but mute toggles don't always propagate
// to a tile, so we subscribe to the participant's own events to keep the avatar
// fallback and the mic-off badge in sync.
export function useParticipantMedia(participant: Participant) {
  const read = () => ({
    cameraOn: participant.isCameraEnabled,
    micOn: participant.isMicrophoneEnabled,
  });
  const [state, setState] = useState(read);

  useEffect(() => {
    const update = () =>
      setState({
        cameraOn: participant.isCameraEnabled,
        micOn: participant.isMicrophoneEnabled,
      });
    update();
    // Remote and local participants emit overlapping but distinct event sets
    // (e.g. LocalTrackPublished only fires on the local participant). A narrow
    // emitter view lets us register the union without fighting the overloads.
    const emitter = participant as unknown as {
      on(event: ParticipantEvent, cb: () => void): void;
      off(event: ParticipantEvent, cb: () => void): void;
    };
    const events = [
      ParticipantEvent.TrackMuted,
      ParticipantEvent.TrackUnmuted,
      ParticipantEvent.TrackPublished,
      ParticipantEvent.TrackUnpublished,
      ParticipantEvent.LocalTrackPublished,
      ParticipantEvent.LocalTrackUnpublished,
    ];
    for (const e of events) emitter.on(e, update);
    return () => {
      for (const e of events) emitter.off(e, update);
    };
  }, [participant]);

  return state;
}
