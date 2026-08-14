'use client';

import SystemNoticeStack from './SystemNoticeStack';

// App-wide system feedback, mounted once at the root (docs/adr/0017, 0019).
// Its shared visual stack presents the deduped Fault queue, passive API
// Reachability state, and the call-scoped LiveKit connection bridge.
// Render-crash boundaries are handled separately by app/error.tsx,
// app/global-error.tsx, and scoped <ErrorBoundary> wrappers (docs/adr/0018).
export default function FaultLayer() {
  return <SystemNoticeStack />;
}
