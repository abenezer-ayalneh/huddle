import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track, TrackEvent } from 'livekit-client';
import { useCallback, useSyncExternalStore } from 'react';

// Whether a tile's video should be horizontally mirrored. The Self-view is
// mirrored like a bathroom mirror so a participant's own movements feel natural
// — but only for a front ("user") camera. A phone's back ("environment") camera
// captures the world as it really is, so mirroring it flips text and scenes the
// wrong way (the bug this fixes). The rule: mirror unless the live track reports
// environment-facing. Cameras that report no facingMode (most desktop/USB
// webcams) stay mirrored — the long-standing default, so no desktop regression.
// Remote tiles and screen shares are never mirrored. See the mirror note in
// docs/adr/0014.
//
// facingMode lives on the live MediaStreamTrack, a mutable external source React
// can't see, so we read it through useSyncExternalStore: a Switch Device
// restarts the track in place (same publication, new facingMode) and emits
// TrackEvent.Restarted, which is our cue to re-read.
export function useMirrorLocalCamera(trackRef: TrackReferenceOrPlaceholder): boolean {
  const isLocalCamera = isTrackReference(trackRef) && trackRef.participant.isLocal && trackRef.source === Track.Source.Camera;
  const track = isTrackReference(trackRef) ? trackRef.publication.track : undefined;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!isLocalCamera || !track) return () => {};
      track.on(TrackEvent.Restarted, onChange);
      return () => {
        track.off(TrackEvent.Restarted, onChange);
      };
    },
    [isLocalCamera, track],
  );

  const getSnapshot = useCallback(() => isLocalCamera && track?.mediaStreamTrack?.getSettings().facingMode !== 'environment', [isLocalCamera, track]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
