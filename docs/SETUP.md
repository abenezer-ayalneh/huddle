# Local Setup

How to run the whole stack on your machine. Steps marked _(after scaffolding)_
only work once the apps exist (Phase 0+).

## Prerequisites

- Node.js 20+ and npm (or pnpm)
- Docker + Docker Compose
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
LIVEKIT_URL=ws://localhost:7880
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
API_PORT=3001
WEB_ORIGIN=http://localhost:3000
```

> The same key/secret must appear in `infra/livekit.yaml` (server side) and in
> `.env` (backend that signs tokens).

## 2. Start LiveKit + Redis

```bash
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps      # confirm both are up
```

LiveKit signaling/API is now on `http://localhost:7880`.

## 3. Install dependencies _(after scaffolding)_

```bash
npm install        # from repo root (workspaces)
```

## 4. Run the backend _(after scaffolding)_

```bash
npm run start:dev --workspace apps/api
# verify:
curl http://localhost:3001/health     # -> {"status":"ok"}
```

## 5. Run the frontend _(after scaffolding)_

```bash
npm run dev --workspace apps/web
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
- **401/invalid token:** API key/secret in `.env` and `infra/livekit.yaml` don't
  match.
- **LiveKit container won't start:** check `infra/livekit.yaml` syntax and that
  ports 7880/7881 aren't already in use.

## Stopping

```bash
docker compose -f infra/docker-compose.yml down
```
