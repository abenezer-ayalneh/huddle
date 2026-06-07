// The lobby creates a room and receives a host token + hostKey. Those are
// stashed in sessionStorage so the room page (a fresh navigation) can pick them
// up without putting secrets in the URL. Scoped per room, cleared on leave.

export type HostSession = {
  token: string;
  hostKey: string;
  identity: string;
  livekitUrl: string;
  name: string;
};

const key = (room: string) => `huddle:host:${room}`;

export function saveHostSession(room: string, session: HostSession): void {
  sessionStorage.setItem(key(room), JSON.stringify(session));
}

export function loadHostSession(room: string): HostSession | null {
  try {
    const raw = sessionStorage.getItem(key(room));
    return raw ? (JSON.parse(raw) as HostSession) : null;
  } catch {
    return null;
  }
}

export function clearHostSession(room: string): void {
  try {
    sessionStorage.removeItem(key(room));
  } catch {
    // ignore — storage may be unavailable
  }
}
