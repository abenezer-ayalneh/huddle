# Scoped in-call error boundaries: a panel crash must not drop the call

A render-time crash is one kind of **Fault**. The obvious way to catch it — a
single React error boundary around the call route — has a cruel failure mode for a
video app: when the boundary catches a throw it unmounts its subtree, which tears
down `<LiveKitRoom>` and **drops the participant out of the live call**. A
malformed chat data message or a bug in the **HostPanel** would then eject
everyone in it from the call. That is the opposite of graceful.

So in-call error boundaries are **scoped by blast radius**, not placed at the
route root. Volatile chrome — ChatPanel, HostPanel, the toast layer, the
Self-view — each sits inside its own boundary that fails to a small inline "this
panel crashed" fallback, leaving the call and its media untouched. A separate
**top-level** boundary catches anything that escapes the scoped ones. The
**media/stage core** is the only region whose crash is allowed to end the call
(and there it hands off to the existing connection-state UI, which owns the
disconnect lane — see [0017](0017-fault-vs-domain-outcome.md) for the
Fault taxonomy and the connection-UI boundary).

The rule of thumb: a crash in something _beside_ the call degrades that thing; a
crash in the call _itself_ ends the call. Nothing in between drops you.

## Considered Options

- **Scoped per-widget boundaries + a top-level catch-all** — chosen: a side-panel
  bug can never evict you from a call; only a core media crash does. Costs a few
  extra boundary components and per-widget fallbacks.
- **One boundary per route** — rejected: simplest, but any uncaught render crash
  anywhere ends the call for that user — too blunt for long-lived call sessions.
- **Two-tier (media core vs. all chrome)** — rejected as the default: protects the
  call, but a single bad widget still resets the entire chrome, losing more than
  necessary. Acceptable as a fallback granularity if per-widget proves noisy.

## Consequences

- The call view gains several small boundaries with inline fallbacks; new volatile
  widgets are expected to bring their own boundary.
- A crashed panel shows a contained "this panel crashed" state while audio/video
  keep running — the call survives partial UI failure.
- Only a crash in the media/stage core ends the call, and it routes into the
  existing connecting/reconnecting/disconnected UI rather than a toast.
- Slightly more component scaffolding and more fallbacks to design and test; the
  trade is explicit and is the reason a future reader should not collapse these
  into one route boundary.
