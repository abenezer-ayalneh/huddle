# Deploying Huddle to a VPS

A complete, start-to-finish guide for running Huddle in production on a single
Linux VPS with a real domain. It expands on the runbook in
[`SETUP.md`](./SETUP.md) → _Production deployment_ and assumes nothing beyond a
fresh server.

The production topology is recorded in
[`docs/adr/0004-deploy-topology-single-vps.md`](./adr/0004-deploy-topology-single-vps.md):
Caddy terminates TLS and reverse-proxies the web app, API, and LiveKit signal;
the web and API run as containers; LiveKit serves WebRTC media directly; and the
internal stores (Postgres, Redis, MinIO) stay on the Docker network.

**Front door — two options.** This guide is written for a **host-installed Caddy**
(a global `caddy` running under systemd on the VPS), which is what this deployment
uses. The repo also ships a **containerized** `caddy` service in the prod compose;
if you prefer that, skip the host-Caddy steps and don't pass `--scale caddy=0`
below. Either way, the containers publish `web`/`api` on `127.0.0.1` and LiveKit
signal on `:7880` so a reverse proxy can reach them.

```
                          ┌──────────────────── VPS ───────────────────────────────┐
   Browser ──HTTPS/WSS──▶ │  Caddy (host, :80/:443) ──▶ 127.0.0.1:3000  (web)       │
                          │                          ──▶ 127.0.0.1:3001  (api)      │
                          │                          ──▶ 127.0.0.1:7880  (livekit)  │
   Browser ──WebRTC UDP──────────────────────────────▶ livekit media :50000-50200/udp
   Browser ──TURN/TLS───────────────────────────────▶ livekit TURN :3478,:5349     │
                          │   api ──▶ minio (S3)  ◀── egress uploads MP4 (Docker net)│
                          └─────────────────────────────────────────────────────────┘
```

---

## 0. What you need

- A VPS running a recent **Ubuntu/Debian** (≥ 2 vCPU / 4 GB RAM recommended —
  the egress compositor is the heavy part). A public IPv4 address.
- A **domain** you control DNS for.
- SSH access as a sudo-capable user.

You will use **four hostnames**. The values below are the ones this deployment
uses; substitute your own if different.

| Purpose          | Env var / location | Value                                 |
| ---------------- | ------------------ | ------------------------------------- |
| Frontend         | `APP_DOMAIN`       | `huddle.abenezer-ayalneh.dev`         |
| API              | `API_DOMAIN`       | `huddle-api.abenezer-ayalneh.dev`     |
| LiveKit signal   | `LIVEKIT_DOMAIN`   | `huddle-livekit.abenezer-ayalneh.dev` |
| TURN relay (TLS) | (in livekit conf)  | `huddle-turn.abenezer-ayalneh.dev`    |

---

## 1. DNS

Create **A records** for all four hostnames pointing at the VPS public IP:

```
huddle.abenezer-ayalneh.dev          A   <VPS_PUBLIC_IP>
huddle-api.abenezer-ayalneh.dev      A   <VPS_PUBLIC_IP>
huddle-livekit.abenezer-ayalneh.dev  A   <VPS_PUBLIC_IP>
huddle-turn.abenezer-ayalneh.dev     A   <VPS_PUBLIC_IP>
```

Wait until they resolve (`dig +short huddle.abenezer-ayalneh.dev`) before
requesting certs — Caddy's automatic Let's Encrypt issuance needs the names to
point at the box.

---

## 2. Install Docker + Compose (and host Caddy) on the VPS

```bash
# Docker + Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in so the group applies
docker compose version            # confirm the Compose v2 plugin is present

# Host-installed Caddy (the front door used by this guide)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
caddy version
```

> Skip the Caddy install if you intend to use the **containerized** `caddy`
> service instead (see the front-door note in the intro).

---

## 3. Open the firewall

Media (WebRTC/UDP) and TURN must reach LiveKit **directly** — they do not go
through Caddy. Open exactly these, and nothing else:

```bash
sudo ufw allow 22/tcp                  # SSH (don't lock yourself out)
sudo ufw allow 80,443/tcp              # Caddy (HTTP→HTTPS redirect + TLS)
sudo ufw allow 7881/tcp                # WebRTC over TCP (fallback)
sudo ufw allow 3478/udp                # TURN/UDP
sudo ufw allow 5349/tcp                # TURN/TLS
sudo ufw allow 50000:50200/udp         # WebRTC media (RTP/RTCP)
sudo ufw enable
```

Notes:

- **7880** (LiveKit signal) is intentionally **not** opened — Caddy proxies it
  over WSS on `LIVEKIT_DOMAIN`. You can leave it closed externally.
- Postgres/Redis/MinIO are bound to `127.0.0.1` in the compose base file and
  reached over the Docker network, so they're never exposed even without ufw.

---

## 4. Get the code

```bash
git clone <your-repo-url> huddle && cd huddle
# (or rsync/scp the working tree up — there is no public remote yet)
```

---

## 5. Configure environment

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set, at minimum:

- **Domains:** `APP_DOMAIN`, `API_DOMAIN`, `LIVEKIT_DOMAIN`, `ACME_EMAIL`.
  (`APP_DOMAIN`/`API_DOMAIN`/`LIVEKIT_DOMAIN` are only consumed by the
  _containerized_ Caddy; with a host Caddy they're harmless but the hostnames
  live in `/etc/caddy/Caddyfile` instead — see step 7.)
- **Public URLs** (these are baked into the browser bundle at build time):
  `NEXT_PUBLIC_API_URL=https://huddle-api.abenezer-ayalneh.dev`,
  `NEXT_PUBLIC_LIVEKIT_URL=wss://huddle-livekit.abenezer-ayalneh.dev`,
  `NEXT_PUBLIC_AUTH_URL=https://huddle-api.abenezer-ayalneh.dev`,
  `WEB_ORIGIN=https://huddle.abenezer-ayalneh.dev`,
  `BETTER_AUTH_URL=https://huddle-api.abenezer-ayalneh.dev`,
  `LIVEKIT_URL=wss://huddle-livekit.abenezer-ayalneh.dev`.
- **Secrets** — generate each with `openssl rand -hex 32`:
  `LIVEKIT_API_SECRET`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`,
  `MINIO_ROOT_PASSWORD`, `S3_SECRET_KEY`. Keep `LIVEKIT_KEYS` as
  `"<LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>"`, and keep `DATABASE_URL`'s password
  in sync with `POSTGRES_PASSWORD`.
- Leave `S3_ENDPOINT` and `S3_ENDPOINT_INTERNAL` both at `http://minio:9000` —
  in prod the API is a container and reaches MinIO by service name (do **not**
  set one to `localhost`; see [ADR-0003](./adr/0003-recording-egress-minio.md)).

`.env.prod` is gitignored — never commit it.

**Ports (only if 3001/3002 are taken on your box).** The containers publish on
`127.0.0.1:${WEB_HOST_PORT}` (default `3001`) and `127.0.0.1:${API_HOST_PORT}`
(default `3002`) — these are what the host Caddy proxies to, so keep
`infra/huddle.caddy` in sync if you change them. The `*_PORT` vars (`WEB_PORT`
3000, `API_PORT` 3001) are the **container-internal** listen ports and almost
never need changing — they live inside the Docker network and don't clash with
anything else on the host. Do **not** set `API_PORT` to the host port (3002) —
that's the mistake that makes Caddy return `502`.

### Edit the LiveKit prod config

`infra/livekit.prod.yaml` is a committed template (LiveKit does **not**
interpolate `${...}` in it). Edit the placeholders:

- `turn.domain: huddle-turn.abenezer-ayalneh.dev` → your TURN hostname.
- `webhook.api_key: devkey` → your real `LIVEKIT_API_KEY` (the key **id**, not
  the secret).

---

## 6. Provision the TURN TLS certificate

LiveKit's embedded TURN/TLS needs a certificate for
`huddle-turn.abenezer-ayalneh.dev`. Caddy issues certs for the other three
hostnames automatically, but TURN is not an HTTP service, so you provision its
cert separately. Easiest is **certbot**:

```bash
sudo apt-get install -y certbot
# Port 80 must be free for the challenge. With a host Caddy running on :80,
# briefly stop it: sudo systemctl stop caddy   (restart it after).
sudo certbot certonly --standalone -d huddle-turn.abenezer-ayalneh.dev

# Hand the cert to LiveKit (the prod compose mounts infra/turn-certs read-only):
sudo cp /etc/letsencrypt/live/huddle-turn.abenezer-ayalneh.dev/fullchain.pem infra/turn-certs/cert.pem
sudo cp /etc/letsencrypt/live/huddle-turn.abenezer-ayalneh.dev/privkey.pem   infra/turn-certs/key.pem
sudo chown "$USER" infra/turn-certs/*.pem
```

Set up renewal (certbot installs a timer); add a deploy hook to copy the renewed
files and restart LiveKit:

```bash
echo '#!/bin/sh
cp /etc/letsencrypt/live/huddle-turn.abenezer-ayalneh.dev/fullchain.pem '"$PWD"'/infra/turn-certs/cert.pem
cp /etc/letsencrypt/live/huddle-turn.abenezer-ayalneh.dev/privkey.pem   '"$PWD"'/infra/turn-certs/key.pem
docker compose -f '"$PWD"'/infra/docker-compose.yml -f '"$PWD"'/infra/docker-compose.prod.yml --env-file '"$PWD"'/.env.prod restart livekit' \
  | sudo tee /etc/letsencrypt/renewal-hooks/deploy/huddle-turn.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/huddle-turn.sh
```

> TURN/TLS is the fallback path for users behind UDP-blocking firewalls. The app
> works without it for most networks, but completing this step is recommended
> for production. If you defer it, set `turn.enabled: false` in
> `livekit.prod.yaml` so LiveKit doesn't fail to load a missing cert.

---

## 7. Build & start the stack

Because the front door is a **host-installed Caddy**, start everything _except_
the containerized `caddy` service (it would fight the host Caddy for :80/:443):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build --scale caddy=0
```

> Using the **containerized** Caddy instead? Drop `--scale caddy=0` and skip the
> host-Caddy sub-step below.

This builds the `api` and `web` images (first build is slow — it compiles both
apps) and starts everything with `restart: always`. The containers publish
`web` on `127.0.0.1:3000`, `api` on `127.0.0.1:3001`, and LiveKit signal on
`:7880`. The **`egress-netfix` sidecar is dev-only and does not run here** (it's
behind the `dev-egress-fix` profile); on a flat Linux host egress reaches
LiveKit's media directly.

Check status:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps
```

### Configure the host Caddy

The three site blocks live in [`infra/huddle.caddy`](../infra/huddle.caddy)
(already filled in with these hostnames, and pointed at the localhost ports the
prod compose publishes — web `127.0.0.1:3001`, api `127.0.0.1:3002`, LiveKit
signal `127.0.0.1:7880`). If your host Caddy imports a sites directory
(`import /etc/caddy/sites/*` in `/etc/caddy/Caddyfile`), symlink the repo file
in so a `git pull` keeps it current:

```bash
sudo ln -s "$PWD/infra/huddle.caddy" /etc/caddy/sites/huddle.caddy
sudo caddy validate --config /etc/caddy/Caddyfile    # sanity-check before reload
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager               # confirm it's active
journalctl -u caddy -f                               # watch it obtain certs
```

(No sites directory? Paste the three blocks into `/etc/caddy/Caddyfile`
directly, or `sudo cp infra/huddle.caddy /etc/caddy/Caddyfile` if Huddle is the
only site, then reload.)

Caddy auto-issues Let's Encrypt certs for the three web hostnames and proxies
WSS for LiveKit signal automatically. (The TURN cert is separate — step 6.)

---

## 8. Apply database migrations

The API image ships the Prisma schema + migrations but does not auto-migrate.
Run once after the first deploy (and after any future migration):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod exec api node node_modules/prisma/build/index.js migrate deploy
```

---

## 9. Verify

```bash
curl https://huddle-api.abenezer-ayalneh.dev/health    # {"status":"ok"}
curl https://huddle-api.abenezer-ayalneh.dev/ready     # 200 + {"postgres":"ok","redis":"ok"}
```

Then in a browser:

1. Open `https://huddle.abenezer-ayalneh.dev`, sign up (email + password), create
   a room.
2. From another browser/device, open the room link, enter a name, **knock**.
3. Admit the guest from the host panel; confirm two-way audio/video.
4. As host, click **Record**, talk for a few seconds, **Stop**, then download the
   MP4 from the host panel or dashboard.

If media fails to connect, see Troubleshooting below.

---

## 10. Optional: Google sign-in

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.prod`
(console.cloud.google.com → Credentials → OAuth client). Authorized redirect
URI: `https://huddle-api.abenezer-ayalneh.dev/api/auth/callback/google`.
Rebuild/restart `api` and `web` after changing env (NEXT*PUBLIC*\* are build-time
for `web`).

---

## 11. Updating the deployment

```bash
git pull          # or rsync the new tree up
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build --scale caddy=0   # keep host Caddy as the front door
# then re-run migrations if the pull added any (step 8)
```

> Changing any `NEXT_PUBLIC_*` value requires a `web` **rebuild** (those are
> compiled into the browser bundle), which `--build` handles.

---

## 12. Backups

The durable state lives in two named Docker volumes:

- `huddle-postgres` — accounts, rooms, recording metadata.
- `huddle-minio` — the recorded MP4 files.

Back them up on a schedule, e.g.:

```bash
# Postgres logical dump
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod exec postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F).sql

# MinIO data (stop-free: mirror to another location with mc, or snapshot the volume)
docker run --rm -v huddle-minio:/data -v "$PWD":/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

---

## 13. Scaling out LiveKit (later)

The topology is multi-node-ready (shared Redis), but a single node is deployed.
To add a second SFU node you give it its **own public UDP media port range** and
node IP — media reaches the node that owns the room directly, not through Caddy
(see [ADR-0004](./adr/0004-deploy-topology-single-vps.md)). On one box this buys
little; it's a config change, not a redesign, when you outgrow the VPS.

---

## Troubleshooting

- **`api` container crash-loops with `Cannot find module '@nestjs/common'`:**
  you built the image before the Dockerfile fix. pnpm's `node_modules` is
  symlinked into the root store, so the run stage must copy the whole workspace
  (the current `apps/api/Dockerfile` does). Rebuild without cache:
  `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod build --no-cache api`
  then `up -d --scale caddy=0`.
- **Caddy can't get a certificate:** DNS for that hostname isn't pointing at the
  box yet, or ports 80/443 aren't open/free. Host Caddy: `journalctl -u caddy -f`
  (and make sure nothing else — including the containerized `caddy` — holds
  :80/:443). Containerized Caddy: `... logs -f caddy`.
- **`/ready` returns 503:** Postgres or Redis isn't up. The JSON body names the
  failing dependency (`{"postgres":"down"}`). Check `logs postgres` / `logs redis`.
- **Connects but no audio/video:** WebRTC media can't traverse. Confirm the
  UDP range `50000-50200/udp` and TCP `7881` are open in **both** ufw and your
  cloud provider's security group. LiveKit auto-detects the public IP
  (`use_external_ip` in `livekit.prod.yaml`); pin it with
  `command: --config /etc/livekit.yaml --node-ip <PUBLIC_IP>` in the prod
  override if detection is wrong.
- **Recording aborts ("Starting…" → "Aborted"):** unlike local Docker Desktop,
  prod should "just work" because egress reaches the node IP directly. If it
  fails, the egress container can't reach LiveKit media — check that the UDP
  range is open and that `livekit.prod.yaml`'s node IP is correct. (The
  `egress-netfix` Docker-Desktop shim is **not** used in prod.)
- **Recording starts but never completes:** egress can't reach MinIO. Both
  `S3_ENDPOINT` and `S3_ENDPOINT_INTERNAL` must be `http://minio:9000` in prod.
- **Webhooks failing / knocks not clearing:** LiveKit posts to `http://api:3001`
  over the Docker network; ensure `webhook.api_key` in `livekit.prod.yaml`
  matches `LIVEKIT_API_KEY`.
- **`502`/`connection refused` from Caddy:** the `web` or `api` container isn't
  up or isn't published on localhost. Confirm `docker compose ... ps` shows them
  healthy and that they're bound to `127.0.0.1:3000` / `127.0.0.1:3001`
  (`ss -ltnp | grep -E '3000|3001'`). Check `logs api` / `logs web`; a common
  cause is a missing/typo'd env var in `.env.prod`.
