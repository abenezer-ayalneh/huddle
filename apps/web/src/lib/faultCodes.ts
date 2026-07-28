// The web's copy of the Fault codes it special-cases. Duplicated per side on
// purpose (docs/adr/0017); docs/API_CONTRACT.md is the source of truth. Any code
// the client does not recognize is treated as a generic Fault — never crashed on,
// never shown raw.

// Transport faults the client MINTS when fetch rejects (no server envelope —
// the API never responded). Reserved client-only namespace (docs/adr/0019).
export const NET_UNREACHABLE = 'NET_UNREACHABLE';
export const NET_TIMEOUT = 'NET_TIMEOUT';

// Server codes the client reacts to specifically.
export const SESSION_EXPIRED = 'SESSION_EXPIRED';
export const DIRECT_REJOIN_NOT_ALLOWED = 'DIRECT_REJOIN_NOT_ALLOWED';

// The standard error envelope, also used for client-minted transport faults
// (statusCode 0 means "no response").
export type Fault = {
  code: string;
  message: string;
  statusCode: number;
};

export type RecoveryAction = 'signin' | 'retry' | 'reload' | 'none';

// The recovery affordance the Fault toast offers, chosen by code (docs/adr/0019).
export function recoveryActionFor(code: string): RecoveryAction {
  switch (code) {
    case SESSION_EXPIRED:
      return 'signin';
    case NET_UNREACHABLE:
    case NET_TIMEOUT:
      return 'retry';
    default:
      // Unknown / unhandled codes get a safe reload rather than nothing.
      return 'reload';
  }
}

export function isNetworkCode(code: string): boolean {
  return code === NET_UNREACHABLE || code === NET_TIMEOUT;
}
