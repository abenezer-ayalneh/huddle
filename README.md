# vid- — Self-hosted video conferencing (LiveKit)

A browser-based, Google Meet–style video conferencing app built on a
**self-hosted [LiveKit](https://livekit.com/)** WebRTC server.

> **Status:** Planning stage. This repo currently contains design docs and infra
> config — application code has not been written yet. Start with the docs below.

## Stack

- **Frontend:** Next.js (App Router, TypeScript) + LiveKit React components
- **Backend:** NestJS (TypeScript) — mints LiveKit access tokens
- **Media:** self-hosted LiveKit server (Docker) + Redis
- **Platform:** web browsers (desktop + mobile web)

## First milestone

An **MVP**: create/join a room, publish camera+mic, see a live participant grid,
mute/camera toggles, and leave — running against the self-hosted LiveKit server.
Screen share, chat, recording, and scheduling come later. See
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | Guide for AI agents / Claude Code working here |
| [docs/PRD.md](docs/PRD.md) | What the MVP must do + acceptance criteria |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased build order |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & data flow |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Stack choices & rationale |
| [docs/LIVEKIT_INTEGRATION.md](docs/LIVEKIT_INTEGRATION.md) | LiveKit specifics, tokens, ports |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | Backend HTTP API |
| [docs/SETUP.md](docs/SETUP.md) | Run everything locally |

## Quick start (infra only — apps come in Phase 0)

```bash
cp .env.example .env          # then set a real LIVEKIT_API_SECRET
docker compose -f infra/docker-compose.yml up -d
```

Then follow [`docs/SETUP.md`](docs/SETUP.md).

## Intended layout

```
apps/web    # Next.js frontend      (to be scaffolded)
apps/api    # NestJS backend        (to be scaffolded)
infra/      # LiveKit + Redis config
docs/       # design docs (source of truth)
```
