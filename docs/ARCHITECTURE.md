# Architecture

## Overview

Three independent pieces, plus Redis:

1. **Web frontend** (Next.js) — the UI users interact with. Connects directly to
   the LiveKit server for media via the client SDK.
2. **API backend** (NestJS) — mints LiveKit access tokens, exposes room helper
   endpoints, and (later) receives LiveKit webhooks. Holds the API key/secret.
3. **LiveKit server** (self-hosted container) — the WebRTC SFU that actually
   routes audio/video between participants.
4. **Redis** — required by LiveKit for state when running more than one node and
   for some features (and a sensible default even for a single node).
5. **Postgres** (Phase 7) — persists user accounts and managed rooms (scheduled
   meetings). The API talks to it via Prisma; auth tables are owned by BetterAuth.

The browser talks to the **backend over HTTPS** (to get a token) and to the
**LiveKit server over secure WebSocket + WebRTC** (for media). The backend talks
to LiveKit over its server API for admin tasks.

## Component diagram

```
                ┌──────────────────────────────────────────┐
                │                Browser                     │
                │  Next.js app + livekit-client SDK          │
                └───────┬───────────────────────┬────────────┘
                        │ 1) HTTPS: get token    │ 2) WSS + WebRTC: media
                        ▼                        ▼
        ┌───────────────────────────┐   ┌────────────────────────────┐
        │   NestJS API (apps/api)   │   │  LiveKit server (infra)     │
        │  - POST /token            │   │  - SFU / room management    │
        │  - room helpers           │   │  - WebRTC, TURN             │
        │  - webhook receiver (L8+) │◀──┤  - webhooks (later phase)   │
        │  holds API key + secret   │   └─────────────┬──────────────┘
        └─────────────┬─────────────┘                 │
                      │ server SDK (admin/token)       │ state
                      └────────────────┐               ▼
                                       │        ┌──────────────┐
                                       └───────▶│    Redis     │
                                                └──────────────┘
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
- We still store **no media** — recording is Phase 8.

## Accounts & auth (Phase 7)

- **BetterAuth** is the auth system, mounted inside the NestJS API at
  `/api/auth/*` (via `toNodeHandler`; see `apps/api/src/auth/auth.ts`).
  better-auth is ESM-only, so it's loaded through a dynamic `import()` from the
  CommonJS Nest app and built once, lazily (`getAuth()`).
- Login is **social only**: Sign in with Google and Sign in with Apple. The Apple
  "client secret" is a short-lived ES256 JWT minted at boot from the team key.
- Two independent authorities, deliberately kept separate:
  - **Session** (BetterAuth cookie) — "who is signed in". Required to _create_,
    _list_, or _rejoin_ a room you own (`AuthGuard`). Read with `auth.api.getSession`.
  - **Host key** (per-room secret, `x-host-key`) — "are you this room's host".
    Authorizes in-call host actions (admit/deny/mute/remove) and is independent of
    the session, so a guest is never trusted via the token's role claim
    (`HostGuard`, now backed by the persisted room).
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
