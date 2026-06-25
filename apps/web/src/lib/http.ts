// The single shared low-level fetch (docs/adr/0019). Every backend call routes
// through here — lib/api.ts AND the BetterAuth client — so that:
//   - a rejected fetch can never escape as a raw `TypeError: Failed to fetch`
//   - transport failures become NET_* Faults in the standard envelope shape
//   - API Reachability is tracked centrally (drives the quiet banner)
//   - surfacing splits by origin via an explicit, default-passive flag
import { NET_TIMEOUT, NET_UNREACHABLE, type Fault } from './faultCodes';
import { emitFault, setReachable } from './faults';

// A thrown Fault. Carries the envelope so callers can switch on `.code` /
// `.status`. (Exported as `ApiError` from lib/api.ts for back-compat.)
export class FaultError extends Error {
  readonly fault: Fault;
  constructor(fault: Fault) {
    super(fault.message);
    this.name = 'FaultError';
    this.fault = fault;
  }
  get code(): string {
    return this.fault.code;
  }
  get status(): number {
    return this.fault.statusCode;
  }
}

export function isFaultError(e: unknown): e is FaultError {
  return e instanceof FaultError;
}

export type HttpOptions = Omit<RequestInit, 'signal'> & {
  // Opt in to the Fault toast for a user-initiated request. Default false
  // (passive): transport failures show only the Server Unreachable banner.
  surfaceFault?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal | null;
};

const DEFAULT_TIMEOUT_MS = 15000;

export async function httpFetch(input: string, init: HttpOptions = {}): Promise<Response> {
  const { surfaceFault = false, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;

  // Time-box the request so a hung connection becomes a NET_TIMEOUT rather than
  // pending forever. Chain the caller's own AbortSignal if provided.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    // The server answered (even with an error status) — it is reachable.
    setReachable(true);
    return res;
  } catch (err) {
    // The caller aborted on purpose (e.g. component unmount) — not a Fault.
    if (signal?.aborted) throw err;

    const code = controller.signal.aborted ? NET_TIMEOUT : NET_UNREACHABLE;
    const fault: Fault = {
      code,
      message: code === NET_TIMEOUT ? 'The server took too long to respond.' : "Can't reach the server. It may be offline.",
      statusCode: 0,
    };
    setReachable(false);
    if (surfaceFault) emitFault(fault);
    throw new FaultError(fault);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

// Read the server's Fault envelope from a non-ok response (docs/API_CONTRACT.md).
// Always resolves to a Fault, tolerating bodies that aren't the expected shape.
export async function readFault(res: Response): Promise<Fault> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON or empty body — fall back to a generic Fault below.
  }
  const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    code: typeof obj.code === 'string' ? obj.code : 'ERROR',
    message: typeof obj.message === 'string' ? obj.message : `Request failed (${res.status})`,
    statusCode: res.status,
  };
}
