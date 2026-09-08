# LiveKit integration

This document records Huddle-specific LiveKit constraints. It intentionally
does not reproduce SDK tutorials or suggest a generic public token endpoint.
For the current request/response boundary, use [API_CONTRACT.md](./API_CONTRACT.md);
for architecture, use [ARCHITECTURE.md](./ARCHITECTURE.md).

## Current integration model

- LiveKit runs as self-hosted infrastructure from `infra/livekit.yaml` and
  `infra/docker-compose.yml`.
- The NestJS API uses `livekit-server-sdk` for scoped participant tokens, room
  administration, Egress, and verified webhooks. The browser uses
  `livekit-client` and selected React primitives.
- Tokens originate only from the managed-room flow: Host room creation/host
  rejoin, Guest admission, Direct Rejoin, and the narrowly scoped Control Agent
  bootstrap. `POST /token` was intentionally removed because it bypassed
  waiting-room admission.
- Browser media and allowed data use the direct WebRTC connection to LiveKit.
  The API is not in the media path.
- Huddle implements its own call composition (`CallStage`, `VideoGrid`,
  `ControlBar`, `ChatPanel`, and `PreJoinScreen`) rather than depending on
  `VideoConference` or the stock `PreJoin` UI. The SDK remains the media/state
  layer, not the product UI.

## Credentials and URLs

`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_KEYS` must describe the
same key pair. Compose injects `LIVEKIT_KEYS` into the server; the API reads the
key and secret to sign tokens. Do not add keys to `infra/livekit.yaml` or expose
any of them as `NEXT_PUBLIC_*` values. See [ADR 0001](./adr/0001-livekit-secret-single-source.md).

`LIVEKIT_URL` is the server-side endpoint. `LIVEKIT_PUBLIC_URL`, when set, is
the browser-facing signal URL returned in participant-token responses. This lets
local tunnel testing keep API/Egress traffic local while browsers use public
WSS. Configure both deliberately; do not infer a public URL from the server
endpoint.

## Network requirements

The exact Compose mappings are authoritative. In the supplied topology:

| Purpose                             | Port / transport | Notes                                                            |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------- |
| LiveKit HTTP, signal, webhook admin | 7880/TCP         | Local direct access; production reaches signal through Caddy/WSS |
| WebRTC TCP fallback                 | 7881/TCP         | Expose in production firewall/security group                     |
| WebRTC media                        | 50000–50200/UDP  | Must reach the LiveKit node directly                             |
| TURN UDP                            | 3478/UDP         | Only when embedded TURN is enabled                               |
| TURN/TLS                            | 5349/TCP         | Needs the configured TURN certificate and domain                 |

`LIVEKIT_NODE_IP` is required for the Docker local path so LiveKit advertises a
LAN-reachable ICE address rather than the container address. It is not proof
that an arbitrary remote network can traverse media. Production relies on its
generated external-IP configuration unless a specific node IP is required; see
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Webhooks and lifecycle

`POST /livekit/webhook` verifies LiveKit signatures before it mutates state.
It reconciles room finish, participant lifecycle, recording Egress lifecycle,
Direct Rejoin, and attended Remote Control. It must remain reachable from the
LiveKit container in every environment. The event details and API outcomes are
documented in [API_CONTRACT.md](./API_CONTRACT.md).

## Verification boundary

A typecheck, component test, or headless browser does not establish a working
PeerConnection, real screen capture, NAT/TURN traversal, Egress media, or the
Control Agent's macOS permissions. Use the manual local smoke test in
[SETUP.md](./SETUP.md), the production checks in [DEPLOYMENT.md](./DEPLOYMENT.md),
and the remaining roadmap acceptance items.
