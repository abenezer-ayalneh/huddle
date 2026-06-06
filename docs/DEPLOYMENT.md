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

```
                          ┌──────────────────── VPS (Docker) ─────────────────────┐
   Browser ──HTTPS/WSS──▶ │  Caddy :80/:443  ──▶ web :3000                         │
                          │                  ──▶ api :3001 ──▶ postgres / redis    │
                          │                  ──▶ livekit signal :7880              │
   Browser ──WebRTC UDP──────────────────────▶ livekit media :50000-50200/udp     │
   Browser ──TURN/TLS───────────────────────▶ livekit TURN :3478,:5349            │
                          │   api ──▶ minio (S3)  ◀── egress uploads MP4           │
                          └────────────────────────────────────────────────────────┘
```

---

## 0. What you need

- A VPS running a recent **Ubuntu/Debian** (≥ 2 vCPU / 4 GB RAM recommended —
  the egress compositor is the heavy part). A public IPv4 address.
- A **domain** you control DNS for.
- SSH access as a sudo-capable user.

You will use **four hostnames** (subdomains of one domain are easiest):

| Purpose          | Example env var   | Example value         |
| ---------------- | ----------------- | --------------------- |
| Frontend         | `APP_DOMAIN`      | `app.example.com`     |
| API              | `API_DOMAIN`      | `api.example.com`     |
| LiveKit signal   | `LIVEKIT_DOMAIN`  | `livekit.example.com` |
| TURN relay (TLS) | (in livekit conf) | `turn.example.com`    |

---

## 1. DNS

Create **A records** for all four hostnames pointing at the VPS public IP:

```
app.example.com      A   203.0.113.10
api.example.com      A   203.0.113.10
livekit.example.com  A   203.0.113.10
turn.example.com     A   203.0.113.10
```

Wait until they resolve (`dig +short app.example.com`) before requesting certs —
Caddy's automatic Let's Encrypt issuance needs the names to point at the box.

---

## 2. Install Docker + Compose on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in so the group applies
docker compose version            # confirm the Compose v2 plugin is present
```

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
- **Public URLs** (these are baked into the browser bundle at build time):
  `NEXT_PUBLIC_API_URL=https://api.example.com`,
  `NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.example.com`,
  `NEXT_PUBLIC_AUTH_URL=https://api.example.com`,
  `WEB_ORIGIN=https://app.example.com`,
  `BETTER_AUTH_URL=https://api.example.com`,
  `LIVEKIT_URL=wss://livekit.example.com`.
- **Secrets** — generate each with `openssl rand -hex 32`:
  `LIVEKIT_API_SECRET`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`,
  `MINIO_ROOT_PASSWORD`, `S3_SECRET_KEY`. Keep `LIVEKIT_KEYS` as
  `"<LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>"`, and keep `DATABASE_URL`'s password
  in sync with `POSTGRES_PASSWORD`.
- Leave `S3_ENDPOINT` and `S3_ENDPOINT_INTERNAL` both at `http://minio:9000` —
  in prod the API is a container and reaches MinIO by service name (do **not**
  set one to `localhost`; see [ADR-0003](./adr/0003-recording-egress-minio.md)).

`.env.prod` is gitignored — never commit it.

### Edit the LiveKit prod config

`infra/livekit.prod.yaml` is a committed template (LiveKit does **not**
interpolate `${...}` in it). Edit the placeholders:

- `turn.domain: turn.example.com` → your TURN hostname.
- `webhook.api_key: devkey` → your real `LIVEKIT_API_KEY` (the key **id**, not
  the secret).

---

## 6. Provision the TURN TLS certificate

LiveKit's embedded TURN/TLS needs a certificate for `turn.example.com`. Caddy
issues certs for the other three hostnames automatically, but TURN is not an
HTTP service, so you provision its cert separately. Easiest is **certbot**:

```bash
sudo apt-get install -y certbot
# Port 80 must be free for the challenge — do this BEFORE first 'up', or briefly
# stop Caddy: docker compose ... stop caddy
sudo certbot certonly --standalone -d turn.example.com

# Hand the cert to LiveKit (the prod compose mounts infra/turn-certs read-only):
sudo cp /etc/letsencrypt/live/turn.example.com/fullchain.pem infra/turn-certs/cert.pem
sudo cp /etc/letsencrypt/live/turn.example.com/privkey.pem   infra/turn-certs/key.pem
sudo chown "$USER" infra/turn-certs/*.pem
```

Set up renewal (certbot installs a timer); add a deploy hook to copy the renewed
files and restart LiveKit:

```bash
echo '#!/bin/sh
cp /etc/letsencrypt/live/turn.example.com/fullchain.pem '"$PWD"'/infra/turn-certs/cert.pem
cp /etc/letsencrypt/live/turn.example.com/privkey.pem   '"$PWD"'/infra/turn-certs/key.pem
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

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
```

This builds the `api` and `web` images (first build is slow — it compiles both
apps) and starts everything with `restart: always`. The **`egress-netfix`
sidecar is dev-only and does not run here** (it's behind the `dev-egress-fix`
profile); on a flat Linux host egress reaches LiveKit's media directly.

Check status and watch Caddy obtain certificates:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml logs -f caddy
```

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
curl https://api.example.com/health    # {"status":"ok"}
curl https://api.example.com/ready     # 200 + {"postgres":"ok","redis":"ok"}
```

Then in a browser:

1. Open `https://app.example.com`, sign up (email + password), create a room.
2. From another browser/device, open the room link, enter a name, **knock**.
3. Admit the guest from the host panel; confirm two-way audio/video.
4. As host, click **Record**, talk for a few seconds, **Stop**, then download the
   MP4 from the host panel or dashboard.

If media fails to connect, see Troubleshooting below.

---

## 10. Optional: Google sign-in

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.prod`
(console.cloud.google.com → Credentials → OAuth client). Authorized redirect
URI: `https://api.example.com/api/auth/callback/google`. Rebuild/restart `api`
and `web` after changing env (NEXT*PUBLIC*\* are build-time for `web`).

---

## 11. Updating the deployment

```bash
git pull          # or rsync the new tree up
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build    # rebuilds changed images, recreates
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

- **Caddy can't get a certificate:** DNS for that hostname isn't pointing at the
  box yet, or ports 80/443 aren't open/free. Check `logs -f caddy`.
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
- **`502` from Caddy:** the `web` or `api` container failed to start. Check
  `logs api` / `logs web`; a common cause is a missing/typo'd env var in
  `.env.prod`.
