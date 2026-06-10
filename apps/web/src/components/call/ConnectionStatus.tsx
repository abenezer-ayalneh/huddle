"use client";

import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

// Replaces LiveKit's ConnectionStateToast. A glass HUD chip, top-center, shown
// only while the connection is not healthy.
export default function ConnectionStatus() {
  const state = useConnectionState();

  if (state === ConnectionState.Connected) return null;

  const text = state === ConnectionState.Connecting ? "Connecting…" : state === ConnectionState.Reconnecting ? "Reconnecting…" : "Disconnected";

  const dotClass = state === ConnectionState.Reconnecting ? "bg-magenta" : state === ConnectionState.Disconnected ? "bg-destructive" : "bg-cyan";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center">
      <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.18em] text-white/90">
        <span className={`h-2 w-2 animate-pulse rounded-full ${dotClass}`} />
        {text}
      </div>
    </div>
  );
}
