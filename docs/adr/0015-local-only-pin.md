# Pin is a local-only focus; no synced Spotlight

A participant can **Pin** one other participant to fill the main stage, dropping
the rest — and their own floating **Self-view** — into a thumbnail strip (the
same one-big-plus-strip shape a presentation uses). A Pin is **local-only**: it
changes nothing but the pinning participant's own view. It is never broadcast,
needs no host authority, and two participants can pin different people at the same
time without conflict.

We deliberately do **not** build a synced **Spotlight** (a host forcing the same
focus onto everyone's screen). The request — "participants could rearrange the
video windows" — is satisfied by per-viewer control, and keeping it local avoids
a whole coordination layer: no LiveKit data messages for pin state, no host-key
authority, no last-writer-wins conflict handling, no propagation through room
metadata (the machinery Mute on Entry and the Recording Indicator need). Pinning
becomes pure client view-state.

Precedence with presentation is fixed: a presentation **outranks** a Pin. While
someone presents, the presented screen owns the stage and the Pin is _suspended_
(remembered, not discarded); when the presentation ends, the pinned layout
returns. Pin state is **session-only** — held in call view-state, reset on
rejoin, and cleared automatically if the pinned participant leaves (their tile no
longer exists to focus).

## Considered Options

- **Local-only Pin** — chosen: per-viewer focus, zero sync, no new authority.
- **Synced host Spotlight** — rejected for now: forces one focus on every screen,
  which means data-message sync, host-only permission, and conflict rules — a
  significantly larger build for a feature the request didn't ask for. Left as a
  possible future addition; the glossary reserves the name "Spotlight" for it.
- **Both (local Pin + host Spotlight)** — rejected: two focus systems to build,
  reconcile (what wins when I've pinned A but the host spotlights B?), and test.
- **Drag-to-reorder the grid instead of Pin** — rejected: a more literal reading
  of "rearrange," but reordering equal tiles does little; promoting one to focus
  is what people actually want from a Meet-style layout.
- **Persist the pinned identity across sessions** — rejected: participants rejoin
  with new identities, so a remembered pin usually wouldn't re-match; session-only
  is both simpler and more correct.

## Consequences

- Pinning is client view-state only; no server, data-channel, or host-key changes.
- Different participants can see different layouts at the same instant — expected
  and fine, since each Pin is personal.
- A presentation always preempts a Pin; the Pin restores afterward. The Pin and
  presentation layouts share the one-big-plus-strip structure.
- No way for a host (or anyone) to focus a participant on everyone's screen. If
  that need appears, "Spotlight" is the reserved term and a separate, additive
  feature.
- Pin clears on rejoin and when the pinned participant leaves; there is no stale
  pin to reconcile.
