// Typed client for the NestJS backend (see docs/API_CONTRACT.md).
// Host-only calls authorize with the per-room hostKey via the x-host-key header.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type CreateRoomResult = {
  room: string;
  identity: string;
  token: string;
  hostKey: string;
  livekitUrl: string;
};

export type KnockStatus = "pending" | "admitted" | "denied";

export type KnockStatusResult = {
  status: KnockStatus;
  token?: string;
  identity?: string;
  livekitUrl?: string;
};

export type PendingKnock = {
  knockId: string;
  name: string;
  requestedAt: number;
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { hostKey?: string }
): Promise<T> {
  const { hostKey, headers, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(hostKey ? { "x-host-key": hostKey } : {}),
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
  createRoom: (room: string, name: string) =>
    request<CreateRoomResult>("/rooms", {
      method: "POST",
      body: JSON.stringify({ room, name }),
    }),

  knock: (room: string, name: string) =>
    request<{ knockId: string }>(`/rooms/${encodeURIComponent(room)}/knock`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  knockStatus: (room: string, knockId: string) =>
    request<KnockStatusResult>(
      `/rooms/${encodeURIComponent(room)}/knock/${knockId}`
    ),

  listKnocks: (room: string, hostKey: string) =>
    request<{ knocks: PendingKnock[] }>(
      `/rooms/${encodeURIComponent(room)}/knocks`,
      { hostKey }
    ),

  admit: (room: string, knockId: string, hostKey: string) =>
    request<{ status: string }>(
      `/rooms/${encodeURIComponent(room)}/knocks/${knockId}/admit`,
      { method: "POST", hostKey }
    ),

  deny: (room: string, knockId: string, hostKey: string) =>
    request<{ status: string }>(
      `/rooms/${encodeURIComponent(room)}/knocks/${knockId}/deny`,
      { method: "POST", hostKey }
    ),

  mute: (room: string, identity: string, muted: boolean, hostKey: string) =>
    request<{ ok: true }>(`/rooms/${encodeURIComponent(room)}/mute`, {
      method: "POST",
      body: JSON.stringify({ identity, muted }),
      hostKey,
    }),

  removeParticipant: (room: string, identity: string, hostKey: string) =>
    request<{ ok: true }>(
      `/rooms/${encodeURIComponent(room)}/participants/${encodeURIComponent(identity)}`,
      { method: "DELETE", hostKey }
    ),
};

export { ApiError };
