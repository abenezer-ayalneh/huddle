# Tech stack

This document records selected technologies and why they remain appropriate for
Huddle. Package manifests and lockfiles are the source for exact versions;
[ARCHITECTURE.md](./ARCHITECTURE.md) describes how the pieces currently interact.

| Layer                | Choice                                                  | Rationale / boundary                                                                                                     |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Web                  | Next.js App Router, React, TypeScript                   | Browser meeting experience, routing, and server-rendered product surfaces                                                |
| Call UI              | `livekit-client` plus selected LiveKit React primitives | LiveKit media/state integration; Huddle owns the call UI rather than using the stock conference shell                    |
| API                  | NestJS, TypeScript                                      | Server-side authorization, tokens, room administration, webhooks, and operational policies                               |
| Database             | Postgres with Prisma                                    | Durable accounts, managed rooms, recording/delivery metadata, Remote Control audit metadata, maintenance state           |
| Ephemeral state      | Redis / `ioredis`                                       | LiveKit coordination and TTL/call-scoped state; never the durable media or account store                                 |
| Media                | Self-hosted LiveKit                                     | Operator-controlled WebRTC SFU, data channels, TURN, and Egress integration                                              |
| Recording            | LiveKit Egress and MinIO (S3-compatible)                | Composited recording with self-hosted temporary object storage; optional private Drive delivery is separately configured |
| Privileged companion | Swift 6, SwiftUI, LiveKit Swift SDK                     | Native macOS permissions and input injection only where browsers cannot provide them                                     |
| Observability        | Structured JSON logging and Sentry web/API SDKs         | Privacy-scrubbed unexpected-fault reporting; no Control Agent telemetry                                                  |
| Operations           | pnpm workspaces, Docker Compose, Caddy                  | Reproducible local stack and single-VPS deployment shape                                                                 |

## Constraints that shape the design

- The browser must never receive the LiveKit API secret, storage credentials, or
  host capability. The API mints scoped, expiring participant tokens.
- WebRTC needs reachable UDP/TURN networking and HTTPS/WSS outside localhost.
  A reverse proxy does not carry media UDP.
- Remote Control stays attended and macOS-first. It has explicit consent,
  server-backed identity binding, 30-minute renewal, and no file transfer,
  desktop audio, unattended access, or rich/binary clipboard transfer.
- A self-hosted deployment owns its infrastructure, provider accounts, retention
  policy, and legal/operational decisions. This repository does not provide a
  hosted SaaS control plane.

## Deferred or externally verified work

Linux Control Agents, full multi-node operation, metrics dashboards, and
physical/provider acceptance remain outside what the source tree proves. The
Windows Control Agent source and release workflow still require their documented
physical-device acceptance matrix.
The current roadmap is authoritative for the work that is intentionally pending.
