// Typed client for the NestJS backend (see docs/API_CONTRACT.md).
// Host-only calls authorize with the per-room hostKey via the x-host-key header.
import { emitFault } from './faults';
import { FaultError, httpFetch, isFaultError, readFault } from './http';
import type { RemoteControlSession } from './controlProtocol';

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

export type GuestJoinResult = {
  room: string;
  identity: string;
  token: string;
  livekitUrl: string;
  muteOnEntry: boolean;
};

export type PendingKnock = {
  knockId: string;
  name: string;
  // The guest's Avatar URL when their signed-in account has one (docs/adr/0016);
  // null for anonymous guests or accounts without a picture.
  image?: string | null;
  requestedAt: number;
};

export type RemoteControlRequestSummary = {
  requestId: string;
  room: string;
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  requestedAt: string;
  expiresAt: string;
};

export type RemoteControlApproval = {
  session: RemoteControlSession;
  helper: {
    bootstrapCode: string;
    expiresAt: string;
  };
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
  // Absolute, ready-to-use download URL when the recording is `completed`; null
  // otherwise. Carries a short-lived signed token (docs/adr/0022) so a plain
  // `<a download>` triggers a native browser download (progress shelf) without
  // the host-key header. Assembled client-side from the server's downloadToken.
  downloadUrl: string | null;
};

// A recording listed across all the host's rooms (lobby /recordings view): adds
// the owning Room Code. The download is authorized by the signed downloadUrl, so
// no host key travels in this response.
export type MyRecording = RecordingSummary & {
  room: string;
};

// Wire shape: the server sends a downloadToken (not a URL — it doesn't assume its
// own public origin). The client turns it into an absolute downloadUrl.
type RecordingWire = Omit<RecordingSummary, 'downloadUrl'> & { downloadToken: string | null };
type MyRecordingWire = RecordingWire & { room: string };

// Build the public RecordingSummary from the wire shape: swap the signed token
// for the absolute download URL the browser navigates to (docs/adr/0022).
function toRecordingSummary(r: RecordingWire, room: string): RecordingSummary {
  const { downloadToken, ...rest } = r;
  return {
    ...rest,
    downloadUrl: downloadToken
      ? `${API_URL}/rooms/${encodeURIComponent(room)}/recordings/${encodeURIComponent(r.id)}/download?token=${encodeURIComponent(downloadToken)}`
      : null,
  };
}

// Per-call options. `surfaceFault: true` opts a user-initiated request into the
// Fault toast (default passive — see docs/adr/0019); `hostKey` adds the host
// capability header.
type RequestInitX = RequestInit & { hostKey?: string; surfaceFault?: boolean };

async function request<T>(path: string, init?: RequestInitX): Promise<T> {
  const { hostKey, headers, surfaceFault, ...rest } = init ?? {};
  const res = await httpFetch(`${API_URL}${path}`, {
    // Send the BetterAuth session cookie on cross-origin API calls (the auth
    // routes that need a signed-in host depend on it).
    credentials: 'include',
    surfaceFault,
    headers: {
      'Content-Type': 'application/json',
      ...(hostKey ? { 'x-host-key': hostKey } : {}),
      ...headers,
    },
    ...rest,
  });
  if (!res.ok) {
    // HTTP error → read the server's Fault envelope. Surfacing is opt-in:
    // user-initiated callers pass surfaceFault (or catch and call emitFault).
    const fault = await readFault(res);
    if (surfaceFault) emitFault(fault);
    throw new FaultError(fault);
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

  directRejoinEligibility: (room: string) => request<{ eligible: boolean }>(`/rooms/${encodeURIComponent(room)}/rejoin`),

  directRejoin: (room: string) =>
    request<GuestJoinResult>(`/rooms/${encodeURIComponent(room)}/rejoin`, {
      method: 'POST',
    }),

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

  // All of the signed-in host's recordings across their rooms (session-authed).
  // Backs the lobby /recordings page; each item carries its Room Code and a
  // signed downloadUrl built client-side from the server's token.
  listMyRecordings: async (): Promise<{ recordings: MyRecording[] }> => {
    const { recordings } = await request<{ recordings: MyRecordingWire[] }>('/recordings/mine');
    return { recordings: recordings.map((r) => ({ ...toRecordingSummary(r, r.room), room: r.room })) };
  },

  // --- Recording (host-only) ---
  startRecording: async (room: string, hostKey: string): Promise<RecordingSummary> => {
    const r = await request<RecordingWire>(`/rooms/${encodeURIComponent(room)}/recordings`, { method: 'POST', hostKey });
    return toRecordingSummary(r, room);
  },

  listRecordings: async (room: string, hostKey: string): Promise<{ recordings: RecordingSummary[] }> => {
    const { recordings } = await request<{ recordings: RecordingWire[] }>(`/rooms/${encodeURIComponent(room)}/recordings`, { hostKey });
    return { recordings: recordings.map((r) => toRecordingSummary(r, room)) };
  },

  stopRecording: async (room: string, id: string, hostKey: string): Promise<RecordingSummary> => {
    const r = await request<RecordingWire>(`/rooms/${encodeURIComponent(room)}/recordings/${id}/stop`, { method: 'POST', hostKey });
    return toRecordingSummary(r, room);
  },

  // --- Request to Record (docs/adr/0011) ---
  // Host approves a participant's Request to Record: approval starts the
  // recording immediately, attributed to that identity. Deny needs no API call.
  approveRecording: async (room: string, identity: string, hostKey: string): Promise<RecordingSummary> => {
    const r = await request<RecordingWire>(`/rooms/${encodeURIComponent(room)}/recordings/approve`, {
      method: 'POST',
      body: JSON.stringify({ identity }),
      hostKey,
    });
    return toRecordingSummary(r, room);
  },

  // The requester stops the recording they were approved for, authorized by
  // their own LiveKit token (x-participant-token).
  stopRecordingAsParticipant: async (room: string, participantToken: string): Promise<RecordingSummary> => {
    const r = await request<RecordingWire>(`/rooms/${encodeURIComponent(room)}/recordings/stop-by-participant`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    });
    return toRecordingSummary(r, room);
  },

  // --- Attended Remote Control (docs/adr/0024) ---
  requestRemoteControl: (room: string, sharerIdentity: string, participantToken: string) =>
    request<RemoteControlRequestSummary>(`/rooms/${encodeURIComponent(room)}/remote-control/requests`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
      body: JSON.stringify({ sharerIdentity }),
    }),

  getRemoteControlRequest: (room: string, requestId: string, participantToken: string) =>
    request<RemoteControlRequestSummary>(`/rooms/${encodeURIComponent(room)}/remote-control/requests/${encodeURIComponent(requestId)}`, {
      headers: { 'x-participant-token': participantToken },
    }),

  // A short-lived fallback for an addressed LiveKit request notification that
  // the target browser did not receive. The API returns a request only to its
  // exact Sharer, otherwise `null`.
  getPendingRemoteControlRequest: (room: string, participantToken: string) =>
    request<{ request: RemoteControlRequestSummary | null }>(`/rooms/${encodeURIComponent(room)}/remote-control/requests/pending`, {
      headers: { 'x-participant-token': participantToken },
    }),

  approveRemoteControl: (room: string, requestId: string, participantToken: string) =>
    request<RemoteControlApproval>(`/rooms/${encodeURIComponent(room)}/remote-control/requests/${encodeURIComponent(requestId)}/approve`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  reissueRemoteControlBootstrap: (room: string, sessionId: string, participantToken: string) =>
    request<{ bootstrapCode: string; expiresAt: string }>(`/rooms/${encodeURIComponent(room)}/remote-control/${encodeURIComponent(sessionId)}/bootstrap`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  denyRemoteControl: (room: string, requestId: string, participantToken: string) =>
    request<{ status: 'denied' }>(`/rooms/${encodeURIComponent(room)}/remote-control/requests/${encodeURIComponent(requestId)}/deny`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  stopRemoteControl: (room: string, sessionId: string, participantToken: string) =>
    request<{ status: 'ended'; endedAt: string }>(`/rooms/${encodeURIComponent(room)}/remote-control/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  renewRemoteControl: (room: string, sessionId: string, participantToken: string) =>
    request<{ sessionId: string; renewalDueAt: string }>(`/rooms/${encodeURIComponent(room)}/remote-control/${encodeURIComponent(sessionId)}/renew`, {
      method: 'POST',
      headers: { 'x-participant-token': participantToken },
    }),

  // No downloadRecording(): a finished recording carries a signed downloadUrl in
  // its summary, rendered as a plain `<a download>` so the browser downloads it
  // natively with its own progress UI (docs/adr/0022).
};

// Back-compat alias: existing call sites import `ApiError` and read `.status`.
// FaultError carries `.status` and `.code`, so both keep working.
export { FaultError, FaultError as ApiError, isFaultError };
