# Tech Stack

Decisions and rationale. Update this doc when a choice changes.

## Summary

| Layer            | Choice                                      | Notes |
|------------------|---------------------------------------------|-------|
| Language         | TypeScript (frontend + backend)             | One language end-to-end; share types. |
| Frontend         | Next.js (App Router) + React                | SSR/routing, strong ecosystem, official LiveKit React support. |
| Realtime client  | `livekit-client`, `@livekit/components-react`, `@livekit/components-styles` | Prebuilt room/grid components + low-level control. |
| Backend          | NestJS                                      | Structured, DI-based, great for a clean token/room service and future webhooks. |
| LiveKit server   | `livekit-server-sdk` (token/admin)          | Server-side JWT minting and room API. |
| Media server     | Self-hosted LiveKit (`livekit/livekit-server`) | Open-source WebRTC SFU; full control, no per-minute cloud cost. |
| State store      | Redis                                       | Required for LiveKit multi-node; safe default. |
| Packaging        | npm or pnpm workspaces (monorepo)           | `apps/web`, `apps/api`, optional `packages/*`. |
| Containers       | Docker + docker compose                     | Run LiveKit + Redis locally and in prod. |
| Target platform  | Web browsers (desktop + mobile web)         | No native apps in scope. |

## Why these

**Next.js + React.** LiveKit ships first-class React components
(`@livekit/components-react`) that handle the participant grid, track rendering,
and controls out of the box, which dramatically shortens MVP time. Next.js gives
routing, env handling, and a clean dev server.

**NestJS for the backend.** The backend's main job is small but security-critical:
mint scoped LiveKit tokens and (later) handle webhooks and room admin. NestJS's
modular structure, dependency injection, and built-in validation pipes keep that
clean and testable as the surface grows. It pairs naturally with
`livekit-server-sdk`.

**Self-hosted LiveKit.** Chosen deliberately. We run `livekit/livekit-server` as
a container, so we control infra, data residency, and cost. Trade-off: we own the
ops (UDP/TURN ports, TLS, scaling). The `infra/` folder holds the config to make
local dev painless.

**Redis.** LiveKit needs Redis to coordinate across multiple nodes. Even for a
single-node MVP we include it so the jump to multi-node is config-only.

## Notable constraints

- **WebRTC needs UDP + TURN.** Self-hosting means exposing the right ports and
  running TURN for users behind restrictive NATs. See `docs/LIVEKIT_INTEGRATION.md`.
- **HTTPS/WSS required.** Browsers block camera/mic on insecure origins (except
  `localhost`). Plan TLS early for any non-local testing.
- **Keep the SDK versions aligned.** `livekit-client` and the server SDK evolve
  together — pin versions and upgrade them as a set.

## Things intentionally deferred

- Database / ORM — not needed until accounts or scheduling exist.
- Auth provider — MVP is anonymous.
- CI/CD, IaC, observability stack — add once the app runs end to end.

When you introduce any of these, append a row above and a short rationale here.
