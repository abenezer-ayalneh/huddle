# Faults are separate from Domain Outcomes; a stable code envelope, duplicated per side

Not every non-2xx response is an error to wave at the user. Huddle's flows
routinely reject through HTTP error statuses as a **normal** step: a host
**Deny**s a knock, a **Knock** expires, a non-host hits "you are not the host", a
guest knocks with no name. The glossary names these **Domain Outcomes** — they
are expected and already carry tailored UX (the guest's "denied" screen, an
inline "session expired", "a display name is required"). A **Fault** is the other
thing: an _unexpected_ failure no one chose — the API is unreachable, a request
500s, the network drops, LiveKit gives up, a component crashes rendering.

We deliberately **separate** the two. The error-handling strategy targets Faults
only; Domain Outcomes keep their bespoke handling and must never appear as the
generic Fault surface. A scary red "something went wrong" toast for a host
politely declining a knock would be a bug, not graceful handling.

On the wire a Fault is a stable envelope: `{ code, message, statusCode }`, minted
by a **global NestJS exception filter**. `code` is a documented string union (in
`docs/API_CONTRACT.md`) — `SESSION_EXPIRED`, `ROOM_NOT_FOUND`, etc. — so the web
can react _specifically_ (re-login vs. retry vs. reload) rather than guessing from
a coarse HTTP status, several of which collide (many distinct faults are 400/401).
`message` is the human-readable fallback.

The code union is **duplicated per side**, not extracted into a shared
`packages/*` workspace. The web defines its own copy of the codes it cares about
and, crucially, treats any **unknown** code as a generic Fault — it never crashes
on or renders a raw code. This keeps the first shared-package tooling off the
table while the contract is small; `API_CONTRACT.md` is the source of truth the
two copies track.

The same filter handles observability: **5xx Faults log at error** (stack +
context, via the existing JSON logger); **4xx Domain Outcomes stay quiet**
(debug/none) so normal rejections don't drown the logs.

## Considered Options

- **Separate Faults from Domain Outcomes; stable code envelope; codes duplicated**
  — chosen. Clear taxonomy, specific client reactions, tolerant of unknown codes,
  no premature shared package.
- **One uniform pipeline (all non-2xx are errors)** — rejected: simplest code
  path, but it shows expected rejections as faults, contradicting the glossary and
  the tailored UX those flows already have.
- **Status + message only, no code enum** — rejected: HTTP status is too coarse;
  the client can't tell `SESSION_EXPIRED` from a plain bad request, both 401/400.
- **Shared `@huddle/contracts` package for the codes** — rejected for now: the
  drift-proof option, but it pulls in the project's first cross-app package
  (tsconfig refs, build wiring) for a contract small enough to keep in sync by
  documentation. Revisit if the code set grows or drift actually bites.

## Consequences

- A global exception filter is the single place the API shapes error responses and
  decides log level; controllers keep throwing ordinary Nest exceptions.
- The web switches on `code` for known Faults and falls back to a generic Fault for
  anything unrecognized — forward-compatible with new server codes.
- `docs/API_CONTRACT.md` must list every Fault code and is the contract both
  duplicated copies follow; adding a code means updating the doc and any side that
  special-cases it.
- Domain Outcomes are explicitly out of scope for the Fault surface; their handling
  is reviewed case by case during migration, not auto-routed.
- The two code copies can drift silently — accepted; the doc and code review are the
  guardrail. If that proves fragile, the shared package is the escalation.
