# API Contract (Backend)

NestJS backend (`apps/api`). Base URL in dev: `http://localhost:3001`.
All requests/responses are JSON. This contract is the source of truth for the
frontend ↔ backend boundary.

> Only the endpoints needed for the MVP are specified. Add new endpoints here
> before implementing them.

## POST /token

Mint a short-lived LiveKit access token for a participant.

**Request body**

```json
{
  "room": "team-standup",
  "identity": "user-8f3a",
  "name": "Abenezer"
}
```

| Field    | Type   | Required | Notes |
|----------|--------|----------|-------|
| room     | string | yes      | Room name to join. Created on demand by LiveKit. |
| identity | string | yes      | Unique participant id within the room. |
| name     | string | no       | Display name shown to others. Defaults to identity. |

**Validation:** reject empty `room` or `identity` with `400`. Sanitize/limit
length. The server decides the grants — never accept grant fields from the client.

**Response 200**

```json
{
  "token": "<jwt>",
  "livekitUrl": "ws://localhost:7880"
}
```

| Field      | Type   | Notes |
|------------|--------|-------|
| token      | string | JWT scoped to `{room, identity}`, short TTL (e.g. 1h). |
| livekitUrl | string | Public LiveKit WS URL for the client to connect to. |

**Errors**

| Status | When |
|--------|------|
| 400    | Missing/invalid `room` or `identity`. |
| 500    | Server misconfigured (missing API key/secret). |

## GET /health

Liveness probe.

**Response 200**

```json
{ "status": "ok" }
```

## Later-phase endpoints (do not build for MVP)

- `POST /livekit/webhook` — receive & verify LiveKit room/participant events.
- `POST /rooms` / `GET /rooms/:name` — explicit room creation/metadata.
- `DELETE /rooms/:name/participants/:identity` — host removes a participant.

Specify each fully here before implementing.

## CORS

Allow the web app's origin (e.g. `http://localhost:3000` in dev) for the
endpoints above. Keep the allowed-origins list in env/config.
