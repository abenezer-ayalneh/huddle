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
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
```

> The key/secret lives in **one place** — `.env`. docker-compose injects
> `LIVEKIT_KEYS` into the LiveKit server, and the backend signs tokens with
> `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`. Keep `LIVEKIT_KEYS` as
> `"<key>: <secret>"` matching the other two. `infra/livekit.yaml` has no keys
> block. See `docs/adr/0001-livekit-secret-single-source.md`.

## 2. Start LiveKit + Redis

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps      # confirm both are up
```

LiveKit signaling/API is now on `http://localhost:7880`.

## 3. Install dependencies _(after scaffolding)_

```bash
pnpm install        # from repo root (workspaces)
```

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

1. Open `http://localhost:3000` in two browser windows (or two devices on the LAN).
2. Join the **same room name** with different display names.
3. You should see/hear both participants.

## Troubleshooting

- **Camera/mic blocked:** browsers only allow media on `https` or `localhost`.
  Use `localhost`, not a LAN IP, for local testing — or set up TLS.
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
