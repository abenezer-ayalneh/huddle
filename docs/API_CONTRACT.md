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

| `code`                                | status  | class          | meaning / origin                                 | recovery action |
| ------------------------------------- | ------- | -------------- | ------------------------------------------------ | --------------- |
| `SESSION_EXPIRED`                     | 401     | Fault          | session-gated endpoint, no/expired session       | Sign in         |
| `UPSTREAM_UNAVAILABLE`                | 502/503 | Fault          | a dependency call failed (LiveKit, MinIO, Redis) | Retry           |
| `INTERNAL`                            | 500     | Fault          | unhandled / misconfigured server error           | Reload          |
| `VALIDATION`                          | 400     | Fault          | `ValidationPipe` rejected the body (client bug)  | (generic)       |
| `NOT_HOST`                            | 401/403 | Domain Outcome | host action without a valid `x-host-key`         | (tailored)      |
| `NOT_PARTICIPANT`                     | 401/404 | Domain Outcome | invalid participant token or disconnected target | (tailored)      |
| `ROOM_NOT_FOUND`                      | 404     | Domain Outcome | unknown room (guest link, host-token)            | (tailored)      |
| `KNOCK_NOT_FOUND`                     | 404     | Domain Outcome | unknown / expired / withdrawn knock              | (tailored)      |
| `NAME_REQUIRED`                       | 400     | Domain Outcome | knock with no display name                       | (inline)        |
| `DIRECT_REJOIN_NOT_ALLOWED`           | 403     | Domain Outcome | no active call-scoped rejoin grant for account   | Ask to join     |
| `RECORDING_IN_PROGRESS`               | 409     | Domain Outcome | start/approve while one is already active        | (tailored)      |
| `NOT_RECORDING_OWNER`                 | 403     | Domain Outcome | `stop-by-participant` you didn't start           | (tailored)      |
| `RECORDING_NOT_READY`                 | 409     | Domain Outcome | download before the recording is `completed`     | (tailored)      |
| `RECORDING_NOT_FOUND`                 | 404     | Domain Outcome | unknown recording for the room                   | (tailored)      |
| `RECORDING_EXPIRED`                   | 410     | Domain Outcome | local MP4 was deleted after retention expiry     | (tailored)      |
| `RECORDING_SHARE_UNAVAILABLE`         | 409     | Domain Outcome | Drive was not enabled at recording start         | (tailored)      |
| `RECORDING_SHARE_NOT_ALLOWED`         | 403     | Domain Outcome | anonymous, Host, or mismatched-account consent   | (tailored)      |
| `DOWNLOAD_TOKEN_INVALID`              | 401     | Domain Outcome | missing/expired/forged recording download token  | (native)        |
| `REMOTE_CONTROL_IN_PROGRESS`          | 409     | Domain Outcome | a request/session already owns the room          | (tailored)      |
| `REMOTE_CONTROL_NOT_FOUND`            | 404     | Domain Outcome | unknown, consumed, or expired request/session    | (tailored)      |
| `REMOTE_CONTROL_NOT_ALLOWED`          | 403     | Domain Outcome | caller is not the required Sharer/Controller     | (tailored)      |
| `REMOTE_CONTROL_PRESENT_ACTIVE`       | 409     | Domain Outcome | Present is active, so control cannot start       | (tailored)      |
| `REMOTE_CONTROL_RENEWAL_REQUIRED`     | 409     | Domain Outcome | the 30-minute reconfirmation deadline passed     | (tailored)      |
| `REMOTE_CONTROL_HELPER_NOT_CONNECTED` | 409     | Domain Outcome | helper bootstrap/session is not connected        | (tailored)      |
| `REMOTE_CONTROL_BOOTSTRAP_INVALID`    | 401     | Domain Outcome | helper code is wrong, expired, or already used   | (native)        |
| `WEBHOOK_UNVERIFIED`                  | 401     | —              | bad LiveKit webhook signature (server-to-server) | n/a             |

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

### GET /rooms/:room/rejoin _(session)_

Checks whether the signed-in account has a **Direct Rejoin Grant** for the
current LiveKit room instance. No token is minted by this passive check.

**Response 200:** `{ "eligible": boolean }`. **401** if not signed in; **404** if
the Managed Room does not exist.

### POST /rooms/:room/rejoin _(session)_

Mints a fresh guest token for an eligible signed-in account after the Device
Check. The grant is revalidated against the current LiveKit room SID both before
and after minting.

**Response 200:** `{ "room", "identity", "token", "livekitUrl", "muteOnEntry" }`.
The identity is stable for the grant, so a newer tab/device replaces the older
connection. **401** if not signed in; **403 `DIRECT_REJOIN_NOT_ALLOWED`** when
the grant was revoked, the call ended, or eligibility changed during minting.

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
Admit mints the guest's join token (delivered via the guest's poll). When the
Knock belongs to a signed-in Guest, Admit also creates an account-bound Direct
Rejoin Grant for the active LiveKit room SID. Anonymous admission is unchanged.

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

Remove (kick) a connected participant. Header `x-host-key`. **Response 200:**
`{ "ok": true }`. A matching Direct Rejoin Grant and already issued participant
tokens are revoked first. Remove is not a ban: the Guest may Knock again.

### POST /rooms/:room/recordings _(host)_

Start a room-composite recording. Header `x-host-key`. One active recording per
room → **409** if one is already running. **Response 200:** a `RecordingSummary`
(`{ id, status, filename, sizeBytes, durationMs, startedAt, endedAt, error,
localExpiresAt, localDeletedAt, deliveryStatus, driveUrl, deliveredAt,
recipientShares, downloadable, downloadToken }`) with `status: "starting"`.

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
through the API; bucket credentials never reach the browser. **410**
(`RECORDING_EXPIRED`) if a formerly valid local object has passed retention.

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
It also carries opaque `recordingId` and `recordingShareAvailable` values and
clears both when the Recording ends.

### POST /rooms/:room/recording-share-consent _(session + participant)_

Make final, forward-only Drive recipient consent for the caller. Requires both a
BetterAuth session cookie and the caller's `x-participant-token`; no body.
Available only to a signed-in non-Host participant who is currently present and
whose token's opaque account proof matches the session. **200:** `{ "ok": true }`.
Anonymous Guests, Hosts, mismatched accounts, an inactive recording, or a
recording whose Drive connection was not present at start are rejected. This
creates no public link or folder permission.

## Remote Control _(post-Phase 9; docs/adr/0024)_

Remote Control is participant-authorized, not Host-authorized. All human actions
below require the caller's LiveKit join token in `x-participant-token`; the
`ParticipantGuard` derives identity/name from the signed token and never accepts
either from the body. The Host has no special stop route.

Pending requests and the single active grant live in Redis. A metadata-only
`RemoteControlSession` audit row lives in Postgres. Room metadata contains a
display-safe `remoteControl` projection while active:

```json
{
  "remoteControl": {
    "sessionId": "cm...",
    "status": "awaiting-agent",
    "sharerIdentity": "ada-ab12",
    "sharerName": "Ada",
    "controllerIdentity": "bo-cd34",
    "controllerName": "Bo",
    "agentIdentity": "control-agent:cm...",
    "agentConnected": false,
    "renewalDueAt": "2026-07-10T12:30:00.000Z"
  }
}
```

`status` becomes `active` and `agentConnected` becomes `true` after the signed
LiveKit `participant_joined` webhook observes the expected agent. The entire
`remoteControl` key is removed when the session ends. This projection contains
no bootstrap code, JWT, input, screenshot, frame, or secret content.

### POST /rooms/:room/remote-control/requests _(participant)_

The Controller requests control of a connected Sharer.

**Request:** `{ "sharerIdentity": "ada-ab12" }`

**Response 201:**

```json
{
  "requestId": "cm...",
  "room": "abz-mnpq-rfk",
  "sharerIdentity": "ada-ab12",
  "sharerName": "Ada",
  "controllerIdentity": "bo-cd34",
  "controllerName": "Bo",
  "requestedAt": "2026-07-10T12:00:00.000Z",
  "expiresAt": "2026-07-10T12:00:30.000Z",
  "expiresInMs": 30000
}
```

`expiresInMs` is calculated by the API server when it writes the response and
is clamped to `0`–`30000`. Browsers schedule and validate the consent prompt
from this server-relative value, not by comparing `expiresAt` with their local
clock. `requestedAt` and `expiresAt` remain for auditability and compatibility.

Both identities must currently be present; self-control and Control Agent
identities are rejected. Only one pending request or active session may own a
room. A current screen-share track returns
`REMOTE_CONTROL_PRESENT_ACTIVE`. After success, the Controller sends the
server-issued `requestId` to the Sharer over topic `huddle:remote-control`; that
packet is the low-latency prompt wake-up but grants nothing. A missed packet
does not lose the request: joined browsers also privately recover their own
pending request through the target-only endpoint below.

### GET /rooms/:room/remote-control/requests/pending _(participant)_

Returns the room's current, unexpired request only when the caller is its exact
Sharer. Controllers and all other participants receive `null`, so every joined
browser may use this as a short-lived polling fallback without exposing a
pending consent request room-wide.

This participant-private response sends `Cache-Control: private, no-store`.

**Response 200:**

```json
{ "request": null }
```

or:

```json
{
  "request": {
    "requestId": "cm...",
    "room": "abz-mnpq-rfk",
    "sharerIdentity": "ada-ab12",
    "sharerName": "Ada",
    "controllerIdentity": "bo-cd34",
    "controllerName": "Bo",
    "requestedAt": "2026-07-10T12:00:00.000Z",
    "expiresAt": "2026-07-10T12:00:30.000Z",
    "expiresInMs": 30000
  }
}
```

### GET /rooms/:room/remote-control/requests/:requestId _(participant)_

Only the target Sharer or requesting Controller may recover this display-safe
request. The Sharer's client calls it after receiving the addressed wake-up
packet so forged data packets cannot invent identities or consent copy.

This participant-private response sends `Cache-Control: private, no-store`.

**Response 200:** the same request summary returned by request creation.

### POST /rooms/:room/remote-control/requests/:requestId/approve _(Sharer)_

Atomically consumes the request. Only its target Sharer may approve. The API
rechecks participant presence and Present exclusion, creates the active Redis
grant and room metadata, advances the audit row to `active`, and creates a
single-use helper bootstrap.

**Response 200:**

```json
{
  "session": {
    "sessionId": "cm...",
    "status": "awaiting-agent",
    "sharerIdentity": "ada-ab12",
    "sharerName": "Ada",
    "controllerIdentity": "bo-cd34",
    "controllerName": "Bo",
    "agentIdentity": "control-agent:cm...",
    "agentConnected": false,
    "renewalDueAt": "2026-07-10T12:30:00.000Z"
  },
  "helper": {
    "bootstrapCode": "<opaque one-time bearer>",
    "expiresAt": "2026-07-10T12:02:00.000Z"
  }
}
```

The browser opens
`huddle-control://join?room=...&session=...&code=...&api=...`; the LiveKit JWT
is never placed in that URL. If Recording is active, approval is still
allowed—the web must show the strong recording warning before this call.

### POST /rooms/:room/remote-control/requests/:requestId/deny _(Sharer)_

Only the target Sharer may deny. Consumes the request and completes the audit as
`denied`.

**Response 200:** `{ "status": "denied" }`

The Sharer then sends a reliable, addressed `remote-control:denied` UI packet to
the Controller. The API decision remains authoritative.

### POST /rooms/:room/remote-control/:sessionId/helper-token _(bootstrap bearer)_

Used only by the macOS Control Agent. It deliberately does not use a participant
token: the short-lived bootstrap code in the body is the bearer. Redemption is
atomic and single-use.

**Request:** `{ "bootstrapCode": "<opaque one-time bearer>" }`

**Response 200:**

```json
{
  "token": "<short-lived LiveKit JWT>",
  "livekitUrl": "wss://livekit.example.com",
  "room": "abz-mnpq-rfk",
  "session": {
    "sessionId": "cm...",
    "sharerIdentity": "ada-ab12",
    "controllerIdentity": "bo-cd34",
    "agentIdentity": "control-agent:cm...",
    "renewalDueAt": "2026-07-10T12:30:00.000Z"
  }
}
```

The token may join only this room, subscribe to room data/metadata, and publish
only a screen-share track. It has no room admin, camera, microphone, or Host
grant. Wrong, expired, or reused codes return
`REMOTE_CONTROL_BOOTSTRAP_INVALID`.

### POST /rooms/:room/remote-control/:sessionId/bootstrap _(Sharer participant)_

Rotates the one-time Control Agent bootstrap when an approved Sharer needed to
download or install the app. The participant token must belong to the exact
Sharer in the active grant, the grant must still be awaiting its agent, and the
Sharer renewal deadline must not have passed. The previous bootstrap is revoked
before the new one is stored.

**Response 200:**

```json
{
  "bootstrapCode": "<opaque one-time bearer>",
  "expiresAt": "2026-07-10T12:08:00.000Z"
}
```

The endpoint does not create a new session or change consent. A connected agent
returns `REMOTE_CONTROL_IN_PROGRESS`; an expired grant returns
`REMOTE_CONTROL_RENEWAL_REQUIRED`; other participants return
`REMOTE_CONTROL_NOT_ALLOWED`.

Its signed participant metadata is the cross-client identity contract:
`{ "role": "control-agent", "room", "sessionId", "sharerIdentity",
"controllerIdentity", "agentIdentity" }`. Browsers use the role plus the active
grant's exact agent identity to keep the companion out of people-facing UI; the
agent checks every field against its bootstrap response and room metadata.

### POST /rooms/:room/remote-control/:sessionId/stop _(Sharer or Controller)_

Ends the active grant, clears room metadata, removes the Control Agent from
LiveKit, and completes the audit row. Only the exact Sharer or Controller in the
grant may call it. A Host who is neither gets
`REMOTE_CONTROL_NOT_ALLOWED`.

**Response 200:** `{ "status": "ended", "endedAt": "..." }`

The agent's local Stop button disconnects instead; the verified
`participant_left` webhook drives the same end path.

### POST /rooms/:room/remote-control/:sessionId/renew _(Sharer)_

Reconfirms attended consent and advances `renewalDueAt` by 30 minutes. Only the
Sharer may renew. Calling after expiry ends the grant and returns
`REMOTE_CONTROL_RENEWAL_REQUIRED`.

**Response 200:** `{ "sessionId": "cm...", "renewalDueAt": "..." }`

### Lifecycle from LiveKit webhooks

`participant_joined` marks the expected Control Agent connected. A
`participant_left` matching the grant's Sharer, Controller, or agent ends the
session. `room_finished` also ends it. The API expiry loop ends any grant whose
renewal deadline passes and records `status: "expired"`. Every end path is
idempotent.

### Remote Control data protocol

Topic: `huddle:remote-control`; JSON messages carry `v: 1`.

| type                              | sender → recipient         | purpose                                                                        |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `remote-control:request`          | Controller → Sharer        | carries a server-issued request id to wake consent UI                          |
| `remote-control:denied`           | Sharer → Controller        | transient denial UX after the API decision                                     |
| `remote-control:input`            | Controller → Control Agent | `{ sessionId, sequence, event }`; transport only, never authority              |
| `remote-control:clipboard-copy`   | Controller → Control Agent | `{ sessionId, sequence }`; injects the Sharer's native Copy shortcut           |
| `remote-control:clipboard-paste`  | Controller → Control Agent | `{ sessionId, sequence, text }`; writes bounded plain text, then injects Paste |
| `remote-control:clipboard-update` | Control Agent → Controller | `{ sessionId, revision, text }`; recipient-targeted Sharer plain-text update   |

Input events are bounded, normalized mouse `move/down/up/scroll`, keyboard `key`
down/up, and `release-all`. Pointer coordinates are in `[0,1]` of the published
desktop. Moves are lossy and coalesced; clicks, scrolls, keys, and release-all
are reliable. Clipboard messages are also reliable, use the same monotonic
authorization sequence as input, and must fit the 8 KiB on-wire packet budget;
plain text is capped at 6 KiB so JSON framing remains inside that limit. The
agent sends `clipboard-update` only to the active Controller, accepts copy/paste
only from that exact Controller, and sends no content to an HTTP endpoint or
persistent store. Empty, non-text, rich, binary, and oversized clipboard values
are rejected whole. There is no file, audio, rich-content, or binary-content
message in v1.

### GET /recordings/mine _(session)_

List **all** recordings across every room the signed-in host owns, newest first
— the lobby's cross-room recordings view (the room list itself is pared to
upcoming scheduled meetings, so this is the only path to past/instant meetings'
recordings). Requires a BetterAuth session.

**Response 200:** `{ "recordings": (RecordingSummary & { "room" })[] }`

- `room` is the owning Room Code. The download is authorized by each recording's
  signed `downloadToken` (docs/adr/0022), so no `hostKey` travels in this
  response. **401** if not signed in.

### Google Drive storage connection _(session)_

| Method | Path                                         | Result                                                                                                             |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | `/storage-connections/google-drive`          | connection state (never OAuth secrets)                                                                             |
| POST   | `/storage-connections/google-drive`          | `{ authorizationUrl }` for explicit OAuth connect                                                                  |
| GET    | `/storage-connections/google-drive/callback` | consumes one-time Redis state, then redirects to `/recordings`                                                     |
| DELETE | `/storage-connections/google-drive`          | best-effort revokes Huddle access; never deletes Drive files                                                       |
| POST   | `/storage-connections/google-drive/backfill` | makes the one optional backfill for this connection; queues retained local completed recordings without recipients |

The connect flow requests offline access and `drive.file` only. There is one
connection per Host, separate from Google sign-in. `RecordingSummary.deliveryStatus`
is `not_configured | queued | uploading | action_required | delivered |
expired_undelivered`; a Drive URL is supplied only after verified delivery.

### POST /livekit/webhook

Receive & verify LiveKit server events (signed with the API key). Verified with
`WebhookReceiver`. On `room_finished`, the API drops that room's **ephemeral
knocks**, clears Direct Rejoin Grants for the finished room SID, and ends any
Remote Control grant (the room record itself is persistent since Phase 7 and is
kept). A `participant_joined` carrying Direct Rejoin metadata is removed when
its opaque grant or room SID no longer matches server state. On
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
