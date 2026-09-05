# Desktop rich Picture-in-Picture via Document Picture-in-Picture

Status: accepted

Date: 2026-09-04

## Context

Huddle's native Picture-in-Picture keeps one stage feed visible outside the
browser. That primitive is valuable for mobile Background Call continuity and
for browsers that do not expose a document-level PiP window, but it cannot
render camera-off Avatars, multiple participants, chat, or Huddle controls.

Google Meet's desktop experience establishes a useful expectation: a small,
movable, resizable, always-on-top meeting companion with participant context,
compact controls, and a browser-provided Back to tab action. Chrome's Document
Picture-in-Picture API can host arbitrary HTML and multiple media streams while
the opener remains the authority for the call.

## Decision

On capable desktop browsers, Huddle progressively prefers Document PiP. The
React `PictureInPictureSurface` is rendered into the browser-owned PiP document
through a portal. It uses the same LiveKit room tracks, Pin state, chat
subscription, selected theme, device state, presentation status, Recording
indicator, Waiting Room count, and Remote Control safety state as the main call.

The request starts at 360 × 520px; the browser owns the title bar, origin
identity, Back to tab action, close action, resize, and placement. Huddle keeps
one surface per tab, reuses an existing surface, and closes it when the call
unmounts, disconnects, or intentionally ends. A manual surface stays open until
the user closes it or returns to the call. Automatic surfaces close when the
call tab becomes visible again.

Automatic behavior is local-only and stored as `huddle-pip-auto`: Never, tab
switching, presentation of a window/monitor, or Always. New browsers default to
tab switching. Media Session is used for automatic tab-switch entry where the
browser supports it. A Present trigger is eligible only when the capture's
`displaySurface` is `window` or `monitor`; browser-tab capture does not pop out
another window.

The rich surface is intentionally bounded to Huddle's existing capabilities:
four human participant feeds with Self-view anchored top-left; the remaining
slots use Pin → Speaking Participants (speech-start order) → stable remote join
order,
with participant-aware single, pair, trio, grid, stacked, and short-window
primary compositions. It also provides People/Presentation layouts, microphone,
camera, chat, More, Return to call, and confirmed Leave. Control Agent identities are filtered from ordinary people
lists. Approval, admission, recording consent, and Remote Control input remain
in the full call; a PiP notice returns the user there. A Remote Control Sharer
never sees the captured desktop in PiP, while other authorized viewers may see
the selected display read-only.

If Document PiP is unavailable or blocked, Huddle falls back to the existing
single-feed native video PiP, then WebKit presentation mode, then hides the
control. Automatic failures are recoverable session information and never a
call Fault. No API, LiveKit grant, database field, analytics event, or package
dependency is added.

## Consequences

- Desktop Chrome gains a focused working companion without duplicating call
  authority or media publication.
- The main call and PiP must keep shared state contracts in CallStage; PiP must
  not begin its own admission polling, approval flow, or Remote Control input.
- The portal document needs cloned styles, font-variable classes, language, and
  live theme synchronization because it is outside the main call DOM.
- Document PiP remains a desktop enhancement, not a mobile Background Call
  replacement. Physical browser, resize, permission, and multi-participant
  WebRTC acceptance remains manual.
