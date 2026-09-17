'use client';

import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useEffect, useRef } from 'react';
import { isControlAgentParticipant } from '@/lib/controlProtocol';
import { playCallDing } from './callSounds';

/**
 * Announce human participants as they enter a call. Existing participants hear
 * the remote connection event; an admitted guest gets the same cue locally
 * because LiveKit emits ParticipantConnected only for remote participants.
 */
export function useParticipantJoinSound(announceLocalJoin = false): void {
  const room = useRoomContext();
  const localJoinAnnounced = useRef(false);

  useEffect(() => {
    if (!announceLocalJoin || localJoinAnnounced.current) return;
    localJoinAnnounced.current = true;
    playCallDing();
  }, [announceLocalJoin]);

  useEffect(() => {
    function handleParticipantConnected(participant: RemoteParticipant) {
      if (isControlAgentParticipant(participant)) return;
      playCallDing();
    }

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room]);
}
