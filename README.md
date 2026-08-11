# Huddle — Self-hosted video conferencing (LiveKit)

A browser-based, Google Meet–style video conferencing app built on a
**self-hosted [LiveKit](https://livekit.com/)** WebRTC server. Hosts sign in to
create or schedule meetings; guests join from a shared link through a waiting
room — no account needed.

> **Status:** Feature-complete through Phase 9, with attended Remote Control
> (Phase 10) implemented behind the macOS companion-agent workflow. Core calling,
> host controls, accounts/scheduling, recording, and single-VPS deploy hardening
> are all implemented. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for per-phase
> detail and verification notes.

## Features

- **Calls** — create/join a room, camera + mic publishing, live participant
  grid, mute/camera toggles, leave. Device **pre-join** screen with self-preview
  and connection-state UI.
- **Screen share & in-call chat** — via the prebuilt LiveKit components (data
  channel chat, screen-share auto-focus).
- **Accounts & scheduling** — email+password (and optional Google) sign-in via
  BetterAuth; hosts create or schedule meetings that persist and get a stable
  shareable link.
- **Host controls & waiting room** — guests knock and wait; the host admits/denies,
  and can mute or remove participants in-call. Host authority is enforced
  server-side via a per-room host key.
- **Recording** — host-toggled room-composite recording via LiveKit Egress to
  self-hosted MinIO (S3), downloaded back through the host-authorized API.
- **Attended Remote Control** — Sharer-approved, room-scoped mouse/keyboard
  control through a signed macOS Control Agent; bounded ephemeral plain-text
  Clipboard Sharing; no unattended access, file transfer, or desktop audio.
- **Licensing and demo** — Apache-2.0 self-hosted software. The official
  deployment is a capacity-limited evaluation demo; operators provide their own
  infrastructure and provider costs for production use.
- **Deploy hardening** — Caddy TLS front door, embedded TURN, Redis-backed knock
  state, `/health` + `/ready`, JSON logs, and a production compose override.

## Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind) + LiveKit React components
- **Backend:** NestJS (TypeScript) — token minting, managed rooms, auth, recording
- **Media:** self-hosted LiveKit server + LiveKit Egress (recording)
- **Data:** Postgres (Prisma) for accounts/rooms · Redis for LiveKit + knock state
- **Storage:** MinIO (S3-compatible) for recordings
- **Auth:** BetterAuth (mounted in the API at `/api/auth/*`)
- **Edge (prod):** Caddy (automatic HTTPS/WSS) · embedded TURN
- **Tooling:** pnpm workspaces, Docker Compose, Husky + lint-staged
- **Control Agent:** Swift 6 / SwiftUI + LiveKit Swift SDK 2.15.1 (macOS 13+)

## Quick start (local dev)

```bash
cp .env.example .env          # then fill in secrets — see docs/SETUP.md
pnpm install                  # install workspace deps
pnpm infra:up                 # LiveKit, Redis, Postgres, MinIO, Egress (Docker)
pnpm dev:api                  # NestJS API   (http://localhost:3001)
pnpm dev:web                  # Next.js app  (http://localhost:3000)
```

Full setup, required env vars, and the manual two-window call smoke test are in
[`docs/SETUP.md`](docs/SETUP.md). To deploy to a VPS, see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

> **Heads-up for AV testing:** WebRTC media can't be exercised in a headless/CI
> browser, so live audio/video is verified manually (two browser windows on the
> same machine at `localhost`). The app also needs LiveKit to advertise a
> reachable IP — set `LIVEKIT_NODE_IP` to your machine's LAN IP in `.env`.

## Common commands

```bash
pnpm infra:up / pnpm infra:down   # start/stop the Docker stack
pnpm dev:api / pnpm dev:web        # run API / web in watch mode
pnpm lint                          # eslint across workspaces
pnpm typecheck                     # tsc --noEmit across workspaces
pnpm test                          # unit tests (API)
pnpm build                         # build all workspaces
swift test --package-path apps/control-agent  # Control Agent core tests
./apps/control-agent/scripts/build-app.sh     # local unsigned macOS app
```

A Husky pre-commit hook runs prettier (lint-staged) + typecheck + tests.

## Documentation

| Doc                                                        | Purpose                                        |
| ---------------------------------------------------------- | ---------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                     | Guide for AI agents / Claude Code working here |
| [docs/PRD.md](docs/PRD.md)                                 | Product requirements + acceptance criteria     |
| [docs/ROADMAP.md](docs/ROADMAP.md)                         | Phased build order + what's done               |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | System design, data flow, auth model           |
| [docs/TECH_STACK.md](docs/TECH_STACK.md)                   | Stack choices & rationale                      |
| [docs/LIVEKIT_INTEGRATION.md](docs/LIVEKIT_INTEGRATION.md) | LiveKit specifics, tokens, ports               |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md)               | Backend HTTP API                               |
| [docs/SETUP.md](docs/SETUP.md)                             | Run everything locally                         |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                   | Deploy to a single VPS                         |
| [docs/adr/](docs/adr/)                                     | Architecture decision records                  |

## Repo layout

```
apps/web      # Next.js frontend (App Router)
apps/api      # NestJS backend — tokens, rooms, auth, recording, webhooks
infra/        # docker-compose (dev + prod), LiveKit/Caddy config
docs/         # design docs + ADRs (source of truth)
```
