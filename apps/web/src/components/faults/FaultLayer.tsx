'use client';

import FaultToast from './FaultToast';
import ServerUnreachableBanner from './ServerUnreachableBanner';

// App-wide Fault surfaces, mounted once at the root (docs/adr/0017, 0019):
//   - the dedup'd Fault toast (user-initiated faults, code-driven recovery)
//   - the quiet Server Unreachable banner (passive API Reachability loss)
// Render-crash boundaries are handled separately by app/error.tsx,
// app/global-error.tsx, and scoped <ErrorBoundary> wrappers (docs/adr/0018).
export default function FaultLayer() {
  return (
    <>
      <ServerUnreachableBanner />
      <FaultToast />
    </>
  );
}
