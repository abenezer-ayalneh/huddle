// Stable, machine-readable Fault codes — the server's source of truth for the
// error envelope (docs/adr/0017, docs/API_CONTRACT.md). The web keeps its own
// copy of the codes it switches on (duplicated per side, on purpose) and treats
// any unknown code as a generic Fault.
//
// Two classes share one envelope but get different UX on the client:
//   - Fault         — unexpected (SESSION_EXPIRED, INTERNAL, VALIDATION)
//   - Domain Outcome — expected; enveloped the same way, routed to tailored UX
export const FaultCode = {
  // Faults (unexpected)
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INTERNAL: 'INTERNAL',
  VALIDATION: 'VALIDATION',
  // A dependency call failed or rejected our credentials (LiveKit, MinIO, Redis)
  // — 502/503, "Retry" (docs/API_CONTRACT.md). First concrete use: recording
  // start when the MinIO store is unreachable or the S3 keys are wrong, surfaced
  // at start time instead of letting the recording silently end up `failed`.
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  // Domain Outcomes (expected — see CONTEXT.md → "Errors & faults")
  NOT_HOST: 'NOT_HOST',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  KNOCK_NOT_FOUND: 'KNOCK_NOT_FOUND',
  NAME_REQUIRED: 'NAME_REQUIRED',
  DIRECT_REJOIN_NOT_ALLOWED: 'DIRECT_REJOIN_NOT_ALLOWED',
  RECORDING_IN_PROGRESS: 'RECORDING_IN_PROGRESS',
  NOT_RECORDING_OWNER: 'NOT_RECORDING_OWNER',
  RECORDING_NOT_READY: 'RECORDING_NOT_READY',
  RECORDING_NOT_FOUND: 'RECORDING_NOT_FOUND',
  RECORDING_EXPIRED: 'RECORDING_EXPIRED',
  RECORDING_SHARE_UNAVAILABLE: 'RECORDING_SHARE_UNAVAILABLE',
  RECORDING_SHARE_NOT_ALLOWED: 'RECORDING_SHARE_NOT_ALLOWED',
  REMOTE_CONTROL_IN_PROGRESS: 'REMOTE_CONTROL_IN_PROGRESS',
  REMOTE_CONTROL_NOT_FOUND: 'REMOTE_CONTROL_NOT_FOUND',
  REMOTE_CONTROL_NOT_ALLOWED: 'REMOTE_CONTROL_NOT_ALLOWED',
  REMOTE_CONTROL_PRESENT_ACTIVE: 'REMOTE_CONTROL_PRESENT_ACTIVE',
  REMOTE_CONTROL_RENEWAL_REQUIRED: 'REMOTE_CONTROL_RENEWAL_REQUIRED',
  REMOTE_CONTROL_HELPER_NOT_CONNECTED: 'REMOTE_CONTROL_HELPER_NOT_CONNECTED',
  REMOTE_CONTROL_BOOTSTRAP_INVALID: 'REMOTE_CONTROL_BOOTSTRAP_INVALID',
  // The signed recording-download link is missing, malformed, or past its TTL
  // (docs/adr/0022). The host just re-opens the recordings list to get a fresh one.
  DOWNLOAD_TOKEN_INVALID: 'DOWNLOAD_TOKEN_INVALID',
  WEBHOOK_UNVERIFIED: 'WEBHOOK_UNVERIFIED',
} as const;

export type FaultCode = (typeof FaultCode)[keyof typeof FaultCode];

// Build the response body the global FaultFilter reads. Pair it with the
// matching Nest HttpException so the HTTP status and `instanceof` checks stay
// correct, e.g.:
//   throw new ForbiddenException(faultBody(FaultCode.NOT_HOST, 'You are not the host'));
export function faultBody(code: FaultCode, message: string): { code: FaultCode; message: string } {
  return { code, message };
}
