# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository.

## What this project is

A self-hosted, browser-based video conferencing app (a Google Meet–style product)
built on **LiveKit** (open-source WebRTC SFU). The app is **implemented through
Phase 9** (all roadmap phases done): `apps/web` (Next.js) + `apps/api` (NestJS),
with `infra/` holding the dev and prod (`docker-compose.prod.yml`) stacks.

Read the docs in `docs/` first — especially `docs/ROADMAP.md` (phase status) and
the ADRs in `docs/adr/` — before changing anything.

## Scope (read this before building)

The first milestone is an **MVP**, not full Meet parity. Build only what the
current phase calls for. See `docs/ROADMAP.md` for phases and `docs/PRD.md` for
exact requirements.

MVP = create/join a room, publish & subscribe to camera + mic, participant grid,
mute/unmute, leave call. Screen share, chat, recording, and scheduling are
**later phases** — do not build them unless the active phase says so.

## Target stack

| Layer        | Choice                                         |
| ------------ | ---------------------------------------------- |
| Frontend     | Next.js (App Router, TypeScript, React)        |
| Realtime UI  | `@livekit/components-react`, `livekit-client`  |
| Backend      | NestJS (TypeScript)                            |
| Token mgmt   | `livekit-server-sdk` (server-side JWT)         |
| Media server | Self-hosted LiveKit (`livekit/livekit-server`) |
| State store  | Redis (required for LiveKit multi-node)        |
| Platform     | Web browsers only (desktop + mobile web)       |

Full rationale is in `docs/TECH_STACK.md`.

## Intended repo layout (create as you build)

```
.
├── CLAUDE.md                # this file
├── README.md
├── docs/                    # planning & design docs (source of truth)
├── infra/                   # LiveKit + Redis config, docker-compose
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # NestJS backend (token + room service)
├── packages/                # shared TS types/utils (optional, add when needed)
├── .env.example
└── .gitignore
```

Use a workspace/monorepo (npm or pnpm workspaces). Keep frontend and backend in
separate apps under `apps/`. Do not put secrets in code — read from env.

## Key architectural rules

- **The browser never gets the LiveKit API secret.** The NestJS backend mints a
  short-lived JWT access token per participant; the frontend uses that token to
  connect directly to the LiveKit server over WebRTC.
- **LiveKit server is infra, not app code.** It runs as a container (see
  `infra/`). The app talks to it via the client SDK (media) and server SDK
  (tokens, room admin, webhooks).
- **Keep token logic on the server.** Identity, room name, and grants are decided
  server-side, never trusted from the client.
- See `docs/ARCHITECTURE.md` and `docs/LIVEKIT_INTEGRATION.md` for the full flow.

## Common commands (fill in as code lands)

These are the intended commands; wire them up when scaffolding each app.

```bash
# infra: start self-hosted LiveKit + Redis locally
docker compose -f infra/docker-compose.yml up -d

# backend (apps/api)
npm run start:dev        # NestJS in watch mode

# frontend (apps/web)
npm run dev              # Next.js dev server

# quality gates (add real scripts when set up)
npm run lint
npm run test
npm run build
```

## Conventions

- TypeScript everywhere; `strict` mode on.
- Validate all backend input (NestJS pipes / class-validator).
- Environment variables documented in `.env.example` — update it whenever you add
  a new variable.
- Small, focused commits. Update the relevant `docs/` file when you change a
  design decision.

## Where to look

| I need to know…            | Read…                         |
| -------------------------- | ----------------------------- |
| What to build & acceptance | `docs/PRD.md`                 |
| Build order / phases       | `docs/ROADMAP.md`             |
| System design & data flow  | `docs/ARCHITECTURE.md`        |
| Stack choices & why        | `docs/TECH_STACK.md`          |
| LiveKit specifics & tokens | `docs/LIVEKIT_INTEGRATION.md` |
| HTTP API shape             | `docs/API_CONTRACT.md`        |
| Local setup steps          | `docs/SETUP.md`               |
| Deploying to a VPS         | `docs/DEPLOYMENT.md`          |

```

```
