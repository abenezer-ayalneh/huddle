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

## 2. Start LiveKit + Redis + Postgres

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps      # confirm all are up
```

LiveKit signaling/API is on `http://localhost:7880`; Postgres on `localhost:5432`.

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
