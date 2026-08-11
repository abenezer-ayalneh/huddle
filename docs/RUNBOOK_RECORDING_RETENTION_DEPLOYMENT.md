## Runbook: Deploy recording retention and optional Google Drive delivery

**Owner:** Huddle operator | **Frequency:** Once per release / as needed  
**Last Updated:** 2026-08-04 | **Last Run:** Not yet recorded

### Purpose

Enable the additive recording-retention release on the production VPS without
starting deletion before the operator has checked its scope. The feature gives
each completed local MinIO MP4 a hard retention deadline, and can optionally
deliver it privately to a Host's Google Drive. It does not delete recording
metadata or verified Drive files.

Use this after the release containing migration
`20260728140000_add_recording_delivery` is available on the deployment host.

### Safety boundary

- MinIO object deletion is irreversible. Stop at the preview review if the
  count, bytes, or configured retention policy is not expected.
- Do **not** run a general `docker compose ... up -d --build` before the preview:
  the production compose file defines `recording-worker` with `restart: always`.
  Build the API image without starting the worker, migrate, and preview first.
- Stopping `recording-worker` pauses both Drive uploads and local-object
  deletion; it does not alter deadlines, delete Drive files, or remove metadata.
- Existing completed local recordings receive a full local-retention grace
  period from the worker's first cycle, not from their historical completion
  time.

### Prerequisites

- [ ] SSH access to the production VPS and the checked-out Huddle repository.
- [ ] Docker Compose v2, the existing production stack, and a current backup of
      both `huddle-postgres` and `huddle-minio`.
- [ ] The new code is on the deployment host; verify it includes the migration
      and `recording-worker` service before continuing.
- [ ] `.env.prod` has these valid settings. The delivered value must not exceed
      the local value, and both must be positive whole hours:

  ```dotenv
  S3_ENDPOINT=http://minio:9000
  S3_ENDPOINT_INTERNAL=http://minio:9000
  RECORDING_LOCAL_RETENTION_HOURS=168
  RECORDING_DELIVERED_RETENTION_HOURS=24
  RECORDING_WORKER_POLL_MS=30000
  ```

- [ ] For optional Google Drive delivery, set `GOOGLE_CLIENT_ID`,
      `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, and a stable
      `CLOUD_CREDENTIALS_ENCRYPTION_KEY` generated with `openssl rand -base64 32`.
      Register the exact Drive callback URI in Google Cloud and request only the
      `drive.file` scope. Do not rotate the encryption key after Hosts have
      connected Drive accounts, because existing encrypted refresh tokens and
      upload-session URLs would become unreadable.
- [ ] SMTP is configured if Hosts must receive delivery/expiry notices.

For Google OAuth Test-user access blocks and the production verification path,
use [the Google Drive OAuth access runbook](./RUNBOOK_GOOGLE_DRIVE_OAUTH_ACCESS.md).

### Procedure

Run all commands below from the repository root on the production VPS. These
commands use the Compose `caddy` service; keep it running as part of every full
stack update.

#### Step 1: Check the release and stop any pre-existing worker

```bash
git status --short
git log -1 --oneline
rg -n 'recording-worker|20260728140000_add_recording_delivery' \
  infra/docker-compose.prod.yml apps/api/prisma/migrations
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod stop recording-worker
```

**Expected result:** The release contains the worker and migration. The existing
web, API, Postgres, Redis, and MinIO services are healthy; `recording-worker`
is stopped (or Compose reports it is not running).

**If it fails:** Do not proceed with a dirty or incomplete release. Resolve the
base-stack failure first. If the worker cannot be stopped, do not change the
retention values or apply this release while it may be deleting objects.

#### Step 2: Back up state and validate production configuration

Follow the PostgreSQL and MinIO backup procedure in
[`DEPLOYMENT.md`](./DEPLOYMENT.md#13-backups). Then inspect the effective
retention values without printing unrelated secrets:

```bash
rg -n '^(S3_ENDPOINT|S3_ENDPOINT_INTERNAL|RECORDING_LOCAL_RETENTION_HOURS|RECORDING_DELIVERED_RETENTION_HOURS|RECORDING_WORKER_POLL_MS|GOOGLE_DRIVE_REDIRECT_URI|CLOUD_CREDENTIALS_ENCRYPTION_KEY)=' .env.prod
```

**Expected result:** Both S3 endpoints use the in-network `minio:9000` address;
the delivered-retention value is no larger than the local hard cap.

**If it fails:** Correct `.env.prod` before building. `localhost` is wrong for
either S3 endpoint in production, and an invalid retention pair causes the
worker/preview to refuse to start.

#### Step 3: Build the new API image without starting the worker

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod build api recording-worker
```

**Expected result:** Both services use an API image containing the migration,
preview command, and worker. No service is started by this command.

**If it fails:** Keep the old API running and fix the build failure. Do not use
an older image for the migration or preview.

#### Step 4: Apply the database migration

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod run --rm --no-deps --entrypoint node api \
  node_modules/prisma/build/index.js migrate deploy
```

**Expected result:** Prisma reports that migration
`20260728140000_add_recording_delivery` was applied, or that no pending
migrations remain.

**If it fails:** Leave `recording-worker` stopped. Restore the database only if
the migration partially failed and the recovery plan requires it; otherwise fix
the schema/deployment issue and retry. Do not start the new API image against a
schema that has not migrated.

#### Step 5: Preview the affected local recordings

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod run --rm --no-deps --entrypoint node api \
  dist/recording-retention-preview.js
```

**Expected result:** One JSON object such as
`{"affectedObjects":12,"bytes":345678901,"localRetentionHours":168}`. This is
read-only: it counts all completed local recordings that have not already been
deleted and does not upload or delete anything.

**If it fails:** Do not start the worker. Check the API container can reach
Postgres and MinIO, and re-check the retention environment variables. Escalate
if the count/bytes differs from the storage inventory or the configured policy.

#### Step 6: Start the updated API and worker

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --no-deps --force-recreate api recording-worker
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod ps api recording-worker
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod logs --tail=100 api recording-worker
```

**Expected result:** `api` and `recording-worker` are running. The first worker
cycle assigns the full local grace period to existing completed recordings.
There should be no configuration error or repeating worker-cycle error.

**If it fails:** Stop the worker, retain the old API image if necessary, and use
the rollback section. Do not allow a crash-looping worker to mask an invalid
retention configuration.

#### Step 7: Verify the release

```bash
curl -fsS https://<api-domain>/health
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod logs --since=10m recording-worker
```

**Expected result:** The health endpoint succeeds and the worker stays up over
at least two poll intervals. On `/recordings`, an authenticated Host sees local
recording expiry information. If Drive is configured and connected, completed
recordings progress through `queued`/`uploading` to `delivered` and then show a
private Drive link.

**If it fails:** See troubleshooting. Do not call Drive delivery accepted until
a real Egress MP4 has completed an approved end-to-end test.

### Google Drive acceptance test (optional, requires approval)

Use an approved Google test project/account and a real recording. Do not use a
production Host's personal Drive as an unapproved test target.

1. Sign in as a Host, open `/recordings`, and connect Drive. Confirm the OAuth
   callback returns to `/recordings` and the connection displays the intended
   account.
2. Start and complete a room recording. Have an eligible signed-in participant
   opt in while the recording is active if recipient sharing is being tested.
3. Watch worker logs and `/recordings` until `delivered` appears. Confirm the
   Drive file is in the private `Huddle Recordings` folder, is not trashed, and
   has the same byte size as the local object. Confirm a recipient received only
   a per-file reader permission, not folder access or a public link.
4. Restart the worker during a resumable upload and confirm it resumes safely.
   Revoke or disconnect Drive only in the test account and confirm the delivery
   becomes `action_required` while the local hard deadline remains in force.
5. After the delivered-retention period, confirm MinIO space is reclaimed and
   the recording metadata/verified Drive link remains available.

### Verification checklist

- [ ] Migration completed without error.
- [ ] Preview count and bytes were reviewed and recorded in the change ticket.
- [ ] `recording-worker` is up and stable after two poll intervals.
- [ ] Existing local recordings show a grace period from first worker startup.
- [ ] New local recordings receive the configured hard deadline.
- [ ] If Drive is enabled, one approved real MP4 is verified in the private
      Drive folder before declaring Drive delivery live.

### Troubleshooting

| Symptom                                                                             | Likely cause                                                        | Fix                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview or worker exits with `RECORDING_DELIVERED_RETENTION_HOURS cannot exceed...` | Invalid retention pair                                              | Set both values to positive whole hours; make delivered retention less than or equal to local retention, then rerun the preview.                     |
| Preview/worker cannot reach MinIO or Egress upload gets `SignatureDoesNotMatch`     | Production S3 endpoint/credentials mismatch                         | Set both endpoints to `http://minio:9000`; verify the S3 keys match MinIO; restart API/worker after correction.                                      |
| Worker is repeatedly restarting                                                     | Missing migration, bad environment, or store dependency unavailable | Keep it stopped, inspect `docker compose ... logs recording-worker`, confirm migration and service health, then rerun the preview before restarting. |
| A delivery shows `action_required`                                                  | Drive revoked/disconnected, quota, or Google policy failure         | Ask the Host to reconnect Drive on `/recordings`; quota/policy failures need the Drive admin. Reconnection requeues eligible work.                   |
| A delivery remains queued/uploading                                                 | Transient network/Google error or worker stopped                    | Confirm the worker is running. It retries after 1m, 5m, 15m, 1h, 3h, then every 6h; do not manually duplicate the job.                               |
| Recording is `expired_undelivered` / download returns 410                           | Hard local retention elapsed before verified delivery               | The local MP4 cannot be restored from MinIO. Metadata remains; recover only from an already verified Drive file or a pre-existing backup.            |
| Host did not receive an expiry/delivery email                                       | SMTP unavailable or rejected delivery                               | Verify SMTP configuration and logs. Notices are best-effort and must not be used as proof of retention execution.                                    |

### Rollback

1. Immediately pause cleanup and uploads:

   ```bash
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
     --env-file .env.prod stop recording-worker
   ```

2. If the API release itself must be rolled back, deploy the previously known
   API image/code and restart only `api`. Keep the new database migration in
   place unless the migration has a separately reviewed, tested down-migration;
   this release does not provide an automatic destructive schema rollback.
3. Do not delete `recording_delivery` or `cloud_storage_connection` rows as a
   rollback shortcut: they contain the state needed for safe retries. Do not
   rotate `CLOUD_CREDENTIALS_ENCRYPTION_KEY` while retaining those rows.
4. Local objects deleted before the worker was stopped cannot be restored from
   MinIO. Recover them only from an external MinIO backup or a verified Drive
   file. Record the affected IDs and incident timeline.

### Escalation

| Situation                                                  | Contact                                | Method                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Preview scope is unexpected or retention policy is unclear | Product/data owner                     | Pause before worker start; review the preview and retention policy in the change record.                                     |
| MinIO object loss or database migration failure            | Infrastructure owner                   | Stop worker, preserve logs/backups, and open an incident with recording IDs and timestamps.                                  |
| Google OAuth, quota, or Workspace policy failure           | Google Cloud / Workspace administrator | Provide the sanitized worker error, callback URI, client ID, and affected Host account; never send tokens or resumable URLs. |
| Egress cannot produce a test MP4                           | LiveKit operator                       | Check LiveKit/Egress logs, VPS UDP rules, and the production node-IP configuration.                                          |

### History

| Date       | Run By | Notes                                                                                    |
| ---------- | ------ | ---------------------------------------------------------------------------------------- |
| 2026-08-04 | —      | Initial operational runbook created from the accepted retention/delivery implementation. |
