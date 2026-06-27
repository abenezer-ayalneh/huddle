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
  // Domain Outcomes (expected — see CONTEXT.md → "Errors & faults")
  NOT_HOST: 'NOT_HOST',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  KNOCK_NOT_FOUND: 'KNOCK_NOT_FOUND',
  NAME_REQUIRED: 'NAME_REQUIRED',
  RECORDING_IN_PROGRESS: 'RECORDING_IN_PROGRESS',
  NOT_RECORDING_OWNER: 'NOT_RECORDING_OWNER',
  RECORDING_NOT_READY: 'RECORDING_NOT_READY',
  RECORDING_NOT_FOUND: 'RECORDING_NOT_FOUND',
  PAIRING_CODE_INVALID: 'PAIRING_CODE_INVALID',
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
