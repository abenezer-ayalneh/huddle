## Runbook: Set up CI/CD to the VPS with GitHub Actions

**Owner:** Abenezer Ayalneh | **Frequency:** Once to set up; CD then runs on every push to `main`
**Last Updated:** 2026-06-07 | **Last Run:** —

### Purpose

Automate deployment of Huddle to the production VPS. CI already runs on every push
and PR (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); this runbook
adds the **CD** half: when CI passes on `main`, GitHub Actions SSHes into the VPS,
pulls the new code, rebuilds the `web`/`api` containers, runs DB migrations, and
health-checks the API. This replaces the manual "section 11. Updating the deployment"
steps in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

Use this runbook **once** to wire everything up. After that, deploys are automatic —
the only ongoing operator action is reading the Actions log when a deploy fails.

**Design choice — build on the VPS.** This mirrors the existing manual flow
(`docker compose ... up -d --build`). No container registry is involved. The
trade-off: the VPS does the (slow) image build on each deploy. If that becomes
painful, the alternative is building images in CI and pushing to GHCR — noted at the
end under "Variant".

---

### Prerequisites

- [ ] **Admin on the GitHub repo** `abenezer-ayalneh/huddle` (to add secrets + an Environment).
- [ ] **SSH access to the VPS** as the deploy user, who is in the `docker` group
      (`docker compose` works without `sudo`).
- [ ] **The repo is already cloned on the VPS** at `/home/huddle`
      with `.env.prod` present and the stack already deployed once by hand
      per [`DEPLOYMENT.md`](./DEPLOYMENT.md). CD updates an existing deploy; it does not
      bootstrap a fresh box.
- [ ] **The VPS can `git fetch origin`** as the deploy user (it cloned the repo, so a
      read deploy key or the user's SSH key is already trusted by GitHub).
- [ ] **Host Caddy is running** as the front door (`systemctl status caddy`).
- [ ] `openssl` / `ssh-keygen` available locally to mint the deploy key.

---

### Procedure

#### Step 1: Mint a dedicated SSH deploy key (run locally)

Don't reuse a personal key. Create one key whose **only** job is "GitHub Actions →
VPS". No passphrase (CI can't type one). **Generate it outside the repo** (in `~/.ssh`)
so a private key never lands in the working tree — `huddle_deploy_key*` is gitignored
as a backstop, but don't rely on that.

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy@huddle" -f ~/.ssh/huddle_deploy_key -N ""
```

**Expected result:** two files — `~/.ssh/huddle_deploy_key` (private) and
`~/.ssh/huddle_deploy_key.pub` (public).
**If it fails:** ensure `~/.ssh` exists and is writable; on macOS `ssh-keygen` is built in.

#### Step 2: Authorize the public key on the VPS

Append the **public** key to the deploy user's `authorized_keys` on the VPS:

```bash
ssh <deploy_user>@<vps_host> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
  cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" < ~/.ssh/huddle_deploy_key.pub
```

**Expected result:** no error. Verify the new key works and nothing else is needed:

```bash
ssh -i ~/.ssh/huddle_deploy_key <deploy_user>@<vps_host> "cd /home/huddle && docker compose version && git status -s"
```

**Expected result:** prints the Compose version and a clean (or expected) git status —
proves the key logs in _and_ the deploy user can drive Docker and git in the repo.
**If it fails:** "Permission denied (publickey)" → the public key didn't land in
`authorized_keys` (check perms: dir `700`, file `600`). "permission denied" on
`docker` → the deploy user isn't in the `docker` group
(`sudo usermod -aG docker <deploy_user>`, then re-login).

#### Step 3: Add the GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret name   | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| `VPS_HOST`    | VPS public IP or hostname                                      |
| `VPS_USER`    | the deploy user from Step 2                                    |
| `VPS_SSH_KEY` | the **entire** contents of the **private** `huddle_deploy_key` |
| `VPS_PORT`    | SSH port (usually `22`)                                        |

Paste the private key in full, including the
`-----BEGIN OPENSSH PRIVATE KEY-----` / `-----END …-----` lines and the trailing
newline.

```bash
# Or, with the gh CLI from the repo root:
gh secret set VPS_HOST  --body "<vps_public_ip>"
gh secret set VPS_USER  --body "<deploy_user>"
gh secret set VPS_PORT  --body "22"
gh secret set VPS_SSH_KEY < ~/.ssh/huddle_deploy_key
```

**Expected result:** four secrets listed under Actions secrets.
**If it fails:** `gh` not authed → `gh auth login`. Wrong repo → `gh repo set-default`.

> Once the secret is set and the public key is in the VPS's `authorized_keys`, the
> local private key is no longer needed — you can `rm ~/.ssh/huddle_deploy_key*`.
> Keep it only if you want to SSH in manually with that identity.

#### Step 4: (Recommended) Create a `production` Environment with a manual gate

Repo → **Settings → Environments → New environment → `production`**. Optionally add
yourself as a **Required reviewer** so each deploy waits for a one-click approval.
This turns "auto-deploy on green main" into "auto-_propose_, click to ship" — a good
safety net early on. The workflow below references `environment: production`.

**Expected result:** an environment named `production` exists.
**If it fails / you want full auto:** skip this step and delete the
`environment: production` line from the workflow in Step 6.

#### Step 5: Add the deploy script to the repo

Create [`infra/deploy.sh`](../infra/deploy.sh). Keeping the deploy logic in the repo
(not buried in YAML) means it's version-controlled and runnable by hand on the box.

```bash
#!/usr/bin/env bash
# Production deploy, run on the VPS by GitHub Actions (or by hand).
# Pulls main, rebuilds web/api, migrates the DB, health-checks the API.
# Safe to re-run. Assumes .env.prod and turn-certs/*.pem already exist (untracked,
# so `git reset --hard` leaves them alone). Compose Caddy is the front door.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root, regardless of where this is invoked from

COMPOSE="docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml --env-file .env.prod"

echo "==> Current revision (for rollback): $(git rev-parse --short HEAD)"

echo "==> Fetching and hard-resetting to origin/main"
git fetch --prune origin
git reset --hard origin/main
echo "==> Now at: $(git rev-parse --short HEAD)"

echo "==> Validating production configuration"
node scripts/validate-production-env.mjs --env .env.prod

echo "==> Building images and starting the stack"
$COMPOSE up -d --build

echo "==> Applying database migrations"
$COMPOSE exec -T api node node_modules/prisma/build/index.js migrate deploy

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Health check"
API_DOMAIN="$(node -e 'const fs=require("fs"); const line=fs.readFileSync(".env.prod","utf8").split(/\\r?\\n/).find((item)=>item.startsWith("API_DOMAIN=")); if (!line) process.exit(1); process.stdout.write(line.slice("API_DOMAIN=".length).trim())')"
curl -fsS "https://${API_DOMAIN}/health"
echo
echo "==> Deploy complete."
```

Make it executable and commit it:

```bash
chmod +x infra/deploy.sh
git add infra/deploy.sh
```

**Expected result:** `infra/deploy.sh` is executable and staged.
**If it fails:** `chmod +x` needs the file to exist first; confirm the path.

> **Why `git reset --hard` is safe here:** `.env.prod` and `infra/turn-certs/*.pem`
> are untracked/gitignored, and `reset --hard` only touches _tracked_ files — so
> your secrets and TURN certs survive. Production hostnames and operator metadata
> live only in gitignored `.env.prod`; the deploy preflight validates them after
> reset. **Rule: edit `.env.prod` deliberately on the box and never commit it.**

#### Step 6: Add the deploy workflow

Create [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). It triggers
**after CI succeeds on `main`** (so a red build never deploys) and SSHes in to run the
script from Step 5.

```yaml
name: Deploy

# Runs only after the CI workflow completes on main. Gated on CI success below.
on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]
  workflow_dispatch: {} # allow manual "Run workflow" from the Actions tab

# Never let two deploys run at once; let an in-flight one finish.
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    # Skip unless CI passed (workflow_dispatch has no workflow_run, so allow it too).
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment: production # remove this line if you skipped Step 4
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          command_timeout: 30m # building both images on a small VPS is slow
          script_stop: true # abort on the first failing command
          script: |
            set -e
            cd /home/huddle
            # Sync the tree FIRST so infra/deploy.sh (and any change to it) is on
            # disk before we invoke it — the script can't pull itself into existence.
            git fetch --prune origin
            git reset --hard origin/main
            bash infra/deploy.sh
```

> **Why the workflow pulls before calling the script (bootstrap):** `infra/deploy.sh`
> is what runs `git fetch`/`reset` — but on the very first deploy the VPS tree is
> still at an older commit that _predates the script_, so `./infra/deploy.sh` would
> fail with `No such file or directory`. The script can't pull itself into existence.
> Syncing the tree in the workflow first guarantees the file is present (and current)
> before it runs. The script then re-runs the same `git` commands idempotently — a
> harmless no-op on CI, and still self-sufficient when run by hand on the box.

**Expected result:** the file exists; `name: "CI"` matches the `name:` in
[`ci.yml`](../.github/workflows/ci.yml) exactly (it does today).
**If it fails:** YAML indent errors show up in the Actions tab as "workflow file
issue". The `workflows: ["CI"]` string must match the CI workflow's `name:` verbatim,
or the trigger never fires.

#### Step 7: Commit, push, and watch the first deploy

```bash
git add infra/deploy.sh .github/workflows/deploy.yml
git commit -m "ci: add CD pipeline deploying to the VPS over SSH"
git push origin main
```

This push runs **CI**; on green, **Deploy** fires. Watch both:

```bash
gh run watch          # or: open the repo's Actions tab
```

If you enabled the `production` environment with a reviewer (Step 4), the Deploy run
pauses for your approval — click **Review deployments → Approve**.

**Expected result:** CI ✓ then Deploy ✓; the Deploy log ends with
`Deploy complete.` and the health check JSON.
**If it fails:** see Troubleshooting.

---

### Verification

- [ ] In the Actions tab, the latest **CI** run is green and a **Deploy** run followed it.
- [ ] The Deploy log shows the new short SHA at `==> Now at:` matching `git rev-parse --short HEAD` of `main`.
- [ ] `curl -fsS "https://${API_DOMAIN}/health"` → `{"status":"ok"}`.
- [ ] `curl -fsS "https://${API_DOMAIN}/ready"` → 200 with `{"postgres":"ok","redis":"ok"}`.
- [ ] On the VPS, `docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps` shows `caddy`, `web`, `api`, `livekit`, `postgres`, `redis`, and `minio` up.
- [ ] A quick smoke test in the browser: open the app, create a room, two-way A/V (per DEPLOYMENT.md §9).

---

### Troubleshooting

| Symptom                                                             | Likely Cause                                                                | Fix                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| Deploy never starts after CI passes                                 | `workflows: ["CI"]` doesn't match CI's `name:`, or push wasn't to `main`    | Make the string match `ci.yml`'s `name:` exactly; `workflow_run` only fires for the default branch's workflow file                            |
| `./infra/deploy.sh: No such file or directory`                      | VPS tree is at a commit predating the script — it can't pull itself in      | The workflow must `git fetch`/`reset --hard origin/main` _before_ invoking the script (Step 6); once on the box, `bash infra/deploy.sh` works |
| `ssh: handshake failed` / `Permission denied (publickey)`           | `VPS_SSH_KEY` truncated, wrong user, or public key not in `authorized_keys` | Re-paste the **full** private key (incl. BEGIN/END lines); verify Step 2's test SSH works                                                     |
| `permission denied while trying to connect to the Docker daemon`    | deploy user not in `docker` group                                           | `sudo usermod -aG docker <deploy_user>` on the VPS, then re-login                                                                             |
| `git reset --hard` fails / detached or diverged                     | someone hand-committed on the box                                           | On the VPS: `git fetch origin && git reset --hard origin/main` manually, then re-run                                                          |
| Production configuration fails before startup                         | `.env.prod` is incomplete or malformed                                      | Run `pnpm config:validate:prod` on the VPS and correct the reported variable or TURN certificate path                                         |
| Job times out during build                                          | small VPS, cold Docker cache                                                | Raise `command_timeout`; or adopt the GHCR "Variant" so the VPS only pulls prebuilt images                                                    |
| `prisma migrate deploy` fails                                       | DB unreachable or bad migration                                             | Check `... logs postgres`; never edit applied migrations — add a new one                                                                      |
| Caddy returns `502` after deploy                                    | `web`/`api` not published on localhost, or env typo                         | `ss -ltnp                                                                                                                                     | grep -E '3001 | 3002'`; check `... logs api web` (see DEPLOYMENT.md Troubleshooting) |
| Deploy ✓ but app unchanged                                          | a `NEXT_PUBLIC_*` changed but image cache served stale bundle               | `--build` rebuilds; if needed force `... build --no-cache web` once                                                                           |

---

### Rollback

The Deploy log records the previous SHA (`==> Current revision (for rollback): <sha>`).
To revert, SSH to the VPS and redeploy that revision:

```bash
ssh <deploy_user>@<vps_host>
cd /home/huddle
git fetch origin
git reset --hard <previous_good_sha>
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml \
  --env-file .env.prod up -d --build
```

> **Migrations don't auto-roll-back.** If the bad deploy added a destructive
> migration, restore Postgres from the latest dump (DEPLOYMENT.md §12) before/after
> resetting code. For additive migrations, rolling code back alone is usually safe.

To stop further auto-deploys while you investigate: disable the **Deploy** workflow
(Actions tab → Deploy → ⋯ → **Disable workflow**), or revert the offending commit on
`main` (which triggers a fresh clean deploy once CI is green).

---

### Escalation

| Situation                                  | Contact                       | Method                                                             |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| CD broken, can't deploy, need a hotfix out | Abenezer Ayalneh              | Deploy by hand on the VPS (`./infra/deploy.sh`), bypassing Actions |
| VPS down / unreachable                     | VPS provider support          | Provider console / support ticket                                  |
| TLS cert / DNS issue                       | Domain registrar + Caddy logs | `journalctl -u caddy -f`; check DNS A records                      |
| LiveKit media broken after deploy          | —                             | DEPLOYMENT.md Troubleshooting ("Connects but no audio/video")      |

---

### Variant: build in CI, pull from GHCR (when VPS builds get slow)

Instead of building on the VPS, build `web`/`api` in Actions and push to GitHub
Container Registry; the VPS only does `pull` + `up -d`. Sketch:

1. In a build job: `docker login ghcr.io` (uses the built-in `GITHUB_TOKEN` with
   `packages: write`), `docker build`/`push` tagged `ghcr.io/abenezer-ayalneh/huddle-web:<sha>` and `-api:<sha>`.
2. Change the prod compose `web`/`api` from `build:` to `image: ghcr.io/...:<tag>`
   (parameterise the tag via an env var in `.env.prod`).
3. `deploy.sh` drops `--build` and adds `docker compose ... pull` before `up -d`;
   the VPS runs `docker login ghcr.io` once with a read token.

Faster, reproducible deploys at the cost of a registry and more moving parts. Adopt
it only when on-VPS build time actually hurts.

---

### History

| Date       | Run By           | Notes                                                      |
| ---------- | ---------------- | ---------------------------------------------------------- |
| 2026-06-07 | Abenezer Ayalneh | Runbook created. CD not yet wired (CI-only at this point). |
