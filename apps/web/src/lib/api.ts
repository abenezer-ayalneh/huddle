// Typed client for the NestJS backend (see docs/API_CONTRACT.md).
// Host-only calls authorize with the per-room hostKey via the x-host-key header.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Host join: what a signed-in host needs to connect to LiveKit and run the
// room. Returned by both create (new room) and host-token (rejoin own room).
// `room` is the auto-generated Room Code.
export type HostJoinResult = {
  room: string;
  scheduledStart: string | null;
  identity: string;
  token: string;
  hostKey: string;
  livekitUrl: string;
  // Current Mute-on-Entry state of the room.
  muteOnEntry: boolean;
};

// An upcoming scheduled meeting the signed-in user hosts (includes the host key
// — they own it). Instant and past meetings are not listed.
export type RoomSummary = {
  room: string;
  scheduledStart: string | null;
  hostKey: string;
  createdAt: string;
};

export type PublicRoom = {
  room: string;
  scheduledStart: string | null;
};

export type KnockStatus = 'pending' | 'admitted' | 'denied';

export type KnockStatusResult = {
  status: KnockStatus;
  token?: string;
  identity?: string;
  livekitUrl?: string;
  // When admitted, whether the guest should connect with their mic off.
  muteOnEntry?: boolean;
};

export type PendingKnock = {
  knockId: string;
  name: string;
  requestedAt: number;
};

// A room-composite recording (Phase 8).
export type RecordingSummary = {
  id: string;
  status: 'starting' | 'active' | 'completed' | 'failed' | 'aborted';
  filename: string;
  sizeBytes: number | null;
  durationMs: number | null;
  startedAt: string;
  endedAt: string | null;
  error: string | null;
  downloadable: boolean;
};

// A recording listed across all the host's rooms (lobby /recordings view): adds
// the owning Room Code and the host key needed to authorize its download.
export type MyRecording = RecordingSummary & {
  room: string;
  hostKey: string;
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { hostKey?: string }): Promise<T> {
  const { hostKey, headers, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    // Send the BetterAuth session cookie on cross-origin API calls (the auth
    // routes that need a signed-in host depend on it).
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(hostKey ? { 'x-host-key': hostKey } : {}),
      ...headers,
    },
    ...rest,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`);
  }
  // Some endpoints return no body; guard against empty responses.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const api = {
  // Signed-in host creates a meeting; the server generates its Room Code. The
  // only input is an optional scheduled start. Auth via session cookie.
  createRoom: (input: { scheduledStart?: string } = {}) =>
    request<HostJoinResult>('/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Rooms the signed-in host owns.
  listMine: () => request<{ rooms: RoomSummary[] }>('/rooms/mine'),

  // Owner mints a fresh host token to (re)join their own room.
  hostJoin: (room: string) =>
    request<HostJoinResult>(`/rooms/${encodeURIComponent(room)}/host-token`, {
      method: 'POST',
    }),

  // Public info shown to a guest landing on a room link.
  getPublicRoom: (room: string) => request<PublicRoom>(`/rooms/${encodeURIComponent(room)}`),

  knock: (room: string, name: string) =>
    request<{ knockId: string }>(`/rooms/${encodeURIComponent(room)}/knock`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  knockStatus: (room: string, knockId: string) => request<KnockStatusResult>(`/rooms/${encodeURIComponent(room)}/knock/${knockId}`),

  cancelKnock: (room: string, knockId: string) => request<{ ok: true }>(`/rooms/${encodeURIComponent(room)}/knock/${knockId}`, { method: 'DELETE' }),

  listKnocks: (room: string, hostKey: string) => request<{ knocks: PendingKnock[] }>(`/rooms/${encodeURIComponent(room)}/knocks`, { hostKey }),

  admit: (room: string, knockId: string, hostKey: string) =>
    request<{ status: string }>(`/rooms/${encodeURIComponent(room)}/knocks/${knockId}/admit`, { method: 'POST', hostKey }),

  deny: (room: string, knockId: string, hostKey: string) =>
    request<{ status: string }>(`/rooms/${encodeURIComponent(room)}/knocks/${knockId}/deny`, { method: 'POST', hostKey }),

  mute: (room: string, identity: string, muted: boolean, hostKey: string) =>
    request<{ ok: true }>(`/rooms/${encodeURIComponent(room)}/mute`, {
      method: 'POST',
      body: JSON.stringify({ identity, muted }),
      hostKey,
    }),

  // Toggle Mute on Entry (host-only). Returns the new state.
  setMuteOnEntry: (room: string, muted: boolean, hostKey: string) =>
    request<{ muteOnEntry: boolean }>(`/rooms/${encodeURIComponent(room)}/mute-on-entry`, { method: 'POST', body: JSON.stringify({ muted }), hostKey }),

  removeParticipant: (room: string, identity: string, hostKey: string) =>
    request<{ ok: true }>(`/rooms/${encodeURIComponent(room)}/participants/${encodeURIComponent(identity)}`, { method: 'DELETE', hostKey }),

  // Present with Control (docs/adr/0010): mint a one-time pairing code for the
  // Control Agent. Authorized by the participant's own LiveKit token — anyone
  // in the call may present, so anyone in the call may pair an agent.
  controlAgentLink: (room: string, participantToken: string) =>
    request<{ code: string; expiresInSeconds: number }>(`/rooms/${encodeURIComponent(room)}/control-agent-link`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  // All of the signed-in host's recordings across their rooms (session-authed).
  // Backs the lobby /recordings page; each item carries its Room Code + hostKey.
  listMyRecordings: () => request<{ recordings: MyRecording[] }>('/recordings/mine'),

  // --- Recording (host-only) ---
  startRecording: (room: string, hostKey: string) =>
    request<RecordingSummary>(`/rooms/${encodeURIComponent(room)}/recordings`, {
      method: 'POST',
      hostKey,
    }),

  listRecordings: (room: string, hostKey: string) => request<{ recordings: RecordingSummary[] }>(`/rooms/${encodeURIComponent(room)}/recordings`, { hostKey }),

  stopRecording: (room: string, id: string, hostKey: string) =>
    request<RecordingSummary>(`/rooms/${encodeURIComponent(room)}/recordings/${id}/stop`, { method: 'POST', hostKey }),

  // The download is host-authorized (x-host-key), so it can't be a plain link —
  // fetch it as a blob and let the caller trigger a save.
  downloadRecording: async (room: string, id: string, hostKey: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(room)}/recordings/${id}/download`, {
      credentials: 'include',
      headers: { 'x-host-key': hostKey },
    });
    if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
    return res.blob();
  },
};

export { ApiError };
