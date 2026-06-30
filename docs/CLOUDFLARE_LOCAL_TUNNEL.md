# Cloudflare Local Tunnel

Use this when you want to test the locally hosted Huddle app from another device
with real HTTPS/WSS URLs on `abenezer-ayalneh.dev`.

This is **not** the production deployment. Cloudflare Tunnel fronts the web app,
API, and LiveKit signal endpoint, but LiveKit media still travels directly to
the machine running Docker via `LIVEKIT_NODE_IP`. In practice, use this for
same-Wi-Fi/LAN devices.

References:

- Cloudflare Tunnel named tunnel flow: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/>
- Cloudflare Tunnel ingress rules: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/>
- LiveKit self-hosted ports and firewall notes: <https://docs.livekit.io/home/self-hosting/ports-firewall/>

## Hostnames

| Hostname                                    | Local service          |
| ------------------------------------------- | ---------------------- |
| `local-huddle.abenezer-ayalneh.dev`         | Next.js web `:3000`    |
| `local-huddle-api.abenezer-ayalneh.dev`     | NestJS API `:3001`     |
| `local-huddle-livekit.abenezer-ayalneh.dev` | LiveKit signal `:7880` |

## One-time Setup

Create the tunnel env overlay:

```bash
cp .env.tunnel.example .env.tunnel.local
```

Keep `.env` as the source for secrets and local infra. Confirm
`LIVEKIT_NODE_IP` in `.env` is your machine's LAN IP:

```bash
ipconfig getifaddr en0
```

Create a dedicated Cloudflare tunnel:

```bash
cloudflared tunnel create huddle-local
```

Copy the config template and replace the tunnel UUID + credentials file path with
the values printed by the create command:

```bash
cp infra/cloudflared-huddle-local.yml.example ~/.cloudflared/huddle-local.yml
```

Route the three hostnames to the tunnel:

```bash
cloudflared tunnel --config ~/.cloudflared/huddle-local.yml route dns huddle-local local-huddle.abenezer-ayalneh.dev
cloudflared tunnel --config ~/.cloudflared/huddle-local.yml route dns huddle-local local-huddle-api.abenezer-ayalneh.dev
cloudflared tunnel --config ~/.cloudflared/huddle-local.yml route dns huddle-local local-huddle-livekit.abenezer-ayalneh.dev
```

Validate the config:

```bash
pnpm tunnel:validate
cloudflared tunnel --config ~/.cloudflared/huddle-local.yml ingress rule https://local-huddle.abenezer-ayalneh.dev
```

## Run

Use four terminals:

```bash
pnpm infra:tunnel:up
pnpm dev:tunnel:api
pnpm dev:tunnel:web
pnpm tunnel:run
```

Then open:

```text
https://local-huddle.abenezer-ayalneh.dev
```

## Smoke Test

1. On the host browser, sign in and create a room.
2. On another device on the same LAN, open the shared room link.
3. Knock as a guest.
4. Admit the guest from the host panel.
5. Confirm camera and microphone work both ways.

## Stop

Stop `cloudflared` with `Ctrl+C`, stop the web/API dev servers, then:

```bash
pnpm infra:tunnel:down
```

## Troubleshooting

- If the site loads but media does not connect, confirm the guest device is on
  the same LAN and `LIVEKIT_NODE_IP` is the host machine's current LAN IP.
- If sign-in or API calls fail with CORS/auth issues, confirm the API was started
  with `pnpm dev:tunnel:api`, not `pnpm dev:api`.
- If the frontend still calls localhost, restart `pnpm dev:tunnel:web`; Next.js
  reads `NEXT_PUBLIC_*` values when the dev server starts.
- If DNS already exists for one of the local hostnames, rerun the matching
  `cloudflared tunnel --config ~/.cloudflared/huddle-local.yml route dns`
  command with `--overwrite-dns` before the tunnel name after confirming it is
  safe to replace, for example:
  `cloudflared tunnel --config ~/.cloudflared/huddle-local.yml route dns --overwrite-dns huddle-local local-huddle.abenezer-ayalneh.dev`.
- The tunnel is intentionally open while running. Stop `cloudflared` when you are
  done testing.
