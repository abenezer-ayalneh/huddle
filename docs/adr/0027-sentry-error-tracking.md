# Sentry tracks unexpected web/API faults; privacy scrubbing and native opt-out remain

Huddle needs an issue tracker for failures that a developer cannot reproduce
from container logs alone. Sentry is added to the Next.js web app and NestJS API
as an **error tracker**, while Huddle's existing Fault/Domain Outcome taxonomy
remains authoritative.

The web SDK initializes in the browser, Next.js Node runtime, and Edge runtime.
It reports route/global/scoped React boundary crashes and uncaught server
component/request failures. The API SDK initializes before NestJS or any
instrumented dependency. The existing global `FaultFilter` reports only its 5xx
lane; expected 4xx Domain Outcomes stay out of Sentry. A bootstrap failure is
captured and flushed before the API process exits.

Sentry is opt-in by environment: blank DSNs keep each SDK disabled. Web and API
use separate Sentry projects so ownership, alerting, and release data do not get
mixed. Performance tracing and Session Replay are not enabled; this change is
error tracking only.

## Privacy boundary

`sendDefaultPii` is false. Before an event leaves the process/browser Huddle:

- removes user identity, request headers, cookies, query strings, and bodies;
- removes console breadcrumbs and arbitrary breadcrumb payloads;
- parameterizes room, recording, and Remote Control path identifiers;
- removes URL queries and redacts emails, bearer credentials, Control Agent
  links, and common secret query parameters from retained messages.

Sentry does not receive media, chat content, clipboard content, access tokens,
host keys, bootstrap codes, raw room identifiers, or recording files.

The macOS Control Agent is deliberately excluded. ADR 0025's user-triggered
sanitized diagnostics flow remains its only support channel; the native app
still has no telemetry or automatic issue submission.

## Release and source maps

`SENTRY_RELEASE` should be the deployed Git commit SHA. The Next.js config
uploads source maps only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and
`SENTRY_PROJECT_WEB` are all present during the build, then removes generated
browser source maps. The auth token is build-only and belongs in the CI secret
store or gitignored production environment. Production Compose exposes it only
through a BuildKit secret mount and clears it from the API runtime; it never
belongs in `NEXT_PUBLIC_*` or a runtime image.

## Consequences

- Browser, Next.js server/edge, API 5xx, and API bootstrap failures appear as
  actionable Sentry issues once their DSNs are configured.
- Expected validation/auth/room-flow 4xx responses remain quiet.
- Local development and tests emit nothing unless a developer explicitly adds
  a DSN.
- Live ingestion cannot be verified from the repository alone; deployment
  acceptance requires a configured Sentry project and one synthetic error per
  web/API project.
