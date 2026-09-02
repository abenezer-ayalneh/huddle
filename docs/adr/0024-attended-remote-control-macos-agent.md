# Attended Remote Control via a server-backed macOS Control Agent

Status: accepted

Huddle will support attended, in-call **Remote Control** on macOS. A Controller
requests control of a Sharer's desktop; the Sharer explicitly approves or denies
inside the active room. On approval, a signed/notarized native Swift **Control
Agent** joins the same LiveKit room as a short-lived companion, publishes the
Sharer's desktop, and applies the approved Controller's mouse and keyboard input.
The browser remains the call surface for both people. Plain-text Clipboard
Sharing is defined by ADR 0026 and is limited to the active Sharer, Controller,
and Control Agent.

This ADR changes the previous browser-only platform boundary. The terms Remote
Control, Sharer, Controller, and Control Agent are fixed in `CONTEXT.md`.

## Why this is worth an ADR

The choice is difficult to reverse: it adds privileged native code, a new token
and grant lifecycle, a cross-language data contract, macOS signing/notarization,
and a companion-participant topology. It is surprising because the room-visible
desktop is published by the Sharer's helper rather than the Sharer's browser.
It also makes a real security trade-off: LiveKit carries low-latency input, but
data messages alone are never accepted as authority.

## Decisions

### Attended and room-scoped only

Remote Control exists only while both people are admitted to an active Huddle
room. There are no support codes usable outside a room, stored device credentials,
background daemons, unattended access, or standing grants. Exactly one Remote
Control session may be active per room, and Remote Control and Present are
mutually exclusive.

The Controller starts the flow. The Sharer sees who is asking, that everyone in
the room will see the desktop, and—when Recording is active—that the desktop may
be recorded. Recording is allowed after that warning. The Controller may type
secrets; the product does not inspect or persist them.

### Native Swift/SwiftUI macOS helper

The Control Agent is a narrow Swift/SwiftUI macOS app using the official LiveKit
Swift SDK, macOS screen capture, and Core Graphics event injection. It requests
Screen Recording and Accessibility permission with explicit status and recovery
UI. It publishes no microphone/audio, shares only bounded plain-text clipboard
changes under ADR 0026, transfers no files, and implements no richer
remote-desktop features in v1. Windows and Linux are deferred.

The beta is distributed with a Developer ID signature and Apple notarization.
Entitlements are minimal and App Sandbox is not enabled because cross-application
screen capture and Accessibility event injection are the capability being sold.

### Entire selected display and Sharer-local switching

The selected display means the entire physical monitor, including its menu bar,
Dock, desktop, every app window, and the Control Agent window. The Control Agent
uses a small Huddle patch of LiveKit Swift v2.15.1, pinned to commit
7f3af1488411a9787e1e94ddd66b0bed2057bed3, with an opt-in
captureEntireDisplay option. Only the Remote Control track enables it; ordinary
browser screen sharing and all backend contracts are unchanged. The patch uses
ScreenCaptureKit's no-exclusion display filter and sizes the stream from the
selected display rather than the primary monitor.

After the Sharer chooses a different display in the agent, the same approved
session switches immediately without renewed approval. The agent releases all
held input, marks the session non-interactive, unpublishes the old track,
publishes the new full-display track, updates its Quartz geometry, and only then
re-enables input. If publication fails, the old desktop remains unpublished and
the agent stays non-interactive and retryable. During the gap, browsers render a
non-interactive switching-display surface and never promote another participant's
video into the Remote Control stage.

### Companion topology; hidden in product UI, visible to the SFU

The agent joins the room as `control-agent:<sessionId>`, with participant metadata
that maps it to the Sharer and active session. It is filtered out of Huddle's
participant grid, people lists, host participant controls, active-speaker logic,
and participant pickers. Its screen-share track remains room-visible and owns the
main stage.

We do not set LiveKit's protocol-level `hidden` grant: empirical verification of
the removed prototype showed that hidden participants' publications and sender
identity are also suppressed, so subscribers could not receive the desktop.
“Hidden companion participant” therefore means hidden from people-facing product
UI, not hidden from the SFU protocol.

### Server-backed grant; LiveKit is transport

Redis is the source of truth for the pending request, active grant, one-time
bootstrap code, connection state, and renewal deadline. The active grant binds:

- Room Code
- Remote Control session id
- Sharer identity
- Controller identity
- Control Agent identity

Approval consumes the pending request and creates this grant. The API writes a
display-safe projection to LiveKit room metadata so browsers and the Control
Agent receive changes in real time. Postgres stores a metadata-only audit row
through requested, active, denied, ended, expired, or failed states.

Reliable data packets are the low-latency wake-up for request/deny UI and carry
clicks, keys, and the clipboard copy/paste commands; lossy packets carry
coalesced pointer moves. A target Sharer's browser also briefly polls its
participant-authorized pending-request endpoint while no Remote Control state is
active, so a missed request wake-up packet cannot strand the Controller. That
endpoint returns the request only to its exact Sharer and never publishes
pending consent state in room metadata. Its private response is `no-store` and
includes an API-calculated remaining request lifetime; browsers use that
server-relative duration instead of comparing an absolute server timestamp to
their own clocks. Every privileged Controller packet uses
the session id and one shared monotonic authorization sequence. The Control
Agent executes it only when the
SFU-attested sender is the grant's exact Controller and its token/room-metadata
grant still matches all identities and is inside the renewal deadline. A forged
packet from any other participant is ignored. The agent's clipboard updates are
reliably addressed only to the exact Controller. No input or clipboard content
is relayed to the API.

### Bootstrap and token scope

Sharer approval returns an opaque bootstrap code, not a LiveKit JWT. The browser
passes only the Room Code, session id, short-lived code, and public API origin to
the `huddle-control` deep link. Redemption is atomic and single-use. It returns a short-lived token
that may join one room, subscribe to data/metadata, publish the selected screen
share, and publish recipient-targeted clipboard updates. The token carries no
room-admin, camera, microphone, or Host authority and is never stored at rest.

### Lifecycle and authority

The Sharer must reconfirm every 30 minutes. The confirmation explicitly restates
mouse, keyboard, and plain-text clipboard sharing. Renewal advances the deadline
by another 30 minutes; missing it expires the grant, clears room metadata,
disconnects the agent, and completes the audit row. The grant also ends when the
Sharer, Controller, or Control Agent disconnects.

Only the Sharer and Controller may call the Remote Control stop endpoint. The
room Host gains no special Remote Control stop authority, although the existing
remove-participant action remains unchanged. The agent's local Stop button simply
unpublishes/disconnects; the resulting participant-left lifecycle event ends the
grant without making the agent a third stop authority.

### Persistence boundary

The audit stores identities/names, agent identity, status, timestamps, renewal
deadline, and end reason. It never stores keystrokes, pointer events, clipboard
contents, screenshots, video frames, passwords, or other secret contents.

## Alternatives considered

**Browser-only pointer guidance.** Rejected because browsers cannot synthesize
OS-level input; it would be annotation, not Remote Control.

**Browser extension.** Rejected because extensions remain constrained to browser
content and do not provide general macOS desktop input/capture with an acceptable
permission and distribution model.

**Separate remote-desktop signaling/service.** Rejected because admitted room
presence, media routing, data transport, and lifecycle signals already exist in
LiveKit. A second realtime plane would duplicate identity and connectivity logic.

**Full native meeting client.** Rejected because only the Sharer's privileged
capture/injection capability needs installation. Moving camera, mic, chat, and
the call UI out of the browser would abandon Huddle's browser-first shape.

**Client-only grants over data messages.** Rejected because any participant can
construct a packet. A privileged input injector requires server-backed,
identity-bound authority with expiry and an audit trail.

## Consequences

- Huddle now owns a privileged native release and Apple signing/notarization
  workflow in addition to the web/API deployment.
- Web, API, and Swift code duplicate a small versioned input/metadata contract;
  changes must remain additive or bump the protocol version.
- Remote Control availability depends on the Sharer's macOS permissions and
  installed agent, but Controllers need no install.
- Manual acceptance requires two browser participants and the signed macOS app;
  headless CI can cover state machines, contracts, builds, and forged-input
  rejection but not real screen capture or injected input.
