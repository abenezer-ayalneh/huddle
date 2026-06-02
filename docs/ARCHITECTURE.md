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

- MVP stores **no media** and needs **no database**. Rooms are ephemeral; LiveKit
  tracks live state in memory/Redis.
- Add a database only when accounts, scheduling, or persistence land (later phase).
  When that happens, document the schema here.

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
