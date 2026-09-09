# Documentation guide

This guide is the entry point for people and AI agents. It separates product
intent, current implementation, and operational evidence so a document is not
mistaken for proof of something it only proposes or records historically.

## How to read the repository

1. Start with [ROADMAP.md](./ROADMAP.md) for current feature status and the
   acceptance work that remains. A checked item means the repository contains
   the intended implementation or supporting automation; it does **not** prove
   device-, provider-, release-, or deployment-bound acceptance.
2. Read [PRD.md](./PRD.md) for the original MVP requirements. It is a retained
   requirements baseline, not a list of the only features that exist now.
3. Use [ARCHITECTURE.md](./ARCHITECTURE.md) for the current trust boundaries,
   data ownership, and system topology. Confirm a behavior in source before
   changing a security-sensitive path.
4. Treat [API_CONTRACT.md](./API_CONTRACT.md) as the custom HTTP boundary. The
   controller implementation under `apps/api/src/` is the executable evidence;
   BetterAuth's upstream routes are intentionally summarized rather than copied
   here.
5. Read the relevant [ADR](./adr/README.md) before changing a deliberate
   trade-off. An ADR records rationale and constraints; it is not standalone
   evidence that every consequence has shipped or been accepted in production.
6. Use [SETUP.md](./SETUP.md), [DEPLOYMENT.md](./DEPLOYMENT.md), or a named
   runbook only for the environment they name. Do not treat local checks as
   production, real WebRTC, macOS permission, or third-party-provider proof.

## Source-of-truth map

| Need                                              | Canonical document                          | Supporting evidence                                                    |
| ------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Current feature status and remaining acceptance   | [ROADMAP.md](./ROADMAP.md)                  | Current source, tests, and environment-specific checks                 |
| MVP requirements and original acceptance criteria | [PRD.md](./PRD.md)                          | Roadmap revisions and ADRs                                             |
| Product language and non-obvious behavior         | [`../CONTEXT.md`](../CONTEXT.md)            | `apps/web/PRODUCT.md` for web-product copy                             |
| Architecture, security boundaries, persistence    | [ARCHITECTURE.md](./ARCHITECTURE.md)        | `infra/`, `apps/api/src/`, and ADRs                                    |
| HTTP request/response contract                    | [API_CONTRACT.md](./API_CONTRACT.md)        | `apps/api/src/**/*.controller.ts` and client `apps/web/src/lib/api.ts` |
| Stack choices and rationale                       | [TECH_STACK.md](./TECH_STACK.md)            | package manifests and ADRs                                             |
| Local development                                 | [SETUP.md](./SETUP.md)                      | `.env.example`, root `package.json`, `infra/docker-compose.yml`        |
| VPS deployment                                    | [DEPLOYMENT.md](./DEPLOYMENT.md)            | `.env.prod.example`, Compose, Caddy, and deployment scripts            |
| Repeated operations                               | [runbooks](#runbooks)                       | The referenced scripts and workflows                                   |
| Web product/design rules                          | `apps/web/PRODUCT.md`, `apps/web/DESIGN.md` | Current web routes and components                                      |
| macOS companion operation                         | `apps/control-agent/README.md`              | Swift source and release scripts                                       |
| Windows companion operation                       | `apps/control-agent-windows/README.md`      | Flutter app, Win32 bridge, installer, and release workflow             |

## Status vocabulary

- **Implemented in this checkout** means source/configuration is present. Run
  the stated checks before relying on it.
- **Automated verification** means tests or a build can exercise part of the
  behavior. It cannot prove physical media, native permissions, a public
  release, or an external account/provider integration.
- **Manual or external acceptance pending** means the requirement is retained
  but needs a real browser/device, credentials, or deployed environment.
- **Historical** documents explain a completed or superseded decision/plan.
  They must not be used as current implementation instructions.

## Runbooks

- [Cloudflare local tunnel](./CLOUDFLARE_LOCAL_TUNNEL.md) — HTTPS testing from
  another LAN device; it is not production.
- [Deploy recording retention and Google Drive delivery](./RUNBOOK_RECORDING_RETENTION_DEPLOYMENT.md)
  — production change procedure; Google acceptance is separately required.
- [Restore Google Drive OAuth access](./RUNBOOK_GOOGLE_DRIVE_OAUTH_ACCESS.md)
  — provider-account remediation.
- [CI/CD to the VPS](./RUNBOOK_CICD.md) — GitHub/VPS configuration and recovery.
- [Owner-controlled maintenance](./RUNBOOK_MAINTENANCE.md) — maintenance
  authority, shutdown, static-page override, and recovery.
- [Release Windows Control Agent beta](./RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md)
  — physical acceptance, unsigned installer, signed manifest, and release path.

## Audit baseline: 2026-09-08

This guide was reconciled against the current checkout. The principal evidence
was the route/controller set in `apps/api/src/`, the current call composition
under `apps/web/src/app/rooms/[room]/`, the maintenance module, the Swift Control
Agent sources, root scripts, and Docker/Actions configuration. It deliberately
does not assert the current state of a VPS, GitHub Actions run, GitHub Release,
Apple notarization, DNS, Sentry, Google, or physical-device WebRTC acceptance;
those require their respective external evidence.

The stale framework-template READMEs in `apps/api/` and `apps/web/` were removed.
The historical landing redesign plan remains as a record but is superseded by
the current web design system.

## Open review point

`WEB_ORIGIN` is documented as a comma-separated CORS allowlist for custom/tunnel
origins. The maintenance controller currently compares a browser request's
`Origin` against the raw `WEB_ORIGIN` value, so an owner-maintenance `POST` will
not match when that value contains more than one origin. This is an observed
implementation/intent question, not a documentation-only correction: decide
whether maintenance should support the general allowlist or intentionally demand
one operator origin before changing code or broadening its documentation.
