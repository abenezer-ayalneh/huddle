# Remote control via a native agent that joins the room as a hidden participant

Status: accepted

Remote Control — a Controller operating the Presenter's machine during a
presentation — requires OS-level input injection, which **no browser API
provides**. The controlling side is fully browser-feasible (capture input on the
presented video tile, send it over data messages); only the controlled side
needs native code. We ship a desktop **Control Agent** that joins the LiveKit
room itself as a hidden participant: it captures and publishes the monitor,
receives the Controller's input over data messages, and injects it into the OS.
The Presenter keeps using the browser for the call; the agent is plumbing,
launched per-presentation and holding no standing credentials.

Domain language lives in `CONTEXT.md` → "Remote control" (Remote Control,
Present with Control, Controller, Control Agent, Request/Offer, Revoke/Release).

## Why this is worth an ADR

Hard to reverse: a second client codebase (Rust, on the LiveKit Rust SDK) with
its own capture/publish path, plus a `control:*` data-message contract and an
agent-token API surface that other code will depend on. Surprising: the share
track of a controllable presentation is published by a hidden second
participant, not the Presenter's browser — a reader tracing tracks will wonder
why. Trade-off is real: two other shapes (full desktop client, localhost-bridge
agent) were viable and rejected for specific reasons.

## Alternatives considered

**Browser-only.** Rejected as impossible, not undesirable: there is no web API
to synthesize OS input events. This is a platform boundary, not an
implementation gap. (It does mean the Controller needs no install — that half
stays in the browser.)

**Full Tauri desktop client.** Wrap the existing Next.js app in Tauri; a Rust
layer injects input via IPC; anyone wanting to be controllable joins the call
from the desktop app. Reuses all UI and avoids pairing entirely. Rejected
because it moves the _whole call_ (mic, camera, chat, everything) into an
installed app just to add one capability — the install becomes the call surface
instead of a capability add-on, and the product's browser-first identity breaks
for exactly the users who present most.

**Thin companion agent over a localhost bridge.** The Presenter's browser keeps
capturing/publishing; a small tray app only injects input, paired to the
browser session via localhost WebSocket. Rejected for two reasons: the
localhost listener is a real attack surface (any web page can probe localhost
ports, so the bridge needs its own auth story), and coordinate mapping is
fragile — the browser knows the captured surface's dimensions but not its
position in the OS's display arrangement, so translating video coordinates to
global screen coordinates across multi-display setups is guesswork.

## The shape

- **Agent**: Rust core — LiveKit Rust SDK for room/track/data, native screen
  capture feeding a video source, `enigo`-class input injection — with a
  minimal Tauri shell (confirm dialog, monitor picker, active-session
  indicator, tray). Desktop only.
- **Room presence**: joins as identity `agent:<presenterIdentity>`; may
  publish only the screen-share source and data; never mic/camera. The person
  remains the Presenter — UI maps the agent's track back to them.
  **Correction from slice-1 verification:** the original intent was LiveKit's
  `hidden: true` grant, but hidden participants' track publications and sender
  identities are suppressed along with the participant — nobody can subscribe
  to a hidden agent's screen share. The agent therefore joins _visible at the
  protocol level_, and "never shown as a participant" is enforced by the web
  UI filtering the `agent:` identity prefix everywhere participants surface
  (grid placeholders, host panel, offer picker).
- **Pairing — deep link handoff**: the in-call browser asks the API for an
  agent token (short-lived, single-use, scoped as above), then opens
  `huddle://…` to launch the agent with it. The agent shows a confirm dialog
  (room, presenter identity, monitor picker) before joining. Copy-paste code is
  the fallback where custom URL protocols don't work. No localhost listener,
  no agent login, no credential at rest.
- **Browser↔agent signaling rides the room**: the Presenter's browser and
  their agent are both participants, so grant/revoke instructions are ordinary
  data messages — no side channel.
- **Enforcement lives in the agent**: it injects input only from the single
  identity it was told is the current Controller, attested by the SFU's sender
  identity on each data message.

## Decided behavior (the contract the protocol implements)

- **Consent, both directions**: a viewer can Request Control; the Presenter can
  Offer Control. Requests time out like Ask to Present.
- **No host bypass — a deliberate break with ADR 0009's precedent.** The host
  can force-take a _presentation_; nobody, host included, can take a _machine_.
  Control exists only by the Presenter's explicit per-session grant.
- **One Controller at a time**; Presenter may Revoke instantly, no
  confirmation; Controller may Release; control ends automatically when the
  presentation stops.
- **Present with Control is chosen at share time** and shares **one whole
  monitor, never a window**. Window capture would only pretend to confine
  control (overlapping windows swallow clicks; injection is OS-global), so the
  honest split is: plain Present = any surface, never controllable; Present
  with Control = one monitor. A plain Present can never become controllable
  mid-flight — the publisher differs.
- **Input scope**: mouse (move/click/drag/scroll), full keyboard, and
  **bidirectional continuous clipboard sync** for the session.

## Consequences

- A second codebase with its own release pipeline: installers, macOS
  notarization + Screen Recording/Accessibility permissions, Windows signing,
  Linux caveats (Wayland restricts both capture and injection).
- Presenter attribution changes: `usePresentation` derives the Presenter from
  the track's participant; controllable shares arrive under
  `agent:<identity>`, so the UI must resolve agent → person everywhere a
  Presenter is named.
- New API surface: the agent-token endpoint, authorized by the in-call
  session and scoped down (hidden, screenshare + data only, single-use TTL).
- The `control:*` schema joins `present:*` as a cross-client contract — now
  spanning two codebases (TS and Rust), so it must carry a version field.
- **Clipboard sync ships with no guards, documented** — concealment-flag
  filtering (the marks password managers put on clipboard writes) was
  considered and declined for v1. Consequence accepted: anything the Presenter
  copies during a session, including a password-manager copy, reaches the
  Controller. Revisiting this is additive (filter flagged entries), not
  architectural.
- Controlled targets are **desktop-only**. Mobile browsers cannot present at
  all (`getDisplayMedia` is unavailable), iOS can never be a target (no input
  injection API exists, even natively), and an Android target would be a
  Kotlin/AccessibilityService build — recorded in the roadmap as a someday
  note, explicitly not a commitment and not a Tauri job.
