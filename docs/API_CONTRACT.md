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

Liveness probe — the process is up. Dependency-free.

**Response 200**

```json
{ "status": "ok" }
```

## GET /ready

Readiness probe (Phase 9) — the process can serve traffic, i.e. its backing
stores answer. Checks Postgres and Redis. Use it to gate a node in/out of
rotation; `/health` is for liveness/restart decisions.

**Response 200**

```json
{ "status": "ok", "checks": { "postgres": "ok", "redis": "ok" } }
```

**Response 503** (one or more dependencies down)

```json
{ "status": "unavailable", "checks": { "postgres": "ok", "redis": "down" } }
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

### POST /rooms _(updated in Phase 7 — now requires a session)_

Create a managed room and mint the host's token. **Requires a BetterAuth session**
(see "Phase 7"); the signed-in user becomes the room's owner and host. The host's
display name comes from the account, not the request. Rooms have **no title** —
the server always generates a unique **Room Code** (a Meet-style identifier like
`abz-mnpq-rfk`); the client cannot supply a name or slug.

**Request body:** `{ "scheduledStart"?: ISO-8601 }` (or empty `{}` for "start now")
**Response 201:** `{ "room", "scheduledStart", "identity", "token", "hostKey", "livekitUrl" }`

- `room` — the generated Room Code (URL path + LiveKit room name).
- `scheduledStart` — `null` for "start now", else the ISO time.
- `token` — host LiveKit JWT (grants incl. `roomAdmin: true`, metadata role=host).
- `hostKey` — opaque secret; the client stores it and sends it as `x-host-key`.
  **401** if not signed in.

### GET /rooms/mine _(session)_ — Phase 7

List the signed-in user's **upcoming scheduled meetings only** (those with a
future `scheduledStart`). Instant meetings and past ones are not returned.
Requires a BetterAuth session.

**Response 200:** `{ "rooms": [{ "room", "scheduledStart", "hostKey", "createdAt" }] }`

- `room` is the Room Code. Includes `hostKey` because the caller owns these rooms.
  **401** if not signed in.

### POST /rooms/:room/host-token _(session)_ — Phase 7

The owner mints a fresh host token to (re)join their own room (e.g. starting a
scheduled meeting). Requires a session **and** ownership.

**Response 200:** same shape as `POST /rooms`. **401** if not signed in; **403**
if signed in but not the owner; **404** if the room doesn't exist.

### GET /rooms/:room — Phase 7

Public room info for a guest landing on a shared link. Does **not** leak the host key.

**Response 200:** `{ "room", "scheduledStart" }`. **404** if unknown.

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

### POST /rooms/:room/mute-on-entry _(host)_

Toggle **Mute on Entry** for the room (see `docs/adr/0007`). Header `x-host-key`.
Turning it on force-mutes everyone present (except the host) and makes new
joiners arrive mic-off; turning it off only stops auto-muting future joiners — it
never unmutes anyone. The state is stored in the LiveKit room metadata.

**Request body:** `{ "muted": boolean }`
**Response 200:** `{ "muteOnEntry": boolean }` (the new state).

> The flag is also returned by the host-join payload (`muteOnEntry`) and, on
> admission, by the guest's knock-status poll (`muteOnEntry`), so a joining
> client can connect with its microphone off.

### DELETE /rooms/:room/participants/:identity _(host)_

Remove (kick) a participant. Header `x-host-key`. **Response 200:** `{ "ok": true }`.

### POST /rooms/:room/control-agent-link _(participant)_ — Phase 10

Mint a one-time pairing code for the Control Agent (Present with Control,
docs/adr/0010). Authorized by the caller's **own LiveKit join token** in the
`x-participant-token` header — holding a valid token for this room is the
authority (anyone in the call may present, so anyone may pair an agent).

**Response 200:** `{ "code": "qYjO1Wx-", "expiresInSeconds": 60 }` — the code
travels via the `huddle://present?code=…&api=…` deep link (or copy-paste).
**401** if the token is missing, invalid, expired, or for another room.

### POST /control-agent/redeem — Phase 10

The desktop agent exchanges its pairing code for a scoped LiveKit token. The
code is the bearer: single-use (atomic GETDEL), 60s TTL.

**Request:** `{ "code": "qYjO1Wx-" }`
**Response 200:** `{ "token", "livekitUrl", "room", "presenterIdentity",
"presenterName" }` — the token is for identity `agent:<presenterIdentity>`,
may publish only screen-share sources + data, cannot subscribe, ttl 2m.
**404** for an unknown, expired, or already-redeemed code.

### POST /rooms/:room/recordings _(host)_

Start a room-composite recording. Header `x-host-key`. One active recording per
room → **409** if one is already running. **Response 200:** a `RecordingSummary`
(`{ id, status, filename, sizeBytes, durationMs, startedAt, endedAt, error,
downloadable }`) with `status: "starting"`.

### GET /rooms/:room/recordings _(host)_

List this room's recordings, newest first. Header `x-host-key`.
**Response 200:** `{ "recordings": RecordingSummary[] }`.

### POST /rooms/:room/recordings/:id/stop _(host)_

Stop a running recording. Header `x-host-key`. **Response 200:** the updated
`RecordingSummary`. The egress webhook finalises status shortly after.

### GET /rooms/:room/recordings/:id/download _(host)_

Stream the finished MP4 (`Content-Type: video/mp4`, `Content-Disposition:
attachment`). Header `x-host-key` → so the browser fetches it as a blob, not a
plain link. **409** if the recording isn't `completed` yet. The file is proxied
from MinIO through the API; bucket credentials never reach the browser.

### GET /recordings/mine _(session)_

List **all** recordings across every room the signed-in host owns, newest first
— the lobby's cross-room recordings view (the room list itself is pared to
upcoming scheduled meetings, so this is the only path to past/instant meetings'
recordings). Requires a BetterAuth session.

**Response 200:** `{ "recordings": (RecordingSummary & { "room", "hostKey" })[] }`

- `room` is the owning Room Code; `hostKey` is included (the owner is entitled to
  it) so the client can download via `GET /rooms/:room/recordings/:id/download`.
  **401** if not signed in.

### POST /livekit/webhook

Receive & verify LiveKit server events (signed with the API key). Verified with
`WebhookReceiver`. On `room_finished`, the API drops that room's **ephemeral
knocks** (the room record itself is persistent since Phase 7 and is kept). On
`egress_started/updated/ended` (Phase 8) it advances the matching recording's
status and captures the file's size/duration. **Response 200** always (ack);
invalid signatures → **401**.

**Host-auth failures** (missing/invalid `x-host-key`) → **401** on all _(host)_
endpoints.

## Phase 7 — Accounts & auth

BetterAuth is mounted at **`/api/auth/*`** inside the same API (login, OAuth
callbacks, session). The frontend uses the BetterAuth client (`better-auth/react`)
rather than calling these by hand. Relevant for this contract:

- Login is **local email + password** (sign-up + sign-in), with **Google** as an
  optional social provider. The BetterAuth client wraps `POST /api/auth/sign-up/
email`, `POST /api/auth/sign-in/email`, and `/api/auth/sign-in/social`.
- `GET /api/auth/get-session` → the current session (or `null`).
- The session is a cookie set on the API origin. Session-gated endpoints
  (`POST /rooms`, `GET /rooms/mine`, `POST /rooms/:room/host-token`) read it; the
  client must send `credentials: "include"`.

## CORS

Allow the web app's origin (e.g. `http://localhost:3000` in dev) **with
`credentials: true`** so the BetterAuth session cookie is sent on cross-origin
calls. Keep the allowed-origins list in env/config (`WEB_ORIGIN`).
