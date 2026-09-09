# Local Setup

How to run the current local stack. This is a local-development guide; it does
not prove production, real-device WebRTC, macOS-permission, or provider-account
acceptance. See [DOCUMENTATION.md](./DOCUMENTATION.md) for those boundaries.

## Prerequisites

- Node.js 20+ and pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker + Docker Compose (Docker Desktop on macOS/Windows)
- A modern browser

## 1. Clone & configure env

```bash
cp .env.example .env
```

Generate a strong API secret and put it in `.env`:

```bash
# example: a random secret
openssl rand -hex 32
```

Set at least:

```
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<paste generated secret>
LIVEKIT_KEYS=devkey: <paste the same generated secret>
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_NODE_IP=<your LAN IP, e.g. 192.168.1.100>   # macOS: ipconfig getifaddr en0
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
```

Local CORS accepts the equivalent loopback origins (`127.0.0.1` and `::1`) on
the same port automatically. For a custom local hostname or tunnel, set
`WEB_ORIGIN` to a comma-separated list of exact origins and restart the API.

Also set the account and database values:

```
# Postgres (the docker-compose postgres service uses these)
POSTGRES_USER=huddle
POSTGRES_PASSWORD=huddle
POSTGRES_DB=huddle
DATABASE_URL=postgresql://huddle:huddle@localhost:5432/huddle?schema=public

# BetterAuth
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_AUTH_URL=http://localhost:3001

# Login uses local email + password out of the box — no extra config needed.
# Google login is OPTIONAL; set both to enable the "Continue with Google" button:
#   console.cloud.google.com → OAuth client; redirect
#   http://localhost:3001/api/auth/callback/google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

> The key/secret lives in **one place** — `.env`. docker-compose injects
> `LIVEKIT_KEYS` into the LiveKit server, and the backend signs tokens with
> `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`. Keep `LIVEKIT_KEYS` as
> `"<key>: <secret>"` matching the other two. `infra/livekit.yaml` has no keys
> block. See `docs/adr/0001-livekit-secret-single-source.md`.

### Optional local Sentry error tracking

Create separate Sentry projects for the web app (Next.js) and API (NestJS), then
copy the web DSN into `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest...sentry.io/...
SENTRY_WEB_DSN=https://...@...ingest...sentry.io/...
SENTRY_ENVIRONMENT=development
```

Put the API project DSN in the repo-root `.env`:

```dotenv
SENTRY_API_DSN=https://...@...ingest...sentry.io/...
SENTRY_ENVIRONMENT=development
```

Blank DSNs disable the SDKs. Huddle sends unexpected web faults and API 5xx
only; 4xx Domain Outcomes remain quiet. It disables PII, performance tracing,
and Session Replay, and scrubs request/user data plus room-scoped identifiers.
The Control Agent never sends Sentry telemetry. See ADR 0027.

## 2. Start LiveKit + Redis + Postgres + MinIO + Egress

```bash
pnpm infra:up                                      # docker compose --env-file .env --profile dev-egress-fix up -d
docker compose -f infra/docker-compose.yml ps      # confirm all are up
```

> Use **`pnpm infra:up`** (not a bare `docker compose up`): it passes
> `--env-file .env` _and_ activates the `dev-egress-fix` profile that starts the
> `egress-netfix` sidecar needed for recording on Docker Desktop (see
> Troubleshooting → "Recording aborts"). That profile is dev-only and never runs
> in prod.

LiveKit signaling/API is on `http://localhost:7880`; Postgres on `localhost:5432`;
MinIO's S3 API on `http://localhost:9000` and its web console on
`http://localhost:9001` (log in with `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`).

> **Recording services (Phase 8):** `egress` (records the composited room) and
> `minio` (stores the MP4) join the stack. Egress needs the `${LIVEKIT_*}` vars,
> so start it with `pnpm infra:up` (which passes `--env-file .env`) — a bare
> `docker compose up` from the wrong directory won't interpolate them. The API
> creates the `S3_BUCKET` automatically before the first recording. Egress
> uploads via `S3_ENDPOINT_INTERNAL` (`minio:9000`); the API reads back via
> `S3_ENDPOINT` (`localhost:9000`) — don't swap them. See
> `docs/adr/0003-recording-egress-minio.md`.

## 3. Install dependencies

```bash
pnpm install        # from repo root (workspaces)
```

## 3b. Apply database migrations

```bash
pnpm --filter @huddle/api prisma:deploy   # apply migrations to Postgres
pnpm --filter @huddle/api prisma:generate # generate the Prisma client
```

> The Prisma scripts load `DATABASE_URL` from the repo-root `.env` via
> `dotenv-cli`. Use `prisma:migrate` (instead of `prisma:deploy`) when changing
> the schema during development.

## 4. Run the backend

```bash
pnpm dev:api        # NestJS in watch mode
# verify:
curl http://localhost:3001/health     # -> {"status":"ok"}
```

## 5. Run the frontend

```bash
pnpm dev:web        # Next.js dev server
# open http://localhost:3000
```

## 6. Smoke test a call

1. Open `http://localhost:3000`. **Create an account / sign in** (email +
   password, or Google if configured) to host.
2. Create (or schedule) a meeting; copy its link.
3. Open the link in a second window, enter a name, and **knock**.
4. Back in the host window, **admit** the guest. You should see/hear both.

## 6b. Test from other LAN devices with HTTPS

For cross-device local testing with a domain you control, use the
manual Cloudflare Tunnel runbook:
[`docs/CLOUDFLARE_LOCAL_TUNNEL.md`](./CLOUDFLARE_LOCAL_TUNNEL.md).

Cloudflare fronts the web/API/LiveKit signal URLs, but LiveKit media still uses
your `LIVEKIT_NODE_IP` directly. Treat this as a same-LAN test path, not the
production deployment.

## 6c. Run the macOS Control Agent

Remote Control requires the native companion app on the Sharer's Mac. Build the
unsigned local app and open it with:

```bash
swift test --package-path apps/control-agent
./apps/control-agent/scripts/build-app.sh
open "apps/control-agent/dist/Huddle Control Agent.app"
```

The browser opens a one-time `huddle-control://join` link after Sharer consent.
The agent redeems that code once, joins LiveKit with a server-minted token that
may publish the entire selected physical display and recipient-targeted
plain-text clipboard updates, and asks macOS for Screen Recording and
Accessibility permission. A
production build must be signed with Developer ID, notarized, and distributed as
a trusted `.app`/`.dmg`; signing credentials are not part of the repository.
Remote Control ends if either human, the agent, or the room disconnects, and the
Sharer or Controller can stop it from Huddle.

### Public beta downloads (Phase 11)

Sharers can install the public macOS beta from the Huddle **Downloads** page.
Choose the DMG matching the Mac's architecture (Apple Silicon or Intel), drag
the app to Applications, launch it, and press **Prepare for Remote Control** to
grant Screen Recording and Accessibility. Only the Sharer installs the agent;
Controllers stay in the browser.

If the first two-minute launch link expires while the DMG is being installed,
return to the room and press **Open Agent** again. Huddle rotates the old
bootstrap and issues a fresh single-use link. If the browser cannot invoke the
custom URL, copy the complete `huddle-control://join?...` link and paste it into
the agent window. The agent asks the Sharer to trust the exact Huddle API origin
once, then requires a display choice and local **Start Remote Control** click.
After the desktop is live, the Sharer can use **Change display** for an
immediate same-session switch. Huddle briefly shows a protected blank and
disables input until the replacement display is published; a failed switch stays
unpublished and retryable.

For beta support, use the agent's **Copy sanitized diagnostics** button and paste
the result into the repository's Control Agent issue form. The agent never sends
diagnostics automatically; do not include room links, bootstrap codes, tokens, or
private screen content.

Release credentials and the Ed25519 update-signing key are environment-owned.
The tag workflow is `.github/workflows/control-agent-release.yml`; record
physical signed-release-candidate results for both Apple Silicon and Intel
before creating a `control-agent-vX.Y.Z` tag.

## 6d. Run the Windows Control Agent

The Windows companion targets Windows 10 22H2 and Windows 11 x64. On a Windows
development machine with Flutter 3.24.3+, Visual Studio's **Desktop development
with C++** workload, and the Windows SDK installed:

```powershell
cd apps/control-agent-windows
flutter pub get
flutter analyze
flutter test
flutter run -d windows
```

The Sharer opens the same one-time `huddle-control://join` link from the
browser, trusts the exact API origin, selects one entire display, and presses
**Start Remote Control**. The agent runs normally by default. Before connecting,
the Sharer can choose **Allow control of administrator apps** and approve UAC
locally; secure-desktop prompts, sign-in, Ctrl+Alt+Delete, services, and
unattended access remain unavailable. See
[RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md](./RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md)
for packaging, release configuration, and the required physical acceptance
matrix.

## Troubleshooting

- **Camera/mic blocked:** browsers only allow media on `https` or `localhost`.
  Use `localhost`, not a LAN IP, for local testing — or set up TLS.
- **`could not establish pc connection` / connects then no media:** LiveKit is
  advertising an unreachable ICE address. In Docker it defaults to its container
  IP (172.x). Set `LIVEKIT_NODE_IP` in `.env` to your machine's LAN IP
  (`ipconfig getifaddr en0` on macOS) and re-run `pnpm infra:up`. Confirm with:
  `docker compose -f infra/docker-compose.yml logs livekit | grep "starting LiveKit"`
  — `nodeIP` should be your LAN IP, not `172.x`.
- **Connected but no audio/video:** the WebRTC UDP range / TURN isn't reachable.
  See the ports table in `docs/LIVEKIT_INTEGRATION.md`.
- **401/invalid token:** ensure `LIVEKIT_KEYS` in `.env` is
  `"<LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>"` and that you ran compose via
  `pnpm infra:up` (which passes `--env-file .env`).
- **LiveKit container won't start:** check `infra/livekit.yaml` syntax and that
  ports 7880/7881 aren't already in use.
- **Recording aborts ("Starting…" → "Aborted"):** the egress headless-Chrome
  compositor couldn't reach LiveKit's media. Two causes, both handled in the dev
  compose:
  - _Networking (Docker Desktop / macOS only):_ LiveKit advertises one ICE
    candidate (`LIVEKIT_NODE_IP`, your LAN IP). LAN browsers reach it, but the
    egress **container** can't route to the host's LAN IP on Docker Desktop, so
    its WebRTC never connects ("removing participant without connection" in the
    LiveKit log → "Start signal not received" in egress). The `egress-netfix`
    sidecar fixes this by DNAT-ing the LAN IP to `host.docker.internal`. It's
    **dev-only** — gated behind the `dev-egress-fix` compose profile that
    `pnpm infra:up` activates and the prod stack never enables, so a flat Linux
    host (where it would be harmful) never runs it. Confirm the rule is live:
    `docker run --rm --network container:infra-egress-1 --cap-add NET_ADMIN alpine sh -c 'apk add -q iptables; iptables -t nat -S OUTPUT'`
  - _Chrome crash ("chrome failed to start"):_ the default 64 MB `/dev/shm` is
    too small; the egress service sets `shm_size: 1gb`.

## Stopping

```bash
pnpm infra:down
```

## Production

The production source of truth is [DEPLOYMENT.md](./DEPLOYMENT.md); do not use
this local guide as a shortened deployment procedure. The committed CI/CD
workflow still requires configured GitHub secrets, a provisioned VPS, and a
successful external run before it can be treated as active. See
[RUNBOOK_CICD.md](./RUNBOOK_CICD.md).
