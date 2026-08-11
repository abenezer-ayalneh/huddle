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

The Compose `caddy` service is the only supported front door. It terminates TLS
and proxies to the web, API, and LiveKit services over the Docker network. Do not
install or configure a second, host-level Caddy instance for this deployment.

```
                          ┌──────────────────── VPS ───────────────────────────────┐
   Browser ──HTTPS/WSS──▶ │  Caddy (Compose, :80/:443) ──▶ web :3000                │
                          │                               ──▶ api :3001             │
                          │                               ──▶ livekit :7880         │
   Browser ──WebRTC UDP──────────────────────────────▶ livekit media :50000-50200/udp
   Browser ──TURN/TLS───────────────────────────────▶ livekit TURN :3478,:5349     │
                          │   api/recording-worker ──▶ minio (S3) ◀── egress uploads MP4 │
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
| Frontend         | `APP_DOMAIN`       | `app.example.com`                     |
| API              | `API_DOMAIN`       | `api.example.com`                     |
| LiveKit signal   | `LIVEKIT_DOMAIN`   | `livekit.example.com`                 |
| TURN relay (TLS) | `TURN_DOMAIN`      | `turn.example.com`                    |

---

## 1. DNS

Create **A records** for all four hostnames pointing at the VPS public IP:

```
app.example.com                      A   <VPS_PUBLIC_IP>
api.example.com                      A   <VPS_PUBLIC_IP>
livekit.example.com                  A   <VPS_PUBLIC_IP>
turn.example.com                     A   <VPS_PUBLIC_IP>
```

Wait until they resolve (`dig +short app.example.com`) before
requesting certs — Caddy's automatic Let's Encrypt issuance needs the names to
point at the box.

---

## 2. Install Docker + Compose on the VPS

```bash
# Docker + Compose v2
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
  Production Compose derives public site/API/auth/WSS URLs, CORS, and the
  Google Drive callback from these values; do not add duplicate URL settings.
- **Operator metadata:** `OPERATOR_NAME`, `OPERATOR_CONTACT_URL`, and
  `PROJECT_REPOSITORY_URL`. The preflight refuses to publish a site that could
  accidentally claim the official Huddle operator's identity.
- **Secrets** — generate each with `openssl rand -hex 32`:
  `LIVEKIT_API_SECRET`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`,
  `MINIO_ROOT_PASSWORD`, `S3_SECRET_KEY`. Keep `LIVEKIT_KEYS` as
  `"<LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>"`, and keep `DATABASE_URL`'s password
  in sync with `POSTGRES_PASSWORD`.
- Leave `S3_ENDPOINT` and `S3_ENDPOINT_INTERNAL` both at `http://minio:9000` —
  in prod the API is a container and reaches MinIO by service name (do **not**
  set one to `localhost`; see [ADR-0003](./adr/0003-recording-egress-minio.md)).
- **SMTP** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) —
  **required in production.** See the next subsection.
- **Recording retention:** set `RECORDING_LOCAL_RETENTION_HOURS=168` and
  `RECORDING_DELIVERED_RETENTION_HOURS=24` unless your retention policy requires
  shorter values. The second value must not exceed the first. Generate
  `CLOUD_CREDENTIALS_ENCRYPTION_KEY` with `openssl rand -base64 32`; it encrypts
  Google refresh tokens and resumable-upload URLs at rest. Set a separate
  `PARTICIPANT_ACCOUNT_BINDING_SECRET` if you do not want the LiveKit secret to
  be the compatible HMAC fallback.

`.env.prod` is gitignored — never commit it.

### Sentry error tracking

Create one Sentry project for Next.js and one for NestJS, then set:

```dotenv
NEXT_PUBLIC_SENTRY_DSN=<web project DSN>
SENTRY_WEB_DSN=<web project DSN>
SENTRY_API_DSN=<API project DSN>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<deployed Git commit SHA>
```

The public web DSN is baked into the browser bundle, so changing it requires a
web rebuild. `SENTRY_WEB_DSN` covers Next.js server/edge errors and
`SENTRY_API_DSN` covers NestJS. Blank values disable the corresponding SDK.

For readable minified web stacks, set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and
`SENTRY_PROJECT_WEB` in the gitignored `.env.prod`. The production Compose build
passes the auth token to the web Dockerfile through an ephemeral BuildKit secret
mount, uploads matching source maps, and deletes them after upload. Compose
explicitly clears the token from the API runtime. Never prefix it with
`NEXT_PUBLIC_` or commit it.

Huddle reports unexpected React/Next.js faults, API bootstrap failures, and API
5xx responses. It does not report expected 4xx Domain Outcomes. PII, performance
tracing, and Session Replay are disabled; request/user data and room-scoped
identifiers are scrubbed before delivery. The Control Agent remains
telemetry-free. See ADR 0027.

### Verification Email Delivery (SMTP) — required for email/password signups

New local accounts must confirm their address before they can sign in
(`requireEmailVerification: true` in `apps/api/src/auth/auth.ts`), and the
confirmation link is delivered by email. The sender (`apps/api/src/auth/mailer.ts`)
is provider-agnostic — any SMTP host works. This runbook uses **Brevo's free
tier** (300 emails/day, no credit card), sending from your own domain so the
mail passes SPF/DKIM/DMARC and lands in the inbox.

> If `SMTP_HOST` is left blank the API sends **nothing** — the verification link
> is never logged (it's a bearer credential). A send that fails logs sanitized
> SMTP diagnostics without the link and still does not break signup. The
> practical effect: without working SMTP, email/password signups can never
> complete. Once the API logs a successful send, confirm delivery from the
> provider's dashboard, not from app logs. (Google sign-in is unaffected —
> Google verifies the address itself.)

**1. Create a Brevo account and authenticate your domain.**

1. Sign up at <https://www.brevo.com> (free "Starter" plan).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain:**
   your mail-sending domain. Brevo shows the DNS records to add.
3. At that domain's DNS provider, add the records Brevo gives
   you (exact values come from the Brevo dashboard — these are the shapes):

   | Type  | Host (name)                        | Value                                                   | Purpose                        |
   | ----- | ---------------------------------- | ------------------------------------------------------- | ------------------------------ |
   | TXT   | `@` (or `brevo-code...` per Brevo) | `brevo-code:...` ownership token                        | Verify you own the domain      |
   | TXT   | `@`                                | `v=spf1 include:spf.brevo.com mx ~all`                  | SPF — authorizes Brevo to send |
   | CNAME | `brevo1._domainkey`                | `b1.<…>.brevo.com` (from dashboard)                     | DKIM key 1                     |
   | CNAME | `brevo2._domainkey`                | `b2.<…>.brevo.com` (from dashboard)                     | DKIM key 2                     |
   | TXT   | `_dmarc`                           | `v=DMARC1; p=none; rua=mailto:you@example.com`          | DMARC (monitor-only)           |

   > If you already have an SPF TXT record, **merge** the `include:spf.brevo.com`
   > into the existing one — a domain may have only a single SPF record.
   > DMARC starts at `p=none` (no mail is rejected); tighten to `quarantine` /
   > `reject` later once the `rua` reports show SPF+DKIM passing.

4. Back in Brevo, click **Verify / Authenticate**. Wait for DNS to propagate
   (`dig +short brevo1._domainkey.example.com` returns the CNAME) —
   usually minutes, up to an hour.

**2. Get the SMTP key.** Brevo dashboard → **SMTP & API → SMTP**. Note the
server (`smtp-relay.brevo.com`), port `587`, your **login email** (the SMTP
username), and **Generate a new SMTP key** (this is `SMTP_PASS` — _not_ your
account password).

**3. Set the values in `.env.prod`:**

```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587                            # STARTTLS (mailer sets secure=false here)
SMTP_USER=you@example.com                # your Brevo account login email
SMTP_PASS=xsmtpsib-...                   # the SMTP key from step 2
SMTP_FROM=no-reply@example.com           # sender address; choose an operator-owned mailbox
```

`.env.prod` is gitignored — never commit it. Restart the API after changing
these (the prod compose is an _override_ on the base file, so both `-f` flags
and `--env-file` are required):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --no-deps api
```

> The verification link in the email points at `WEB_ORIGIN` (`/verify-email`)
> so the user sees Huddle's verifying screen. That page calls the BetterAuth
> verifier on `BETTER_AUTH_URL` and then routes to the lobby.
> `autoSignInAfterVerification` means the user is signed in by that verifier.

**4. Verify it works (post-deploy checklist):**

1. On the live site, sign up a fresh test account with a real inbox you control
   (use a `+tag` alias so you can reuse it).
2. Confirm the email arrives within ~30s. **Check the spam folder** — if it
   landed there, SPF/DKIM aren't aligned yet; re-check the DNS records and that
   `SMTP_FROM` is on the authenticated domain. The inbox sender name should show
   `Huddle`; the address remains whatever you configured as `SMTP_FROM`.
3. Click **Verify my email** → you should land on Huddle, signed in.
4. If nothing arrives, check whether the API even attempted a send:
   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
     logs --tail=100 api | grep -i mailer
   ```
   `Sent verification email to …` means SMTP accepted the message — so a missing
   email is a deliverability problem (spam, bounce, DNS), diagnosed in Brevo's
   dashboard, not the app. `Failed to send verification email …` means the API
   attempted SMTP but the provider or network rejected it; inspect the sanitized
   `code`, `command`, `responseCode`, and `response` values, then compare them
   with Brevo's logs. **No** mailer line means the API did not reach SMTP, most
   commonly because `SMTP_HOST` is blank in the container or `.env.prod` was not
   picked up before the `api` restart.
5. Watch your Brevo dashboard → **Statistics / Logs** for delivery, bounce,
   blocked, or rejected events — this is your primary delivery signal.

**Ports (only if 3001/3002 are taken on your box).** The containers publish on
`127.0.0.1:${WEB_HOST_PORT}` (default `3001`) and `127.0.0.1:${API_HOST_PORT}`
(default `3002`) for local diagnostics; the Compose Caddy service proxies by
service name. The `*_PORT` vars (`WEB_PORT`
3000, `API_PORT` 3001) are the **container-internal** listen ports and almost
never need changing — they live inside the Docker network and don't clash with
anything else on the host. Do **not** set `API_PORT` to the host port (3002) —
that's the mistake that makes Caddy return `502`.

## 6. Provision the TURN TLS certificate

TURN is optional. Leave `TURN_ENABLED=false` to defer it. When enabled, set
`TURN_DOMAIN`, place its certificate/key at the configured paths, and let the
production preflight verify them. Caddy issues certificates for the three HTTP
hostnames; TURN is not an HTTP service, so provision its certificate separately.

```bash
sudo apt-get install -y certbot
# Port 80 must be free for the standalone challenge.
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod stop caddy
sudo certbot certonly --standalone -d turn.example.com
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod start caddy

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
> `TURN_ENABLED=false` so LiveKit does not require the missing certificate.

---

## 7. Build & start the stack

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
```

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

Caddy runs in the Compose stack, reads the three domain variables, issues the
HTTP certificates, and proxies WSS for LiveKit signal automatically.

---

## 8. Apply database migrations

The API image ships the Prisma schema + migrations but does not auto-migrate.
Run once after the first deploy (and after any future migration):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod exec api node node_modules/prisma/build/index.js migrate deploy
```

---

## 9. Control Agent release channel

The web deployment links to the public beta channel through
`NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL` and
`NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL`. The signed channel contains only the
release manifest and signature; its manifest points to immutable, versioned
GitHub Release DMGs. Set `NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY` to the
same Ed25519 public key embedded in the signed agent bundle so the Downloads page
can show verified release metadata.

Do not put Developer ID certificates, App Store Connect keys, or the manifest
private key in the VPS environment. They belong only in protected GitHub release
secrets.

The future Developer ID channel may use a separate Sparkle key in GitHub release
secrets. The current no-cost beta instead keeps its Sparkle private key in the
publisher's login Keychain under `huddle-control-agent-free-beta`; it is neither
exported nor placed on the VPS or in GitHub. Its public key is embedded into the
ad-hoc app during the local build, and publication signs an immutable arm64 DMG
plus the `control-agent-free-beta` appcast with that local key.

### No-cost Apple-Silicon beta

The Downloads page also has a permanent fallback link for the arm64
`control-agent-free-beta` GitHub prerelease. It needs no VPS environment value:
build and publish it from an Apple-Silicon Mac with:

```bash
./apps/control-agent/scripts/build-free-beta.sh
./apps/control-agent/scripts/publish-free-beta.sh
```

Before the first updater-enabled build, create the local Sparkle key once:

```bash
./apps/control-agent/scripts/configure-free-beta-updater.sh
```

Publish the GitHub release before deploying the page change, so the direct
download link never points at a missing asset. This is an ad-hoc signed,
unnotarized beta with a SHA-256 checksum, not a replacement for the Developer
ID channel above. The permanent beta release contains a signed Sparkle appcast
whose archive points to an immutable versioned release; the page must retain its
Gatekeeper warning and must never claim that this artifact is notarized or has a
Developer ID signature. Existing pre-updater beta builds need one manual install
of the updater-enabled DMG.

## 10. Verify

```bash
curl "https://${API_DOMAIN}/health"    # {"status":"ok"}
curl "https://${API_DOMAIN}/ready"     # 200 + {"postgres":"ok","redis":"ok"}
```

Then in a browser:

1. Open `https://${APP_DOMAIN}`, sign up (email + password), then
   click the verification link emailed to you (you're signed in automatically
   once confirmed) and create a room. If no email arrives, check the SMTP config
   from step 5 and the `api` logs.
2. From another browser/device, open the room link, enter a name, **knock**.
3. Admit the guest from the host panel; confirm two-way audio/video.
4. As host, click **Record**, talk for a few seconds, **Stop**, then download the
   MP4 from the host panel or dashboard.

If media fails to connect, see Troubleshooting below.

---

## 11. Optional: Google sign-in and Google Drive delivery

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.prod`
(console.cloud.google.com → Credentials → OAuth client). Authorized redirect
URI: `https://${API_DOMAIN}/api/auth/callback/google`.
Rebuild/restart `api` and `web` after changing env (NEXT*PUBLIC*\* are build-time
for `web`).

Google Drive delivery reuses the same Google OAuth client credentials but is a
separate explicit Host connection; it does not grant Drive access during Google
sign-in. Add this additional authorized redirect URI in Google Cloud and set it
in `.env.prod`:

```dotenv
GOOGLE_DRIVE_REDIRECT_URI=https://huddle-api.example.com/storage-connections/google-drive/callback
CLOUD_CREDENTIALS_ENCRYPTION_KEY=<openssl rand -base64 32 output>
```

Configure the consent screen for the narrow `drive.file` scope and test with a
Google test project before production. The worker creates a private `Huddle
Recordings` folder and per-file reader permissions only; do not request broad
Drive scope, a folder picker, or a public-link configuration.

If Google blocks a Drive connection because the OAuth app is still in Testing,
follow [the Google Drive OAuth access runbook](./RUNBOOK_GOOGLE_DRIVE_OAUTH_ACCESS.md).

## 11.1 Recording retention rollout

For the complete production procedure, including the required build-before-worker
guard, preview review, verification, rollback, and Google Drive acceptance
test, use [the recording-retention deployment runbook](./RUNBOOK_RECORDING_RETENTION_DEPLOYMENT.md).

Deploy additively: migrate, preview, then start the worker. The first worker
cycle gives every existing completed local recording a full configured grace
period from deployment; it does not calculate expiry from an old `endedAt`.

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod stop recording-worker
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod build api recording-worker
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod run --rm --no-deps --entrypoint node api node_modules/prisma/build/index.js migrate deploy
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod run --rm --no-deps --entrypoint node api dist/recording-retention-preview.js
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --no-deps --force-recreate api recording-worker
```

The preview prints `affectedObjects` and `bytes` before cleanup begins. Stopping
`recording-worker` pauses both Drive upload and deletion. Once a local MP4 is
deleted it cannot be restored from MinIO; metadata and a verified Drive link
remain. A live acceptance pass needs explicit approval and a Google test project
with a real Egress MP4, a participant opt-in, worker restart, revoked
credentials, and observed MinIO space reclamation.

---

## 12. Updating the deployment

```bash
git pull          # or rsync the new tree up
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
# then re-run migrations if the pull added any (step 8)
```

> Changing any `NEXT_PUBLIC_*` value requires a `web` **rebuild** (those are
> compiled into the browser bundle), which `--build` handles.

---

## 13. Backups

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

## 14. Scaling out LiveKit (later)

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
  then `up -d`.
- **Caddy can't get a certificate:** DNS for that hostname isn't pointing at the
  box yet, or ports 80/443 aren't open/free. Inspect `docker compose -f
  infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod
  logs -f caddy` and make sure no host process holds :80/:443.
- **`/ready` returns 503:** Postgres or Redis isn't up. The JSON body names the
  failing dependency (`{"postgres":"down"}`). Check `logs postgres` / `logs redis`.
- **Connects but no audio/video:** WebRTC media can't traverse. Confirm the
  UDP range `50000-50200/udp` and TCP `7881` are open in **both** ufw and your
  cloud provider's security group. LiveKit auto-detects the public IP
  (`use_external_ip` in the generated `LIVEKIT_CONFIG`). Configure a node IP
  explicitly only when auto-detection is wrong.
- **Recording aborts ("Starting…" → "Aborted"):** unlike local Docker Desktop,
  prod should "just work" because egress reaches the node IP directly. If it
  fails, the egress container can't reach LiveKit media — check that the UDP
  range is open and that LiveKit's advertised node IP is correct. (The
  `egress-netfix` Docker-Desktop shim is **not** used in prod.)
- **Recording starts but never completes:** egress can't reach MinIO. Both
  `S3_ENDPOINT` and `S3_ENDPOINT_INTERNAL` must be `http://minio:9000` in prod.
- **Webhooks failing / knocks not clearing:** LiveKit posts to `http://api:3001`
  over the Docker network; production Compose renders the webhook key from
  `LIVEKIT_API_KEY`.
- **`502`/`connection refused` from Caddy:** the `web` or `api` container isn't
  up or isn't published on localhost. Confirm `docker compose ... ps` shows them
  healthy and that they're bound to `127.0.0.1:3000` / `127.0.0.1:3001`
  (`ss -ltnp | grep -E '3000|3001'`). Check `logs api` / `logs web`; a common
  cause is a missing/typo'd env var in `.env.prod`.
