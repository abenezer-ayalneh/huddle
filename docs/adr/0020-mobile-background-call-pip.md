# Mobile background-call survival via native Picture-in-Picture

## Context

The target platform is mobile **web browsers**, not a native app (see PRD). Users
expect a call to keep running when they switch to another app or lock the screen,
ideally shown as a floating window — the way native Meet/Zoom behave. Mobile web
cannot deliver that literally: a backgrounded page is suspended, and the only
floating-window primitive available is the browser's native Picture-in-Picture,
which renders **exactly one `<video>` element** — no grid, no compositing, no
controls.

## Decision

We support a **[[Background Call]]**: when the app is backgrounded mid-call we keep
the [[Call Connection]] alive. The participant's microphone keeps publishing (they
stay heard); their camera turns off (the OS suspends capture anyway, and others see
the [[Avatar]] rather than a frozen frame) and is restored on foreground. The main
stage is surfaced as native **[[Picture-in-Picture]]** — a single feed mirroring
on-stage precedence (presented screen → [[Pin]] → [[Active Speaker]]). PiP is
entered via an explicit pop-out control (a user gesture) and, where the browser
allows it, automatically on backgrounding.

## Considered options

- **Floating multi-participant grid** — rejected: impossible on mobile web; would
  require a native wrapper or installed PWA, a scope expansion beyond the stack.
- **Document Picture-in-Picture** (renders arbitrary DOM) — rejected: desktop
  Chrome only; absent on every mobile browser.
- **Auto-enter PiP only, no button** — rejected: mobile browsers commonly block
  programmatic PiP without a user gesture, so it would silently fail for many
  users. We keep a manual control and treat auto-enter as best-effort.

## Consequences

- On **iOS**, entering PiP is also the mechanism that keeps the media session
  alive in the background; without PiP, iOS Safari suspends the call. On
  **Android**, background audio survives without PiP. Background continuity is
  therefore best-effort and platform-dependent, strongest when PiP is active.
- The floating window shows one feed, never the grid — an accepted, documented
  limitation, not a bug.
