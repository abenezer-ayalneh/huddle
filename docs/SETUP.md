# Local Setup

How to run the whole stack on your machine. Steps marked _(after scaffolding)_
only work once the apps exist (Phase 0+).

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
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
```

For **Phase 7 (accounts + scheduling)** also set:

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

## 2. Start LiveKit + Redis + Postgres + MinIO + Egress

```bash
pnpm infra:up                                      # or: docker compose -f infra/docker-compose.yml --env-file .env up -d
docker compose -f infra/docker-compose.yml ps      # confirm all are up
```

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

## 3. Install dependencies _(after scaffolding)_

```bash
pnpm install        # from repo root (workspaces)
```

## 3b. Apply database migrations (Phase 7)

```bash
pnpm --filter @huddle/api prisma:deploy   # apply migrations to Postgres
pnpm --filter @huddle/api prisma:generate # generate the Prisma client
```

> The Prisma scripts load `DATABASE_URL` from the repo-root `.env` via
> `dotenv-cli`. Use `prisma:migrate` (instead of `prisma:deploy`) when changing
> the schema during development.

## 4. Run the backend _(after scaffolding)_

```bash
pnpm dev:api        # NestJS in watch mode
# verify:
curl http://localhost:3001/health     # -> {"status":"ok"}
```

## 5. Run the frontend _(after scaffolding)_

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

## Stopping

```bash
docker compose -f infra/docker-compose.yml down
```

## Production deployment (Phase 9 — single VPS)

The dev steps above run the apps via `pnpm` against containerized infra. For a
real deployment we target a **single Linux VPS** with a domain: Caddy terminates
TLS and reverse-proxies, web + api run as containers, and LiveKit serves media
directly. See `docs/adr/0004-deploy-topology-single-vps.md` for the why.

**There is no automated CD** (the repo has no remote yet) — this is the manual
runbook. CI (`.github/workflows/ci.yml`) runs the test/build gate once a GitHub
remote exists.

### 1. DNS

Point three subdomains at the VPS public IP (A records):
`app.<domain>`, `api.<domain>`, `livekit.<domain>` (+ optionally
`turn.<domain>`).

### 2. Firewall

Allow inbound: **80, 443** (Caddy), **3478/udp + 5349** (TURN),
**50000–50200/udp** (WebRTC media), **7881** (WebRTC/TCP fallback). Everything
else (Postgres/Redis/MinIO, and 7880) stays off the public interface — the base
compose binds those stores to `127.0.0.1` and the containers reach each other
over the Docker network.

### 3. Config

```bash
cp .env.prod.example .env.prod   # then edit: domains, secrets, ACME_EMAIL
```

Edit `infra/livekit.prod.yaml`: set the TURN `domain` and the webhook
`api_key` (your `LIVEKIT_API_KEY` — LiveKit does not interpolate env here).
Provision TURN TLS certs into `infra/turn-certs/` (see its README).

### 4. Build & run

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
```

### 5. Apply migrations

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod exec api node node_modules/prisma/build/index.js migrate deploy
```

(Or run `pnpm --filter @huddle/api prisma:deploy` from a checkout whose
`DATABASE_URL` points at the prod Postgres.)

### 6. Verify

- `curl https://api.<domain>/health` → `{"status":"ok"}`
- `curl https://api.<domain>/ready` → `200` with `postgres`/`redis` both `ok`
- Open `https://app.<domain>`, create a room, run a two-window call.

### Updating

```bash
git pull
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build   # rebuilds changed images, recreates
```

### Scaling out LiveKit (multi-node)

The topology is multi-node-ready (shared Redis). To add a second SFU node it
needs its **own public UDP media port range** and node IP — media reaches the
owning node directly, it does not pass through Caddy. See
`docs/adr/0004-deploy-topology-single-vps.md`.
