# Keyboard shortcuts and push-to-talk

The call gets three keyboard gestures that mirror existing control-bar actions:
a **Keyboard Shortcut** for the microphone (⌘D / Ctrl+D), one for the camera
(⌘E / Ctrl+E), and **Push to Talk** (hold the spacebar). They drive the same
`useTrackToggle` state the control-bar buttons already use; no new media path is
introduced. The bindings deliberately match Google Meet so muscle memory carries
over. The modifier maps per-platform — Cmd (⌘) on macOS, Ctrl elsewhere.

⌘D/⌘E are claimed combos: ⌘D bookmarks the page, and a browser extension may bind
⌘E to its own command (observed live with a browser extension). The crux of this
decision is **how** we take them back. A bubble-phase `preventDefault` stops the
browser's default but **not** another keydown listener on the page — so the
extension still fires. We win the combo the way Meet/Zoom do:

- **Listen in the capture phase on `window`**, so we run before page-level
  listeners (where extension content scripts hook in) and before the browser acts.
- **Call `stopImmediatePropagation()` as well as `preventDefault()`** for ⌘D/⌘E,
  so the event reaches neither the browser default nor any other listener.

This defeats extensions whose shortcut is a page `keydown` listener — which is the
common case and the one we hit. It cannot defeat a shortcut registered as a true
browser-level command (`chrome.commands`), because the browser consumes that
before any page sees it; but neither could Meet, so that case is out of scope and
the user would rebind it at `chrome://extensions/shortcuts`.

The interception is surgical: only the _bare_ ⌘D/⌘E are taken (no ⌃⌘D, ⌘⇧E, AltGr
combos), and only those two combos call `stopImmediatePropagation` — every other
key, including ordinary typing, passes through.

Push to Talk is **hold-to-talk while muted only**: holding the spacebar while muted
turns the mic on for the duration of the hold and returns it to off on release;
when already live, the spacebar does nothing special. It is in-call only — there
is nothing to talk into before joining — so the audio/video shortcuts work on the
Device Check screen but push-to-talk does not. Feedback is the mic button's
existing live state; no separate indicator. Space is taken only unmodified and
outside text fields, with `preventDefault` (no `stopImmediatePropagation`) so it
stops page scroll / focused-button activation without disturbing other listeners.

## Considered Options

- **Bubble-phase `preventDefault` only** — rejected: stops the browser default but
  leaves an extension's page `keydown` listener firing; this was the original bug.
- **Drop the modifier (plain D/E keys)** — rejected: conflict-proof, but the user
  wants Meet's ⌘D/⌘E and accepts the capture-phase approach that makes them work.
- **A different / per-platform modifier (Alt, ⌘⇧)** — rejected: any modifier combo
  can be claimed by some extension; the capture-phase technique is the real fix.
- **Symmetric push-to-mute (spacebar flips the mic either way)** — rejected: more
  surprising when you are already talking; standard PTT only acts while muted.
- **A dedicated PTT overlay / shortcuts help panel** — deferred: the mic button
  state and tooltip hints cover it for now; revisit if discoverability suffers.

## Consequences

- The shortcut layer is a single capture-phase keyboard handler on `window` that
  reads the platform modifier and writes the same `useTrackToggle` state as the
  buttons.
- ⌘D/⌘E reach neither the browser (no bookmark) nor other page `keydown` listeners
  (extensions) while the call view is active — but a browser-level `chrome.commands`
  shortcut is outside any page's reach and would need rebinding by the user.
- The override is surgical: only the bare ⌘D/⌘E and unmodified Space are taken; any
  other combo (⌃⌘D, ⌘⇧E, AltGr+D, Shift+Space, …) passes through.
- Push-to-talk is inert on the Device Check screen and while typing; key-repeat is
  ignored so a held spacebar unmutes once, and the mic re-mutes on `blur` so it is
  never left stuck open. The mic is driven with an explicit on/off (not a flip), so
  a quick tap still ends muted.
- Tooltips carry the platform-correct hint (e.g. "Mute microphone (⌘D)"); there is
  no separate shortcuts panel.
