# Owner-controlled maintenance

Implemented in the application and production Compose configuration. Production
activation requires deploying this revision and configuring the target account.

## Behavior

- The owner uses `/admin/maintenance` (also linked from their signed-in lobby).
  Other accounts cannot use the administration API. Owner identity is the
  server-only `MAINTENANCE_OWNER_USER_ID`, not an email supplied by the browser,
  a room host key, a secret URL, or the first registered account.
- Start immediately pauses new meetings, joins, admissions, recording starts,
  and new remote-control grants. Connected participants receive a dismissible
  warning popup and a persistent countdown; desktop Picture-in-Picture carries
  the countdown too. The deadline is five minutes after activation.
- At the deadline the API worker stops recordings, deletes active LiveKit rooms,
  and cleans room grants and attended remote control. Room-composite egress also
  stops on room deletion; signed webhooks continue processing final recordings.
  A durable cleanup queue retries failures after deletion/restart. Reopening
  waits for that queue to clear. Maintenance is enforced by the server even if
  clients sleep; pre-issued JWT joins are removed by the webhook, and the worker
  continues removing recreated rooms while maintenance remains active.
- Cancel during the warning to keep meetings running. Reopen after maintenance
  to restore admissions. Neither action restores calls already ended.
- State and deadline survive API restarts. Retrying Start does not extend the
  existing deadline. Browser countdowns use the server clock. LiveKit metadata
  carries warning/cancellation updates as an additional delivery path when the
  HTTP API is unreachable. Browser support and network connectivity determine
  when a participant sees the warning; the persisted server deadline is fixed.
- Public navigation receives the branded page with HTTP 503, `no-store`, and
  `Retry-After`. Cached/open tabs respond to status polling and API maintenance
  faults. Owner sign-in and controls remain reachable at `/admin/maintenance`;
  normal visitor navigation is gated for all users, including the owner.
- Existing Stop, Deny, webhook, health, and authentication paths stay available.
  This is an admission/shutdown policy, not a blanket authorization replacement
  for every read-only API. Existing API authorization remains enforced.

## Configure the actual account in each environment

Account IDs can differ across databases. Verify the email in the target database;
never copy a local account ID into production merely because the email matches.

For local/tunnel, build the API then resolve the ID from the local database:

```bash
pnpm --filter @huddle/api build
node scripts/with-env.mjs .env -- node apps/api/dist/maintenance-operator.js owner OWNER_EMAIL
```

For production, build the candidate API image first. This does not change the
running containers. Then resolve the production ID using that image:

```bash
cd /home/huddle
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod build api
bash infra/maintenance.sh owner OWNER_EMAIL
```

The command only prints the matching ID/email/verification status and refuses
ambiguous or unverified matches. Set `MAINTENANCE_OWNER_USER_ID` to that ID in
`.env` locally or `.env.prod` on production, then run `bash infra/deploy.sh` on
production. The deployment preflight requires the setting, so the owner screen
cannot silently deploy unavailable. The local tunnel overlays `.env` and
therefore uses the same local owner setting. Never put this variable in a
`NEXT_PUBLIC_*` setting. Blank configuration denies browser administration.

## Deployment

Build and apply both Prisma migrations before starting the updated API. Create
`infra/maintenance-state/` as the deployment user before starting/recreating
Caddy so Docker does not create a root-owned directory. Production Compose mounts
that directory read-only into Caddy and packages the static HTML separately.
The directory is ignored by Git and survives deployment checkout updates.

Caddy must load the new configuration and mounts once during deployment. The
runtime on/off command then changes a marker file without rewriting or reloading
Caddy configuration. The script validates Caddy before enabling the override.
The Next.js proxy uses `MAINTENANCE_API_INTERNAL_URL=http://api:3001` in Compose;
local development falls back to `NEXT_PUBLIC_API_URL`.

## SSH override

Run in `/home/huddle`:

```bash
bash infra/maintenance.sh status
bash infra/maintenance.sh on
bash infra/maintenance.sh off
```

`on` runs the same owner-configured maintenance service in an API-image process,
waits the five-minute warning, and verifies rooms and cleanup have finished.
It then enables a static Caddy page. Keep that command running until completion;
if interrupted, application maintenance remains scheduled/active and `on` can
be retried without extending the deadline. This works with the main web/API
containers stopped, provided Postgres, Redis, and LiveKit remain reachable and
the API image has already been built. The temporary operator process publishes
the warning over LiveKit while it waits. Drain meetings before stopping media
or database services.

`off` clears application maintenance first, then removes the static override.
If clearing state fails, the static page stays enabled. While the override is
active, even the browser owner page is replaced; recovery uses SSH. The static
page itself remains available with web/API/Postgres down, as long as Caddy and
the host are running. Bringing maintenance _on_ still requires healthy stores
and media services so it can honor the warning and verify shutdown.

Anyone with equivalent SSH/Docker administration access can operate the server.
No shell execution, Docker socket, or SSH credential is exposed through the web
owner screen. The static switch affects the app hostname; API callbacks and
LiveKit signaling remain available for lifecycle handling.

## Verification

Automated maintenance tests cover owner checks, missing configuration, exact
origin protection, five-minute boundaries, idempotent activation, cancellation,
resolved-handler admission coverage, warning publication, and shutdown retry.
Run them with:

```bash
pnpm --filter @huddle/api test --runInBand maintenance
pnpm typecheck
pnpm build
```

A release acceptance pass should also exercise owner/non-owner sessions, an
already-open call, cancellation, an API restart during the warning, real
recording and attended remote-control shutdown, and desktop/mobile/PiP display.
Test the SSH override with app containers stopped and verify restoration. Do
not use source checks or an empty LiveKit room as proof of real-device A/V or
native-agent behavior.
