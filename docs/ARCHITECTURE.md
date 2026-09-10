# Architecture

This is the current architecture for the checked-out repository. It describes
implemented boundaries and configuration, not proof that a deployment, provider,
or physical device has accepted them. Read [DOCUMENTATION.md](./DOCUMENTATION.md)
for that distinction and [ROADMAP.md](./ROADMAP.md) for remaining acceptance.

## System shape

```text
Browser ── HTTPS/API ──> Next.js web <──> NestJS API ──> Postgres
   │                              │              └──> Redis
   │                              │              └──> MinIO
   └──── WebRTC / data ───────────┴─────────────> LiveKit
                                                     │
                                              Egress (recording)

macOS / Windows Control Agent ── bootstrap/API + LiveKit ─────┘
```

- **Next.js (`apps/web`)** renders the meeting product and connects to LiveKit;
  it does not proxy media.
- **NestJS (`apps/api`)** owns authentication, managed-room decisions, token
  minting, host authority checks, webhooks, recordings, Remote Control grants,
  and maintenance admission control.
- **LiveKit (`infra/livekit.yaml`)** is the self-hosted SFU. Browsers and the
  Control Agent exchange media and permitted data through it directly.
- **Egress** joins a room to create a composited recording and uploads it to
  MinIO. The API supplies the per-request storage target rather than giving the
  Egress container permanent S3 credentials.
- **Caddy** is the production front door. Compose Caddy is the default;
  `HUDDLE_FRONT_DOOR=host` delegates HTTPS/WSS to an explicitly configured host
  Caddy. Media, TURN, and UDP still reach LiveKit directly.

## Managed-room and media flow

There is deliberately no public `POST /token` endpoint. It was removed because
it bypassed room admission.

1. A signed-in Host creates a managed Room Code through `POST /rooms`. The API
   persists ownership and the opaque host capability, then mints a scoped host
   token.
2. A Guest opens the Room Code link, completes Device Check, and creates a
   Knock. The Host admits or denies it with the room capability. Admission
   mints the Guest's scoped token.
3. An eligible signed-in Guest may use a Redis-backed Direct Rejoin Grant only
   for that active LiveKit room SID; it is not standing room membership.
4. The browser connects to the browser-facing LiveKit URL. Camera, microphone,
   screen-share, chat, and permitted in-call data move directly between client
   and LiveKit.
5. Webhooks validate lifecycle events and clean up call-scoped state. The API
   secret remains in server configuration; a browser sees only its own expiring
   participant token.

The public HTTP boundary and fault behavior are in
[API_CONTRACT.md](./API_CONTRACT.md). The controller and guard implementation in
`apps/api/src/rooms/` is the executable source for authorization details.

## Trust and authority boundaries

- **Browser:** untrusted for identity, room authority, and token grants. It
  never receives the LiveKit API secret, storage credentials, or another
  participant's host authority.
- **Session:** BetterAuth establishes who is signed in. It is needed to create,
  list, or host-rejoin rooms and to exercise a Guest's Direct Rejoin Grant.
- **Host capability:** the opaque per-room `x-host-key` authorizes in-call host
  operations independently of a LiveKit metadata role. A token's `role: host`
  is display information, not authority.
- **LiveKit:** is trusted as the authenticated media/data transport and webhook
  producer, but privileged decisions remain server-backed.
- **Control Agent:** receives neither host authority nor the API secret. It may
  capture a selected display and inject input only after local macOS permission,
  one-time bootstrap redemption, a server-backed grant, and sender/session
  validation all agree.

## Data ownership and retention

| Store             | Durable?                      | Current use                                                                                                                                                          |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres / Prisma | Yes                           | BetterAuth records, managed rooms and host capabilities, recording metadata/delivery state, Remote Control audit metadata, and maintenance state/cleanup queue       |
| Redis             | No; TTL/call-scoped           | LiveKit coordination, Knocks, Direct Rejoin Grants, recording consent indexes, Remote Control requests/grants/bootstrap codes, and one-time Google Drive OAuth state |
| MinIO             | Temporary media object store  | Recording MP4s until the configured local-retention/deletion workflow removes them                                                                                   |
| Google Drive      | Optional external destination | Host-connected private recording delivery after explicit configuration and eligible participant consent                                                              |

Postgres never stores recording media, screen frames, Remote Control input,
clipboard content, bootstrap codes, or LiveKit API credentials. Redis is
coordination state, not a durable system of record. See ADRs 0003, 0005, 0024,
0026, 0028, and 0029 for the rationale.

## Recording and delivery

Hosts start/stop room-composite Egress recordings through host-authorized API
routes. The API tracks the Egress lifecycle from signed webhooks, lists
recordings, and issues short-lived native-download tokens; bucket credentials do
not reach the browser. The separate `recording-worker` process leases optional
Google Drive delivery through Postgres and deletes the local MinIO object only
after the delivery safeguards documented in ADR 0029.

The source and automated checks do not prove a Google project, provider policy,
email notification, or real Egress media acceptance. Keep those explicit in the
recording runbooks and roadmap.

## Attended Remote Control

Remote Control is a privileged, attended extension of an active call, not a
general remote-support system:

1. A connected Controller asks to control a connected Sharer. The API checks
   room presence, Present mutual exclusion, and exclusive Redis state.
2. The Sharer explicitly approves. The API creates audit metadata and an
   identity-bound, renewable grant; LiveKit room metadata is display state, not
   the authority.
3. The Sharer launches the native agent with a short-lived one-time bootstrap.
   After origin trust, platform-local permissions or optional Windows elevation,
   selected-display choice, and local Start, the agent publishes the entire
   physical display.
4. Only the approved Controller's versioned, session-scoped packets are
   accepted. The Agent verifies the sender and current grant before injecting
   input or handling an allowed clipboard action.
5. Either person, the agent, lifecycle webhooks, or expiry can end the session.
   Sharer reconfirmation is required every 30 minutes.

The feature excludes unattended access, support codes outside a room, files,
rich/binary clipboard, desktop audio, and unsupported-platform agents. Plain-text clipboard
sharing is bounded, recipient-targeted, and ephemeral: no clipboard payload may
enter HTTP, Redis, Postgres, room metadata, logs, recordings, or audit records.
The complete decision record is [ADR 0024](./adr/0024-attended-remote-control-macos-agent.md),
[ADR 0032](./adr/0032-windows-control-agent.md),
[ADR 0034](./adr/0034-windows-control-agent-x86.md), and
[ADR 0026](./adr/0026-plain-text-clipboard-sharing.md).

## Control Agent distribution

The checkout contains a Downloads surface, release-manifest verification,
architecture-specific packaging scripts, and a GitHub Actions release workflow.
Trusted Developer ID signing/notarization needs external credentials; the
separate no-cost Apple-Silicon path is intentionally ad-hoc signed and requires
an explicit Gatekeeper override. Do not claim a public release, notarization, or
physical acceptance from the presence of those files alone. See ADR 0025 and
`apps/control-agent/README.md`.

## Maintenance

The owner-configured maintenance service is an admission/shutdown policy, not a
replacement for authorization. It persists its deadline, blocks new meetings,
joins, admissions, recording starts, and new Remote Control grants, then the
worker ends active calls and retries cleanup. The browser-facing maintenance
surface and Caddy static override are separate recovery paths. See
[RUNBOOK_MAINTENANCE.md](./RUNBOOK_MAINTENANCE.md) and the maintenance API in
[API_CONTRACT.md](./API_CONTRACT.md).

## Environments and scaling boundary

- **Local:** `.env`, `pnpm infra:up`, `pnpm dev:api`, and `pnpm dev:web`; see
  [SETUP.md](./SETUP.md). Local tunnel testing is a same-LAN HTTPS path, not a
  production topology.
- **Production:** base Compose plus `docker-compose.prod.yml` and `.env.prod`.
  Compose Caddy is the default; host Caddy is an explicit per-VPS option. See
  [DEPLOYMENT.md](./DEPLOYMENT.md). It targets one VPS.
- **Future scale:** LiveKit is configured to share Redis and can be extended to
  additional SFUs, but every node needs its own reachable UDP/TURN network path.
  The checkout does not establish that a multi-node deployment has been run.
