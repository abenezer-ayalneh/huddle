# LiveKit Integration Guide

Everything specific to wiring this app to a **self-hosted** LiveKit server.

> Verify package names/versions and config keys against the current docs at
> https://docs.livekit.io when you implement — LiveKit evolves quickly.

## Packages

Frontend (`apps/web`):

```bash
npm i livekit-client @livekit/components-react @livekit/components-styles
```

Backend (`apps/api`):

```bash
npm i livekit-server-sdk
```

## Core concepts

- **Room** — a named session participants join. Created on demand.
- **Participant** — a connected client identity.
- **Track** — a media stream (camera, mic, screen). Published by one participant,
  subscribed by others.
- **Access token** — a short-lived JWT, signed with the API secret, encoding the
  participant identity and a `VideoGrant` (what they may do in which room).
- **SFU** — the LiveKit server forwards each publisher's tracks to subscribers; it
  does not mix them. This is what keeps it scalable.

## API key & secret

The self-hosted server is configured with one or more API key/secret pairs (in
`infra/livekit.yaml` or via env). The **backend** uses the same pair to sign
tokens. Keep both only in server-side env:

```
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<random-long-secret>
LIVEKIT_URL=ws://localhost:7880        # wss://... in production
```

The frontend only needs the **public** WebSocket URL (`NEXT_PUBLIC_LIVEKIT_URL`),
never the secret.

## Token minting (backend, NestJS) — reference shape

```ts
// apps/api — token.service.ts (illustrative)
import { AccessToken } from "livekit-server-sdk";

async function createToken(room: string, identity: string, name?: string) {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity, name, ttl: "1h" }
  );
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt(); // returns the JWT string (await if async in your SDK version)
}
```

Expose it as `POST /token` returning `{ token, livekitUrl }`. See
`docs/API_CONTRACT.md`.

## Connecting (frontend) — two options

**Option A — prebuilt components (fastest for MVP):**

```tsx
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

<LiveKitRoom
  token={token}
  serverUrl={livekitUrl}
  connect
  data-lk-theme="default"
>
  <VideoConference />
</LiveKitRoom>;
```

`VideoConference` already gives a participant grid, mute/camera controls, and
device handling — close to MVP out of the box. Customize from there.

**Option B — low-level (`livekit-client`):** use `new Room()` + `room.connect()`
and render tracks yourself when you need full control over the grid/UI.

Start with Option A for the MVP; drop to Option B where you need custom behavior.

## Self-hosting the server

The LiveKit server runs as the `livekit/livekit-server` container. Generate a
starter config + keys with the official helper, or use the provided
`infra/livekit.yaml` + `infra/docker-compose.yml` in this repo.

### Ports to expose (critical for WebRTC)

| Port        | Proto | Purpose                              |
| ----------- | ----- | ------------------------------------ |
| 7880        | TCP   | HTTP/WebSocket signaling + API       |
| 7881        | TCP   | WebRTC over TCP (fallback)           |
| 50000–60000 | UDP   | WebRTC media (RTP/RTCP)              |
| 3478        | UDP   | TURN (for clients behind strict NAT) |

If media connects but you see no audio/video, it's almost always the **UDP
range** or **TURN** not being reachable. Check this first.

### TLS

Browsers require HTTPS/WSS for camera+mic except on `localhost`. For any
non-local testing, terminate TLS (reverse proxy or LiveKit's built-in TLS) and
use `wss://` URLs.

## Webhooks (later phase, not MVP)

LiveKit can POST room/participant events (e.g. `participant_joined`,
`room_finished`) to a backend endpoint, verified with the API key. Useful for
analytics, recording triggers, and presence. Add a `POST /livekit/webhook`
handler in NestJS when that phase arrives — out of scope for the MVP.

## Gotchas checklist

- [ ] Frontend uses `NEXT_PUBLIC_LIVEKIT_URL`; secret stays server-only.
- [ ] Token `room` and `identity` are set server-side, not trusted from client.
- [ ] UDP media range + TURN are reachable end to end.
- [ ] `wss://` (not `ws://`) anywhere that isn't `localhost`.
- [ ] `livekit-client` and `livekit-server-sdk` versions kept in sync.
