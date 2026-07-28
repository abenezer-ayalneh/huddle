# Tech Stack

Decisions and rationale. Update this doc when a choice changes.

## Summary

| Layer           | Choice                                                                      | Notes                                                                           |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Languages       | TypeScript (web + API), Swift (macOS Control Agent)                         | Browser-first app plus one narrow privileged native helper.                     |
| Frontend        | Next.js (App Router) + React                                                | SSR/routing, strong ecosystem, official LiveKit React support.                  |
| Realtime client | `livekit-client`, `@livekit/components-react`, `@livekit/components-styles` | Prebuilt room/grid components + low-level control.                              |
| Backend         | NestJS                                                                      | Structured, DI-based, great for a clean token/room service and future webhooks. |
| Control Agent   | Swift 6 + SwiftUI + LiveKit Swift SDK                                       | Signed/notarized macOS helper for screen capture and input injection.           |
| LiveKit server  | `livekit-server-sdk` (token/admin)                                          | Server-side JWT minting and room API.                                           |
| Media server    | Self-hosted LiveKit (`livekit/livekit-server`)                              | Open-source WebRTC SFU; full control, no per-minute cloud cost.                 |
| State store     | Redis                                                                       | Required for LiveKit multi-node; safe default.                                  |
| Packaging       | npm or pnpm workspaces (monorepo)                                           | `apps/web`, `apps/api`, optional `packages/*`.                                  |
| Containers      | Docker + docker compose                                                     | Run LiveKit + Redis locally and in prod.                                        |
| Error tracking  | Sentry (`@sentry/nextjs`, `@sentry/nestjs`)                                 | Privacy-scrubbed web/API faults; no native-agent telemetry.                     |
| Target platform | Web browsers; macOS first for Remote Control                                | Calls stay browser-based; only Sharers need the native helper.                  |

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

**Swift/SwiftUI Control Agent.** Browsers cannot inject mouse or keyboard input
into the operating system. Remote Control therefore adds a narrow native macOS
helper instead of moving the whole call into a desktop app. The helper uses the
official LiveKit Swift SDK to join the same room, macOS screen capture to publish
the desktop, and Core Graphics Accessibility APIs to apply approved input. It is
distributed as a Developer ID signed and notarized beta app; Windows and Linux
are outside v1.

**Sentry error tracking.** The browser, Next.js server/edge runtimes, and NestJS
API report unexpected errors to separate Sentry projects. Expected 4xx Domain
Outcomes stay quiet, performance tracing and Session Replay are disabled, and a
local scrubber removes request/user data and room-scoped identifiers before
delivery. The Control Agent retains its no-telemetry boundary. See
`docs/adr/0027-sentry-error-tracking.md`.

## Notable constraints

- **WebRTC needs UDP + TURN.** Self-hosting means exposing the right ports and
  running TURN for users behind restrictive NATs. See `docs/LIVEKIT_INTEGRATION.md`.
- **HTTPS/WSS required.** Browsers block camera/mic on insecure origins (except
  `localhost`). Plan TLS early for any non-local testing.
- **Keep the SDK versions aligned.** `livekit-client` and the server SDK evolve
  together — pin versions and upgrade them as a set.
- **Remote Control is privileged and attended.** The Control Agent requests
  Screen Recording and Accessibility access, joins only with a one-time helper
  token, and accepts input only while a server-backed grant is current.

## Things intentionally deferred

- Additional native platforms for Remote Control (Windows/Linux).
- Rich/binary clipboard transfer, file transfer, remote audio, and unattended
  access. Plain-text Clipboard Sharing is an attended Remote Control capability.
- IaC and metrics dashboards — add when the deployment needs them. Error
  tracking and structured logs are now present; Sentry intentionally covers the
  web/API only.

When you introduce any of these, append a row above and a short rationale here.
