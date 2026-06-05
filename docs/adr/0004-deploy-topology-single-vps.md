# Phase 9 deploy topology: single VPS, multi-node-capable LiveKit, Caddy front door

Phase 9 hardens the stack for a real deployment. The target and the topology were
scoped with the user one decision at a time. This ADR records the shape; the
knock-state change has its own ADR ([0005](./0005-knock-state-to-redis.md)).

## Target: a single VPS / Docker host

We deploy to **one Linux box** with a real domain, running the existing
`docker compose` stack — not Kubernetes, not LiveKit Cloud. This keeps the
self-hosted principle of phases 0–8 intact and matches the project's scale. CD
to a managed cluster can come later without invalidating this work.

## LiveKit stays multi-node-_capable_, run as one node now

Even though we deploy on one box, the LiveKit topology is built the **production
way**: Redis-backed so room state is shared, and configured so a second SFU node
could join later. We run a single node on the VPS today.

The reason this is a real decision (and not free) on one host: each SFU node
needs a **distinct public UDP port range** and correct `node_ip` /
`rtc.use_external_ip`, because **media flows directly to the node that owns the
room — it does not go through the front door**. The front door only fronts the
signal/WSS connection. So "multi-node" is a configuration and port-allocation
concern, not a load-balancer concern. Documenting and wiring it correctly now is
what makes scaling out to N boxes a config change rather than a redesign.

## Front door: Caddy (TLS + signal/WSS reverse proxy)

**Caddy** terminates TLS (automatic Let's Encrypt certs) and reverse-proxies
HTTPS/WSS to `web`, `api`, and the LiveKit **signal** endpoint. L7 is acceptable
here precisely because media (UDP) bypasses Caddy and reaches the SFU directly.
Caddy was chosen over Traefik (more config surface for the same result), nginx +
certbot (manual cert wiring, verbose WSS/multi-upstream config), and HAProxy L4
(most "correct" for true signal LB at scale, but then needs a separate TLS story
for the web app). For one host, Caddy is the lowest-friction option and is what
LiveKit's own self-host docs recommend.

## TURN: LiveKit embedded TURN/TLS

Clients behind restrictive NATs need a relay. We enable LiveKit's **built-in
TURN server with TLS** (sharing the deployment domain/cert) rather than running a
standalone `coturn`. No extra container, no separate credentials, integrated with
the SFU. `coturn` would add isolation we don't need on one box.

## Observability: pragmatic, no dashboards yet

API `/health` + `/ready` endpoints, structured JSON logs across services, the
LiveKit **Prometheus metrics endpoint exposed** (scrapeable later), and compose
**healthchecks + restart policies**. We deliberately do **not** stand up
Prometheus + Grafana containers on the modest box yet, and we don't ship metrics
to a hosted backend (that would reintroduce an external dependency).

## Config layout: a prod compose override

Dev `infra/docker-compose.yml` is unchanged so local phases-0–8 flows keep
working. A layered **`infra/docker-compose.prod.yml`** (`-f base -f prod`) adds
Caddy, prod env, `restart: always`, the multi-node-capable LiveKit config, and
removes host-port exposure for internal services. A **`.env.prod.example`**
documents the prod-only variables. Chosen over compose `profiles` (interleaves
dev/prod settings in one busy file) and a fully separate `infra/prod/` tree (more
duplication to keep in sync).

## CI now, CD deferred

There is **no git remote yet**, so there is nothing to deploy _from_. We commit a
**GitHub Actions CI** workflow that runs the existing gate (prettier + both apps'
typecheck + tests + build) on push/PR — it activates the moment a GitHub remote
is added. Automated **CD** (registry push + ssh to the VPS) is deferred to when a
remote and a provisioned box exist; until then deployment is a documented manual
runbook (`ssh` + `compose -f … pull && up -d`) in `docs/SETUP.md`.

## Consequences

- Production topology is correct and scale-out is a config change, but we accept
  that true horizontal LiveKit scale is **not exercised** on one box — only
  configured. The single-node deployment is what's actually verified.
- The front door is L7; if signal-connection LB across many nodes ever becomes
  the bottleneck, revisit HAProxy/L4 (out of scope here).
- No metrics dashboards until the box (or the need) grows; the metrics are
  exposed so adding Prometheus/Grafana later is additive.
