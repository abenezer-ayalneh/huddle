export const REMOTE_CONTROL_REQUEST_TTL_MS = 30_000;

// `expiresInMs` is optional only during a coordinated API/web rollout. New API
// responses always include it; an older API can still provide the request's
// original bounded lifetime from its two server-issued timestamps.
export type RemoteControlRequestTiming = {
  requestedAt: string;
  expiresAt: string;
  expiresInMs?: number;
};

export function getRemoteControlRequestRemainingMs(request: RemoteControlRequestTiming): number | null {
  if (request.expiresInMs !== undefined) {
    if (!Number.isFinite(request.expiresInMs) || request.expiresInMs <= 0 || request.expiresInMs > REMOTE_CONTROL_REQUEST_TTL_MS) return null;
    return Math.floor(request.expiresInMs);
  }

  const requestedAt = Date.parse(request.requestedAt);
  const expiresAt = Date.parse(request.expiresAt);
  const originalLifetime = expiresAt - requestedAt;
  if (!Number.isFinite(originalLifetime) || originalLifetime <= 0 || originalLifetime > REMOTE_CONTROL_REQUEST_TTL_MS) return null;
  return originalLifetime;
}
