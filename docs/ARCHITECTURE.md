# Architecture

## Overview

Four application/participant-side pieces, plus the backing services:

1. **Web frontend** (Next.js) — the UI users interact with. Connects directly to
   the LiveKit server for media via the client SDK.
2. **API backend** (NestJS) — mints LiveKit access tokens, exposes room helper
   endpoints, and (later) receives LiveKit webhooks. Holds the API key/secret.
3. **LiveKit server** (self-hosted container) — the WebRTC SFU that actually
   routes audio/video between participants.
4. **Control Agent** (`apps/control-agent`, macOS) — an attended, short-lived
   companion for a Remote Control Sharer. It joins the room with a scoped
   one-time token, publishes the desktop, applies only the approved Controller's
   mouse/keyboard packets, and relays bounded plain-text clipboard updates only
   to that Controller.
5. **Redis** — required by LiveKit for state when running more than one node and
   for some features (and a sensible default even for a single node).
6. **Postgres** (Phase 7) — persists user accounts and managed rooms (scheduled
   meetings). The API talks to it via Prisma; auth tables are owned by BetterAuth.

The browser talks to the **backend over HTTPS** (to get a token) and to the
**LiveKit server over secure WebSocket + WebRTC** (for media). The backend talks
to LiveKit over its server API for admin tasks. During Remote Control, the
Control Agent also connects directly to LiveKit; input packets travel over
LiveKit, while authority remains in the backend.

## Component diagram

```
                ┌──────────────────────────────────────────┐
                │                Browser                   │
                │  Next.js app + livekit-client SDK        │
                └───────┬──────────────────────┬───────────┘
                        │ HTTPS: authority      │ WSS + WebRTC: media/data
                        ▼                       ▼
        ┌───────────────────────────┐   ┌────────────────────────────┐
        │   NestJS API (apps/api)   │   │  LiveKit server (infra)     │
        │  - participant tokens     │   │  - SFU / room management    │
        │  - room + control grants  │   │  - WebRTC, TURN, data       │
        │  - webhook receiver       │◀──┤  - lifecycle webhooks       │
        │  holds API key + secret   │   └─────────────┬──────────────┘
        └─────────────┬─────────────┘                 │
                      │ Redis + Prisma                         ▲
                      ▼                                        │
               ┌──────────────┐      ┌─────────────────────────┴┐
               │ Redis / PG   │      │ macOS Control Agent      │
               │ grant / audit│      │ screen publish + input   │
               └──────────────┘      └──────────────────────────┘
```

## Token / connection flow (the critical path)

1. User submits room + display name in the frontend.
2. Frontend calls `POST /token` on the NestJS API with `{ room, identity }`.
3. Backend uses `livekit-server-sdk` + the **API key/secret** to build a JWT
   `AccessToken` with a `VideoGrant` (e.g. `roomJoin`, `room`, `canPublish`,
   `canSubscribe`). Token is short-lived.
4. Backend returns `{ token, livekitUrl }` to the frontend.
5. Frontend connects: `room.connect(livekitUrl, token)` via `livekit-client` (or
   the `<LiveKitRoom>` component from `@livekit/components-react`).
6. Media now flows browser ↔ LiveKit server directly. The backend is no longer in
   the media path.

**Security invariant:** the API secret lives only in the backend env. The browser
only ever receives a scoped, expiring token.

## Trust boundaries

- **Untrusted:** the browser. Never accept room grants/identity from it blindly —
  the backend decides what a token is allowed to do.
- **Trusted (server-side):** NestJS API and LiveKit server, configured via env /
  `livekit.yaml`. Secrets never cross to the client.
- **Privileged but narrowly scoped:** the Control Agent can capture a display and
  inject input after macOS grants Screen Recording and Accessibility permission.
  It receives no API secret or Host authority. A LiveKit input packet is only
  transport: the agent also requires its one-time token identity and the current
  server-written Remote Control grant to match room, session, Sharer, Controller,
  and agent identities.

## Remote Control (post-Phase 9)

1. A Controller asks the API to control a connected Sharer. The API verifies the
   participant token, both room presences, no active Present track, and no active
   Remote Control grant. The request is stored in Redis and an audit row is
   created in Postgres. A reliable LiveKit data packet only wakes the Sharer's
   prompt; it is not the request's authority.
2. The Sharer approves or denies through participant-authorized API endpoints.
   Approval atomically consumes the request, creates the Redis grant with a
   30-minute renewal deadline, updates LiveKit room metadata with display-safe
   state, and returns a short-lived bootstrap code. Denial completes the audit.
3. The browser opens the signed macOS Control Agent with that code. The agent
   verifies the release policy, asks the Sharer to trust the exact API origin
   once, and redeems it for a short-lived token that may publish the selected
   screen-share track and recipient-targeted clipboard data. Its metadata binds
   all five grant identifiers. No LiveKit JWT is put in a URL.
4. The agent joins under `control-agent:<sessionId>`, waits for an explicit
   display selection and local Start confirmation, then publishes the entire
   physical selected display — menu bar, Dock, desktop, all app windows, and
   the Control Agent window — while observing server-written room metadata. The
   Sharer can change displays locally in the same session. It is filtered from
   participant lists and camera placeholders, but remains protocol-visible:
   LiveKit's native `hidden` grant also hides publications and therefore cannot
   carry the room-visible desktop.
5. The approved Controller sends versioned, session-scoped mouse/keyboard and
   clipboard-copy/paste data packets directly to that agent. The agent checks
   the SFU-attested sender, session id, controller id, renewal deadline, and
   current room metadata before injecting an event or writing the pasteboard.
   While its desktop is published it observes the Sharer's plain-text pasteboard
   and reliably sends each transferable change to that exact Controller, while
   suppressing its expected echo after a Controller paste. Mouse moves are
   lossy/coalesced; clicks, keys, and clipboard packets are reliable. Clipboard
   contents are never sent to the API, Redis, Postgres, room metadata, or logs.
6. During a display switch the agent releases held input, marks itself
   non-interactive, unpublishes the old track, publishes the replacement, and
   updates coordinate geometry before accepting input again. If the replacement
   fails, the desktop remains unpublished and the agent is retryable; browsers
   show a protected switching surface instead of another participant's video.
   Sharer or Controller may stop. A LiveKit `participant_left` webhook also ends
   the grant when the Sharer, Controller, or agent leaves. The agent's local Stop
   button disconnects it rather than exercising a third stop authority. A small
   API expiry loop ends grants that miss the 30-minute Sharer reconfirmation.

The browser can rotate an awaiting-agent bootstrap through a Sharer-authorized
endpoint. Rotation revokes the previous two-minute bearer without changing the
active consent grant, allowing first-time installation to outlive the original
launch attempt.

## Control Agent distribution

The public `/downloads` page reads the signed `control-agent-beta` manifest and
offers separate macOS arm64 and x86_64 DMGs. Windows and Linux are explicitly
marked unavailable. The agent checks the same manifest before redemption and,
when the Sharer opts in, uses an architecture-specific Sparkle appcast to
download and install only Ed25519-signed updates over HTTPS. Automatic updates
are paused during Remote Control; manual update checks remain available.
Release artifacts are signed/notarized in GitHub Actions and accompanied by
SHA-256 values.

The native app exposes a user-triggered, sanitized diagnostics copy action for
beta support (version, macOS, architecture, permission state, and connection
state only). It has no telemetry or automatic issue submission.

## Error tracking

Sentry observes the browser, Next.js server/edge runtimes, and NestJS API.
Next.js request hooks and React error boundaries capture uncaught web faults;
the API's existing global `FaultFilter` sends only 5xx faults, preserving the
Fault/Domain Outcome split. All SDKs are disabled when their DSN is blank.

Before delivery, Huddle removes user data, headers, cookies, bodies, queries,
console breadcrumbs, and room/session identifiers. Performance tracing and
Session Replay are disabled. The Control Agent is outside this integration and
retains the user-triggered sanitized-diagnostics flow above. See ADR 0027.

Remote Control and Present are mutually exclusive. The API checks for a Present
track on request and approval; the web disables Present for every participant
while Remote Control metadata exists. Recording remains allowed, with an
explicit approval warning that the room-visible desktop may be recorded.

## Data & persistence

- MVP stored **no media** and needed **no database**. Phases 6–7 changed this.
- **Phase 6:** rooms became _managed_ — waiting-room knocks live in-memory in the
  API process (ephemeral, single-node; Redis migration is Phase 9).
- **Phase 7:** accounts and scheduled rooms persist in **Postgres** via **Prisma**
  (`apps/api/prisma/schema.prisma`). Schema:
  - `user`, `session`, `account`, `verification` — owned by **BetterAuth**
    (created via Prisma migration; do not hand-edit their shape).
  - `room` — a managed room: `slug` (unique; also the LiveKit room name),
    `title`, `scheduledStart?`, `hostKey` (per-room host capability), `hostUserId`
    (owner). Rooms now **survive an API restart**; knocks do not.
  - `recording` (**Phase 8**) — one row per egress job: `egressId`, `roomId`,
    `status` (`starting`→`active`→`completed`/`failed`), `objectKey` (path in the
    S3 bucket), `sizeBytes?`, `durationMs?`, and local-expiry/deletion times.
    Lifecycle is webhook-driven; metadata survives local-object deletion.
  - `cloud_storage_connection` — one encrypted optional Google Drive connection
    per Host account; it is distinct from BetterAuth Google sign-in.
  - `recording_delivery` — leased/retryable Google resumable-upload state and
    verified Drive identity; its refresh/session secrets are encrypted at rest.
  - `recording_recipient` — a per-Recording snapshot of an eligible
    participant's consent and Drive permission outcome.
  - `remote_control_session` — metadata-only attended-control audit: participant
    and agent identities/names, status, start/end/renewal timestamps, and end
    reason. It never stores input, clipboard, screenshots, frames, or secrets.
- **Phase 9:** Redis holds waiting-room Knocks and call-scoped Direct Rejoin
  Grants. A grant binds the signed-in account to the Room Code, active LiveKit
  room SID, stable participant identity, and opaque grant ID. It has no database
  row and cannot become standing access to a later call.
- Media is now stored too (Phase 8): recordings live in **MinIO** (S3-compatible
  object store), not in Postgres — the DB only holds the recording metadata above.
  ADR-0029 makes the MinIO object a temporary Local Recording Copy rather than
  indefinite storage.

## Recording (Phase 8)

- The host records the **composited room** (grid + mixed audio) to a single MP4
  via LiveKit **Egress** (`startRoomCompositeEgress`). Egress runs as its own
  container (bundled headless Chrome joins the room and composites it).
- The file uploads to **MinIO** (`minio` container). The S3 target is built from
  the **API's** env and passed to Egress per request, so the egress container
  holds no storage creds. The API reaches MinIO on two endpoints: host-facing
  (`S3_ENDPOINT`) to read files back for download, and the in-network one
  (`S3_ENDPOINT_INTERNAL`, `minio:9000`) it hands to Egress for uploads.
- **Authority:** recording is **host-only**, gated by `x-host-key` (same as
  admit/mute/remove), not the session. Downloads are **proxied** through the
  host-authorized API — bucket credentials never reach the browser. See
  `docs/adr/0003-recording-egress-minio.md`.
- **Retention and delivery:** completed MP4s have a hard configured local
  deadline (168 hours by default). A separate `recording-worker` process from
  the API image leases one delivery at a time in PostgreSQL, heartbeats while it
  range-reads MinIO into 8 MiB Google Drive resumable chunks, and only shortens
  retention after exact-size/non-trashed Drive verification. It deletes MinIO
  objects, never metadata or Drive files. See ADR-0029.
- **Participant sharing:** Drive starts private. A signed-in non-Host can make a
  final call-scoped opt-in while a Drive-enabled Recording is active. The API
  binds their session to an opaque HMAC proof in the LiveKit token and creates
  only a per-file reader permission for recordings they actually overlap.

## Accounts & auth (Phase 7)

- **BetterAuth** is the auth system, mounted inside the NestJS API at
  `/api/auth/*` (via `toNodeHandler`; see `apps/api/src/auth/auth.ts`).
  better-auth is ESM-only, so it's loaded through a dynamic `import()` from the
  CommonJS Nest app and built once, lazily (`getAuth()`).
- Login is **local email + password** (BetterAuth `emailAndPassword`), with
  **Google** as an optional social provider (wired only when its env is set).
- Two independent authorities, deliberately kept separate:
  - **Session** (BetterAuth cookie) — "who is signed in". Required to _create_,
    _list_, or host-rejoin a room you own, and to exercise a Guest's Direct
    Rejoin Grant (`AuthGuard`). Read with `auth.api.getSession`.
  - **Host key** (per-room secret, `x-host-key`) — "are you this room's host".
    Authorizes in-call host actions (admit/deny/mute/remove) and is independent of
    the session, so a guest is never trusted via the token's role claim
    (`HostGuard`, now backed by the persisted room).
  - **Direct Rejoin Grant** (Redis) — "was this signed-in Guest admitted to this
    active call". It survives departure, uses one stable LiveKit identity, and is
    revoked by host Remove or the matching `room_finished` SID (ADR 0028).
- Cross-origin in dev: web is `:3000`, API is `:3001`. CORS runs with
  `credentials: true` and the client sends `credentials: "include"` so the session
  cookie travels. The auth routes read the raw request body, so body parsing is
  configured per-route in `main.ts` (raw for `/api/auth`, JSON elsewhere — the
  JSON parser also captures raw bytes for the LiveKit webhook signature).

## Scaling path (document now, build later)

- Single self-hosted LiveKit node handles small rooms (MVP target ~8/room).
- To scale: run multiple LiveKit nodes sharing **Redis**, front them with a load
  balancer, and ensure proper UDP/TURN port exposure. See
  `docs/LIVEKIT_INTEGRATION.md` for ports and config.

## Environments

- **Local dev:** everything via `infra/docker-compose.yml` (LiveKit + Redis) plus
  `npm run dev` for web and `npm run start:dev` for api.
- **Production:** LiveKit + Redis on a host with public UDP ports and TLS; web and
  api deployed behind HTTPS. Detailed deploy guide is a later-phase doc.
