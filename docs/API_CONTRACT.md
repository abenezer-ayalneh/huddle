# API Contract (Backend)

NestJS backend (`apps/api`). Base URL in dev: `http://localhost:3001`.
All requests/responses are JSON. This contract is the source of truth for the
frontend ↔ backend boundary.

> Only the endpoints needed for the MVP are specified. Add new endpoints here
> before implementing them.

## Faults & the error envelope

Every error response the API emits — from a single **global exception filter** —
has one shape:

```json
{ "code": "SESSION_EXPIRED", "message": "Your session expired — sign in again.", "statusCode": 401 }
```

- `code` — a stable, machine-readable token the client switches on.
- `message` — a human-readable fallback (safe to show if `code` is unknown).
- `statusCode` — mirrors the HTTP status.

The `code` set is **duplicated per side** (no shared package — see
`docs/adr/0017`); **this table is the source of truth** both copies track. The
web must treat an **unknown** `code` as a generic **Fault** (never crash, never
render the raw token).

Two classes share the envelope but get different UX (see `CONTEXT.md` →
"Errors & faults"):

- **Fault** — unexpected; routed to the generic Fault surface (boundary or the
  dedup'd Fault toast with a code-driven recovery action).
- **Domain Outcome** — expected; the same envelope on the wire, but the client
  routes it by `code` to tailored UX and it **never** shows as a Fault.

### Server-emitted codes

| `code`                   | status  | class          | meaning / origin                                 | recovery action |
| ------------------------ | ------- | -------------- | ------------------------------------------------ | --------------- |
| `SESSION_EXPIRED`        | 401     | Fault          | session-gated endpoint, no/expired session       | Sign in         |
| `UPSTREAM_UNAVAILABLE`   | 502/503 | Fault          | a dependency call failed (LiveKit, MinIO, Redis) | Retry           |
| `INTERNAL`               | 500     | Fault          | unhandled / misconfigured server error           | Reload          |
| `VALIDATION`             | 400     | Fault          | `ValidationPipe` rejected the body (client bug)  | (generic)       |
| `NOT_HOST`               | 401/403 | Domain Outcome | host action without a valid `x-host-key`         | (tailored)      |
| `NOT_PARTICIPANT`        | 401     | Domain Outcome | missing/invalid `x-participant-token` for room   | (tailored)      |
| `ROOM_NOT_FOUND`         | 404     | Domain Outcome | unknown room (guest link, host-token)            | (tailored)      |
| `KNOCK_NOT_FOUND`        | 404     | Domain Outcome | unknown / expired / withdrawn knock              | (tailored)      |
| `NAME_REQUIRED`          | 400     | Domain Outcome | knock with no display name                       | (inline)        |
| `RECORDING_IN_PROGRESS`  | 409     | Domain Outcome | start/approve while one is already active        | (tailored)      |
| `NOT_RECORDING_OWNER`    | 403     | Domain Outcome | `stop-by-participant` you didn't start           | (tailored)      |
| `RECORDING_NOT_READY`    | 409     | Domain Outcome | download before the recording is `completed`     | (tailored)      |
| `RECORDING_NOT_FOUND`    | 404     | Domain Outcome | unknown recording for the room                   | (tailored)      |
| `DOWNLOAD_TOKEN_INVALID` | 401     | Domain Outcome | missing/expired/forged recording download token  | (native)        |
| `WEBHOOK_UNVERIFIED`     | 401     | —              | bad LiveKit webhook signature (server-to-server) | n/a             |

> A **knock denial** is not in this table: it is a `200` poll returning
> `status: "denied"`, never an error response.
>
> `UPSTREAM_UNAVAILABLE` is emitted today by **recording start** (the record and
> host-approve routes) when the MinIO store is unreachable or rejects the API's
> S3 credentials — the recording fails fast with a Fault (503) instead of
> starting and silently ending up `failed`. Mapping the _other_ LiveKit/Redis
> call failures to it (rather than `INTERNAL` 500) is still a follow-up best done
> in the global filter.

### Client-synthesized faults (no envelope on the wire)

When `fetch` itself rejects — the API is down, connection refused, DNS/CORS
failure, offline, or a client timeout — **there is no response and no envelope**.
A **single shared low-level fetch** (used by `lib/api.ts` _and_ configured into
the BetterAuth client) catches the rejection and mints a synthetic Fault in the
same shape, so all downstream handling is uniform and no raw `TypeError: Failed
to fetch` escapes. These codes live only on the client, in a reserved `NET_*`
namespace, and are **always Faults** — they signal **API Reachability:
unreachable** (`CONTEXT.md` → "Errors & faults"; ADR 0019):

| `code`            | origin                                                   | recovery action |
| ----------------- | -------------------------------------------------------- | --------------- |
| `NET_UNREACHABLE` | `fetch` rejected (`ERR_CONNECTION_REFUSED`, failed/CORS) | Retry           |
| `NET_TIMEOUT`     | request exceeded the client-side timeout                 | Retry           |

**Surfacing splits by origin** (not by code):

- **User-initiated** (clicked Sign in, Create meeting): the dedup'd **Fault
  toast** with a code-driven recovery action. Opt in per request
  (`{ surfaceFault: true }`); the BetterAuth `signIn`/`signUp`/`signOut` wrappers
  pass it.
- **Passive/background** (the on-focus `get-session` refetch, polling): **no
  toast** — only the quiet, persistent **Server Unreachable** indicator that
  clears when reachability returns. This is the **default** (a forgotten flag
  degrades to quiet, never spam).

> This is why the log's BetterAuth failures (`/api/auth/get-session` on focus,
> `/api/auth/sign-in/social` on click) must not be left as uncaught rejections:
> the session refetch is passive (banner only), the sign-in click is active
> (toast). On mount, an unreachable `get-session` renders the **signed-out**
> Lobby plus the banner — never an indefinite spinner.

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
- `livekitUrl` — the browser-facing LiveKit signal URL. In local tunnel testing
  this may differ from the API's server-side admin URL.
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

### POST /rooms/:room/recordings _(host)_

Start a room-composite recording. Header `x-host-key`. One active recording per
room → **409** if one is already running. **Response 200:** a `RecordingSummary`
(`{ id, status, filename, sizeBytes, durationMs, startedAt, endedAt, error,
downloadable, downloadToken }`) with `status: "starting"`.

- `downloadToken` — a short-lived signed token (docs/adr/0022), non-null only
  once `status: "completed"`. The client builds the download URL from it:
  `GET /rooms/:room/recordings/:id/download?token=<downloadToken>`. It exists so
  a finished recording downloads natively (no `x-host-key` header on a `<a download>`).

### GET /rooms/:room/recordings _(host)_

List this room's recordings, newest first. Header `x-host-key`.
**Response 200:** `{ "recordings": RecordingSummary[] }`.

### POST /rooms/:room/recordings/:id/stop _(host)_

Stop a running recording. Header `x-host-key`. **Response 200:** the updated
`RecordingSummary`. The egress webhook finalises status shortly after.

### GET /rooms/:room/recordings/:id/download _(signed token)_

Stream the finished MP4 (`Content-Type: video/mp4`, `Content-Disposition:
attachment`). Authorized by `?token=<downloadToken>` — the short-lived signed
token from the recording's summary (docs/adr/0022), **not** the `x-host-key`
header — so this can be a plain `<a download>` navigation and the browser
downloads it natively with its own progress UI. **401** (`DOWNLOAD_TOKEN_INVALID`)
if the token is missing, expired, or forged. The file is proxied from MinIO
through the API; bucket credentials never reach the browser.

### Request to Record _(docs/adr/0011)_

Any non-host participant may ask to drive the room recording; the host approves.
The request/approve/deny prompts travel over LiveKit data messages (topic
`huddle:record`); these three endpoints are the server-side authority.

#### POST /rooms/:room/recordings/approve _(host)_

Approve a participant's Request to Record. Header `x-host-key`. Body
`{ "identity" }` — the LiveKit identity to attribute. **Approval starts the
recording immediately** (under the host's authority), attributed to that
identity. One active recording per room → **409** if one is already running.
**Response 200:** a `RecordingSummary` with `status: "starting"`. The file is
still host-owned and host-downloaded; the participant only triggered it. (Deny
needs no call — it is purely the client-side `record:deny` data message.)

#### POST /rooms/:room/recordings/stop-by-participant _(participant)_

Stop the active recording **you** started. Header `x-participant-token`.
Authorized by the recording's `startedByIdentity`, not a grant (→ **403** if you
didn't start the active recording). **Response 200:** the updated
`RecordingSummary`. The host can always stop any recording via the host-key stop.

While a recording is active the room metadata carries `recording: true` (the
**Recording Indicator**), so every client shows the recording state in real time.

### GET /recordings/mine _(session)_

List **all** recordings across every room the signed-in host owns, newest first
— the lobby's cross-room recordings view (the room list itself is pared to
upcoming scheduled meetings, so this is the only path to past/instant meetings'
recordings). Requires a BetterAuth session.

**Response 200:** `{ "recordings": (RecordingSummary & { "room" })[] }`

- `room` is the owning Room Code. The download is authorized by each recording's
  signed `downloadToken` (docs/adr/0022), so no `hostKey` travels in this
  response. **401** if not signed in.

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
