# AGENTS.md

Guidance for Codex (and any AI agent) working in this repository.

## What this project is

Huddle is a self-hosted, browser-based meeting product built on LiveKit. The
repository contains a Next.js web app, NestJS API, Swift/SwiftUI macOS Control
Agent, and Docker-based local/production infrastructure.

The MVP (Phases 0–3) is historical and complete. Later calling, managed-room,
recording, deployment, attended Remote Control, Control Agent beta, and desktop
Picture-in-Picture work is present to varying levels of implementation and
acceptance. Do not infer completion from a phase number or a test alone: read
[`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md), then
[`docs/ROADMAP.md`](docs/ROADMAP.md), before changing behavior.

## Scope and security invariants

- Keep meetings browser-based. The macOS Control Agent is a narrow companion
  only for selected-display capture and approved OS input.
- Never expose the LiveKit API secret or host authority to the browser. The API
  decides identity, room scope, and grants; host actions require the server-held
  room capability.
- Managed rooms have no public token-minting endpoint. Do not reintroduce
  `POST /token` or a path that bypasses the waiting room.
- Remote Control remains attended, room-scoped, identity-bound, and renewable
  every 30 minutes. Preserve explicit consent, either-party Stop, Present
  mutual exclusion, bounded ephemeral plain-text clipboard sharing, and the
  exclusions for unattended access, files, rich/binary clipboard, and desktop
  audio.
- Treat source/build checks as insufficient for live WebRTC, physical macOS
  permissions, signed/notarized releases, external OAuth, or deployed service
  claims. Preserve the manual acceptance gaps in the roadmap.

## Target stack

| Layer                | Choice                                                                |
| -------------------- | --------------------------------------------------------------------- |
| Web / API            | Next.js (App Router, TypeScript) / NestJS (TypeScript)                |
| Live media           | Self-hosted LiveKit with the React client and server SDK              |
| State                | Postgres/Prisma for durable records; Redis for shared ephemeral state |
| Recording            | LiveKit Egress with MinIO; optional private Google Drive delivery     |
| Privileged companion | Swift/SwiftUI macOS Control Agent                                     |
| Deployment           | Docker Compose, Caddy, and embedded LiveKit TURN                      |

Full rationale is in `docs/TECH_STACK.md`.

Use pnpm workspaces. Keep secrets in environment files, never source. Update the
relevant contract, roadmap status, runbook, or ADR when a behavior or decision
changes; do not make public/deployment claims without matching external evidence.

## Common commands

```bash
pnpm infra:up / pnpm infra:down
pnpm dev:api / pnpm dev:web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
swift test --package-path apps/control-agent
```

## Conventions

- TypeScript everywhere; `strict` mode on.
- Validate all backend input (NestJS pipes / class-validator).
- Environment variables documented in `.env.example` — update it whenever you add
  a new variable.
- Small, focused commits. Update the relevant `docs/` file when you change a
  design decision.

## Where to look

| I need to know…                               | Read…                                                     |
| --------------------------------------------- | --------------------------------------------------------- |
| Documentation authority and status boundaries | `docs/DOCUMENTATION.md`                                   |
| Requirements / current phase status           | `docs/PRD.md` / `docs/ROADMAP.md`                         |
| Architecture / HTTP boundary                  | `docs/ARCHITECTURE.md` / `docs/API_CONTRACT.md`           |
| Decisions                                     | `docs/adr/README.md` and the relevant ADR                 |
| Local / production operation                  | `docs/SETUP.md` / `docs/DEPLOYMENT.md` / relevant runbook |

<!-- BEGIN @agent-native/skills -->

## Efficient Fable

When operating as Codex Fable or another explicitly Fable-class expensive model, preserve Fable for the judgment layer: decomposition, architecture and product tradeoffs, synthesis, risk calls, and final review. Delegate token-heavy research, coding, testing, file inventory, repetitive edits, and independent implementation slices to cheaper subagents when available. Write delegated prompts as self-contained handoff packets with objective, scope, out-of-scope areas, expected evidence, verification commands, and stop conditions. For testing, Fable should suggest the validation direction and important scripts or browser checks, then lighter agents can run them, reduce logs, collect screenshots, and report exact failures and likely causes. Treat delegated reports as leads: Fable should verify important cited files, failures, and high-risk diffs before relying on them. Do not make unsupported quality or speed guarantees; frame savings as workload-dependent.

<!-- END @agent-native/skills -->
