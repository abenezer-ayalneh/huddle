'use client';

import { useConnectionState } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { useEffect } from 'react';
import { setCallConnectionNotice } from '@/lib/systemNotices';

// Bridges LiveKit's call-local lifecycle into the root system-notice stack.
// The stack owns rendering so API Reachability, Faults, and Call Connection use
// one global newest-first family without conflating their source semantics.
export default function ConnectionStatus() {
  const state = useConnectionState();

  useEffect(() => {
    if (state === ConnectionState.Connected) {
      setCallConnectionNotice(null);
      return;
    }

    setCallConnectionNotice(
      state === ConnectionState.Connecting
        ? { message: 'Connecting…', tone: 'progress' }
        : state === ConnectionState.Reconnecting
          ? { message: 'Reconnecting…', tone: 'progress' }
          : { message: 'Disconnected', tone: 'error' },
    );
  }, [state]);

  useEffect(() => () => setCallConnectionNotice(null), []);
  return null;
}
