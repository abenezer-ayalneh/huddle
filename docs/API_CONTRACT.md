# API Contract (Backend)

NestJS backend (`apps/api`). Base URL in dev: `http://localhost:3001`.
All requests/responses are JSON. This contract is the source of truth for the
frontend ↔ backend boundary.

> Only the endpoints needed for the MVP are specified. Add new endpoints here
> before implementing them.

## ~~POST /token~~ (removed in Phase 6)

The standalone public token endpoint was removed in Phase 6. It let anyone mint
a join token for any room name, which would bypass the managed-room **waiting
room**. Tokens are now minted only by the managed-room flow below (`POST /rooms`
for the host, admit for guests), where identity and grants are decided
server-side. See "Phase 6 — Host controls & managed rooms".

## GET /health

Liveness probe.

**Response 200**

```json
{ "status": "ok" }
```

## Phase 6 — Host controls & managed rooms

Phase 6 replaces "join a free-text room on demand" with **managed rooms**: a host
explicitly creates a room, and guests must **knock** and be **admitted** (waiting
room). Host-only actions are authorized by a per-room `hostKey` returned at
creation and sent in the `x-host-key` header. Server-side state (host key, host
identity, pending knocks) is held **in-memory in the API process** (single-node);
moving it to Redis is Phase 9 hardening.

> Host identity carries `metadata: { "role": "host" }` in its LiveKit token so the
> frontend can show host UI. Authority for admin actions is **never** trusted from
> that claim — it is enforced server-side via `hostKey`.

### POST /rooms

Create a managed room and mint the host's token.

**Request body:** `{ "room": string(1..128), "name": string(1..128) }`
**Response 201:** `{ "room", "identity", "token", "hostKey", "livekitUrl" }`

- `token` — host LiveKit JWT (grants incl. `roomAdmin: true`, metadata role=host).
- `hostKey` — opaque secret; the client stores it and sends it as `x-host-key`.
  **409** if the room already exists (pick another name).

### POST /rooms/:room/knock

Guest requests admission to a managed room.

**Request body:** `{ "name": string(1..128) }`
**Response 201:** `{ "knockId": string }`
**404** if the room is not a managed/known room.

### GET /rooms/:room/knock/:knockId

Guest polls for the host's decision. (Public — knockId is the bearer.)

**Response 200:** `{ "status": "pending" | "admitted" | "denied", "token"?, "identity"?, "livekitUrl"? }`

- `token`/`identity`/`livekitUrl` present only when `status = "admitted"`.
  **404** if the knock is unknown/expired.

### DELETE /rooms/:room/knock/:knockId

Guest withdraws their own pending request (knockId is the bearer). Idempotent.
**Response 200:** `{ "ok": true }` whether or not the knock still existed.

### GET /rooms/:room/knocks _(host)_

List pending knocks. Header `x-host-key` required.

**Response 200:** `{ "knocks": [{ "knockId", "name", "requestedAt" }] }`

### POST /rooms/:room/knocks/:knockId/admit _(host)_

### POST /rooms/:room/knocks/:knockId/deny _(host)_

Host decision. Header `x-host-key` required. **Response 200:** `{ "status" }`.
Admit mints the guest's join token (delivered via the guest's poll).

### POST /rooms/:room/mute _(host)_

Force-mute/unmute a participant's microphone. Header `x-host-key`.

**Request body:** `{ "identity": string, "muted": boolean }`
**Response 200:** `{ "ok": true }` (no-op if the participant has no audio track).

### DELETE /rooms/:room/participants/:identity _(host)_

Remove (kick) a participant. Header `x-host-key`. **Response 200:** `{ "ok": true }`.

### POST /livekit/webhook

Receive & verify LiveKit server events (signed with the API key). Verified with
`WebhookReceiver`. On `room_finished`, the API drops that room's in-memory state.
**Response 200** always (ack); invalid signatures → **401**.

**Host-auth failures** (missing/invalid `x-host-key`) → **401** on all _(host)_
endpoints.

## CORS

Allow the web app's origin (e.g. `http://localhost:3000` in dev) for the
endpoints above. Keep the allowed-origins list in env/config.
