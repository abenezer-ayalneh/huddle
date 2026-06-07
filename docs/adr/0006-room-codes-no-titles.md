# Rooms identified by auto-generated Room Codes, not human titles

Status: accepted (revises the Phase 7 managed-rooms design)

Phase 7 gave every managed room a human **title** and listed all of a host's
rooms in the lobby. We are dropping that: a room now has **no name**, only an
auto-generated **Room Code** (a Meet-style identifier like `abz-mnpq-rfk`) that
serves as both the share-link path and the LiveKit room name. Creating a meeting
takes no input — the host clicks once and a code is minted.

## Why this is worth an ADR

It directly reverses a deliberate earlier decision, so a future reader will see
the old title/list code paths gone and wonder why. The pull was toward a
dead-simple, Google-Meet-style "New meeting" flow: no naming step, no clutter.
The cost is real — opaque codes are not human-memorable or searchable, and there
is no at-a-glance "what was that meeting" label.

## What we're doing

- The room's `slug` column now stores a generated Room Code (codes are minted
  server-side and retried on collision); the old "slugify the title" path is
  gone, and the custom-slug override is removed — codes are **always** generated.
- The `title` column is dropped (a destructive migration; acceptable pre-launch).
- The lobby no longer lists all rooms. **Instant meetings** jump straight into
  the call and appear in no list; their guest link is copied from inside the call
  (a new Host-panel control). The lobby keeps only a minimal list of **future
  scheduled meetings**, labeled by start time with the Room Code beneath.

## Consequences

- **Scheduling is retained** but is the only thing the lobby list shows; once a
  scheduled meeting's start time passes it drops off the list.
- **Recordings lost their per-room list entry point.** To preserve post-call
  access we add a dedicated `/recordings` page backed by a new session-authed
  `GET /recordings/mine` that enumerates a host's recordings across all their
  rooms — independent of the (now scheduling-only) room list.
- Reversing this later means re-adding the `title` column, the create-time naming
  UI, and the full room list.
