# Architecture decision records

The ADRs preserve deliberate trade-offs that are not safely inferred from code.
Unless an ADR states otherwise, treat it as an accepted decision at the time it
was written. It is **not** proof that the resulting feature is currently
deployed, externally configured, or physically accepted; use
[ROADMAP.md](../ROADMAP.md) for implementation/acceptance status and source
for current mechanics.

## How to use an ADR

- Read the relevant ADR before changing a security boundary, user-visible
  lifecycle, persistence choice, or product constraint.
- Preserve the rationale even if the implementation evolves. Add an explicit
  amendment or a successor ADR rather than silently rewriting history.
- Follow links to later decisions. The current contract and architecture may
  summarize a decision but do not replace its alternatives and consequences.

## Decision map

| Area                                      | ADRs      | Current reading rule                                                                                                                                                                                       |
| ----------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LiveKit credentials, data, and deployment | 0001–0005 | Keep the API secret server-only, use Postgres for durable records and Redis for ephemeral coordination; the deployment decision is a single VPS, with external rollout evidence separate.                  |
| Managed rooms and call behavior           | 0006–0023 | Room Codes, custom Huddle call UI, Present, recording consent, device behavior, and error semantics are deliberate. ADR 0008 superseded the early stock LiveKit UI described in historical roadmap phases. |
| Remote Control and distribution           | 0024–0026 | These form one safety boundary: attended macOS-only control, release/update constraints, and bounded ephemeral plain-text clipboard sharing. Do not weaken an exclusion by reading only one ADR.           |
| Observability, rejoin, recording delivery | 0027–0029 | Sentry is privacy-scrubbed web/API fault reporting, Direct Rejoin is call-scoped, and Drive delivery/retention is optional with external acceptance still required.                                        |
| Legal and PiP                             | 0030–0031 | Apache-2.0 repository licensing has its root `LICENSE`/`NOTICE` artifacts; desktop Document PiP supplements mobile/native PiP behavior in ADR 0020.                                                        |

## Notable amendments and historical context

- ADR 0011 amends the host-only recording model in ADR 0003; ADR 0022 changes
  download delivery; ADR 0029 changes retention and optional Drive delivery.
- ADR 0006 revises the earlier managed-room title direction to generated Room
  Codes with no titles.
- ADR 0031 extends the Picture-in-Picture model in ADR 0020; browser/device
  acceptance remains separate from the decision.
- ADR 0004 records an earlier CD deferral. The repository now contains deploy
  workflow code; [RUNBOOK_CICD.md](../RUNBOOK_CICD.md) is the current operational
  status and explicitly leaves GitHub/VPS activation as external evidence.
