# ADR-0030: Apache-2.0 licensing for self-hosted adoption

**Status:** Accepted

**Date:** 2026-08-06

## Context

Huddle is built for small teams and technical operators who want to run the
meeting stack on infrastructure they control. The public landing page needs an
accurate license and deployment story, and downstream operators need a license
that permits internal deployment, modification, and redistribution with clear
attribution.

## Decision

Huddle source is released under the Apache License, Version 2.0. The repository
ships the full `LICENSE`, a project `NOTICE`, and an ownership/dependency audit.
Third-party dependencies and the vendored font files retain their own licenses
and notices. Huddle trademarks, marks, website content, and the official
evaluation deployment remain outside the source-code grant.

The official deployment is described as a capacity-limited evaluation demo,
not as a hosted subscription service or a production availability commitment.
Operators are responsible for their own VPS/Docker host, provider costs,
storage, TLS, backups, and operational policy.

## Alternatives considered

- **Network copyleft / AGPL-style licensing.** Rejected for the initial release:
  it would add a reciprocal network-service obligation that is not necessary to
  achieve the current adoption goal and would make small-team self-hosting less
  straightforward to evaluate.
- **No license or a source-available custom license.** Rejected: public code
  without a grant creates ambiguity and does not give operators a predictable
  right to deploy, modify, or redistribute it.
- **Proprietary hosted-service terms as the only grant.** Rejected: Huddle's
  product direction is self-hosted-only and the official deployment is only an
  evaluation surface.

## Consequences

- Contributors and operators receive a familiar permissive grant with a patent
  license and explicit attribution conditions.
- Huddle must preserve the Apache-2.0 text and update dependency notices when
  direct dependencies change.
- The license does not grant Huddle marks or make third-party dependencies
  Apache-2.0; the legal pages and public copy must keep those boundaries clear.
- Apache-2.0 does not promise support, uptime, compliance, recording durability,
  or external-provider acceptance. Those remain implementation and operational
  concerns.
