# Knock state moves from in-process memory to Redis

Phase 9. Until now, waiting-room **knocks** (a guest waiting to be admitted) live
in an in-process `Map` in `apps/api/src/rooms/rooms.state.ts`. Phase 9 moves them
to **Redis**.

## Why this is worth an ADR

It looks like over-engineering at first glance — the API runs as a **single
instance**, so an in-memory map is functionally correct for routing. A future
reader will reasonably ask "why Redis if there's only one API node?". The answer
is two concrete failure modes that an in-memory map can't fix:

1. **Restart/deploy drops waiting guests.** Every API restart (including a
   routine deploy) wipes the map, so a guest who knocked seconds earlier silently
   vanishes from the host's pending list and waits forever. Redis survives the
   restart.
2. **Stale knocks linger forever.** An abandoned knock (guest closed the tab
   without cancelling) stays `pending` indefinitely. Redis **TTL** lets knocks
   self-expire.

## What we're doing

- Store knocks in **Redis** via `ioredis` (Redis already runs in the stack for
  LiveKit, so no new infra).
- Give each knock a **TTL** so abandoned/stale ones expire automatically instead
  of accumulating or needing an in-process sweeper.
- Keep the API **single-instance** for now. We are _not_ building the pub/sub
  fan-out that multiple API nodes would require — that's a larger change worth
  doing only when the API actually scales out. Redis here buys correctness across
  restarts and TTL hygiene, not multi-node API.

## Consequences

- Knocks now survive API restarts/deploys, and the pending list stops
  accumulating dead entries.
- `RoomStateService` becomes async (Redis I/O) — callers in the rooms module
  adjust accordingly; behaviour (knock → admit/deny/withdraw/clear) is unchanged.
- The door is open to multi-instance API later: the state is already shared; only
  cross-node knock _notifications_ (pub/sub) would remain to add.
