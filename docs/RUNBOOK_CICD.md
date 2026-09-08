# Runbook: CI/CD to the VPS

**Status:** The CI workflow, deploy workflow, and `infra/deploy.sh` are committed.
Whether GitHub secrets, a `production` Environment, the VPS checkout, and a
successful deployment exist is external state and is not established by this
repository.

## Purpose

Deploy the `main` branch to the single-VPS Compose topology after CI succeeds,
or on an intentional manual dispatch. The operational implementation is
versioned in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
and [`infra/deploy.sh`](../infra/deploy.sh); this runbook describes the required
external configuration and recovery instead of duplicating either script.

## Preconditions

- The VPS has completed the initial [deployment](./DEPLOYMENT.md), has a checkout
  at `/home/huddle`, and retains its untracked `.env.prod` and TURN certificate
  material.
- The deploy user can run Docker Compose without `sudo`, and the VPS can
  `git fetch origin`.
- Production configuration passes `node scripts/validate-production-env.mjs
--env .env.prod` on the VPS.
- The repository's `production` environment (if retained) has the intended
  reviewer policy. Deployment approval is an operator decision, not a CI check.

## Configure GitHub-to-VPS access

1. Create a dedicated, no-passphrase deploy key outside the repository:

   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy@huddle" -f ~/.ssh/huddle_deploy_key -N ""
   ```

2. Add the public key to the deploy user's `~/.ssh/authorized_keys` on the VPS,
   then prove it can reach the checkout and Docker:

   ```bash
   ssh -i ~/.ssh/huddle_deploy_key <deploy_user>@<vps_host> \
     "cd /home/huddle && docker compose version && git fetch --dry-run origin"
   ```

3. In GitHub Actions secrets, set `VPS_HOST`, `VPS_USER`, `VPS_PORT`, and
   `VPS_SSH_KEY` (the complete private-key contents). Configure the repository's
   `production` Environment before relying on its manual approval gate.

4. Trigger **Deploy** from the Actions tab once, or push a CI-passing commit to
   `main`. The workflow accepts a manual dispatch or a successful `CI` workflow
   run on `main` and serializes deployments under `deploy-production`.

Do not put the private deploy key, `.env.prod`, Apple credentials, or provider
tokens in the repository or workflow source.

## What a deployment changes

`infra/deploy.sh` fetches and hard-resets `/home/huddle` to `origin/main`,
validates production configuration, creates `infra/maintenance-state/`, builds
images, applies migrations before the new API starts, starts Compose, prunes
dangling images, and waits up to 60 seconds for `/ready`.

The hard reset is intentional for a dedicated deployment checkout, but it
discards tracked local edits there. Keep only operator-owned untracked material
such as `.env.prod` and TURN certificates on that host; do not hand-edit tracked
deployment code on the VPS.

## Verification

After Actions reports success, verify the deployed revision and readiness from
the VPS or an authorized operator environment:

```bash
cd /home/huddle
git rev-parse --short HEAD
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod ps
curl -fsS "https://<api-domain>/health"
curl -fsS "https://<api-domain>/ready"
```

`/health` proves process liveness; `/ready` must return `200` with both
Postgres and Redis reported `ok`. Finish with the browser and real-device checks
appropriate to the release. A green workflow does not prove WebRTC media,
TURN/NAT traversal, OAuth, recording, macOS permission, or public release
acceptance.

## Failure handling

| Symptom                       | First response                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy never starts           | Check that `CI` is green on `main`, Actions secrets exist, and the production Environment is not awaiting approval. Manual dispatch isolates trigger issues. |
| SSH or Docker fails           | Re-run the precondition SSH command; repair the deploy key, account, or Docker-group membership before retrying.                                             |
| Configuration preflight fails | Run the displayed validator command on the VPS and correct only the reported `.env.prod` value. Do not guess or expose it in logs.                           |
| Migration fails               | Stop. Inspect Postgres and API logs; never edit an applied migration. Add a forward migration or restore from a verified backup if required.                 |
| `/ready` times out            | Inspect `docker compose ... logs api postgres redis`; resolve the dependency failure before another deploy.                                                  |
| Caddy returns `502`           | Confirm the Compose `web` and `api` services are healthy and inspect their logs. The supported front door is the Compose Caddy service, not a host Caddy.    |

## Rollback

Use a known-good Git revision recorded by the deploy output. Migrations do not
roll back automatically, so assess schema compatibility first.

```bash
ssh <deploy_user>@<vps_host>
cd /home/huddle
git fetch origin
git reset --hard <known-good-sha>
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
```

For a destructive or incompatible migration, stop and use the backup/recovery
procedure in [DEPLOYMENT.md](./DEPLOYMENT.md); resetting code alone is not a
database rollback. Disable the Deploy workflow or halt approvals while the
incident is investigated.
