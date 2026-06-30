# Blocked or unavailable devices recover in place and are Domain Outcomes, not Faults

When a participant's camera or microphone can't be acquired, the cause is their
own choice or local environment — they blocked the permission, another app holds
the device, or none is present — not an unexpected failure of Huddle. We treat
this as a **Domain Outcome** with bespoke UX (**Device Recovery**), never the
generic [Fault](../../CONTEXT.md) surface. This reverses the prior host-path
behaviour, where the Device Check routed `getUserMedia` failures into the Fault
toast (`apps/web/src/app/rooms/[room]/CallStage.tsx`: _"Couldn't access your
camera or microphone… Check browser permissions and try again"_) while the guest
path silently continued — the same event, handled two incompatible ways. Both now
continue without media and offer Device Recovery as the way back. See ADR-0017 for
the Fault vs. Domain Outcome taxonomy this applies.

Device Recovery is **per-device and state-aware**. Camera and microphone
permission state are tracked independently — one can be blocked while the other
works — and the affected button reflects that state **on load**: a denied device
shows red with a small alert badge, gives up its toggle behaviour, and disables
its device picker (which reads "Permission blocked"). Pressing the badged button —
or its keyboard shortcut, which mirrors the button — **re-requests the permission
directly**: it calls `getUserMedia` from the gesture, which makes the browser show
its own permission popup, the same move Google Meet makes; we do not lecture the
user about the address-bar icon. Only if the browser refuses to re-prompt (or the
user re-denies) do we fall back to a centered dialog with friendly,
**browser-tailored** unblock instructions. We also listen for the permission to
change (e.g. unblocked from the address bar). Regaining access **turns the device
back on** and repopulates its picker — the same tap that re-grants is the tap that
goes live — _except_ on the first-time grant of a normal join, which records no
failure and so leaves the saved Device Preference (e.g. join muted) untouched. The
same mechanism serves both the Device Check and the in-call control bar, where the
blocked button also drops its Switch Device chevron.

## Considered options

- **Recover in place; classify as a Domain Outcome (chosen).** Honours ADR-0017,
  gives the user an actual path back, and matches Google Meet's behaviour.
- **Keep surfacing it as a Fault.** Rejected: a Fault is an unexpected failure no
  one chose; a permission the user themselves denied is the opposite, and the red
  Fault toast offers no route to recovery.
- **Re-request on click; instructions only as a fallback (chosen).** Modern
  browsers re-show the permission popup when `getUserMedia` is called from a user
  gesture, even after a previous block — so the badged button fires the native
  popup directly, like Google Meet. The browser-tailored unblock steps remain only
  for browsers that won't re-prompt.
- **Instructions-first (point at the address-bar icon).** Rejected as the primary
  path: it makes the user hunt for a browser control when the app can just ask
  again. Kept only as the fallback.
- **Leave the device off after recovery.** Rejected: making the participant tap
  twice — once to re-grant, once to actually turn on — is pointless friction. We
  turn the device back on when access returns to one they were actively trying to
  use, carving out only the first-time grant of a normal join so the saved on/off
  Device Preference (mute-on-join) still wins.
- **Treat camera and mic as one unit.** Rejected: browsers track them as separate
  permissions; lumping them misreports state ("both blocked" when only one is) and
  re-requests more than the user denied.

## Consequences

- The Device Check no longer routes media-access failures into `onError` / the
  Fault surface; the host path (CallStage) is aligned with the guest path's
  "continue without media", with Device Recovery as the in-place affordance.
- The auto-heal behaviour depends on the Permissions API (already used in
  `useMuteReminder`). Browsers without camera/mic permission queries
  (e.g. Firefox, Safari) degrade gracefully to a manual "Try again" plus a
  reload hint — no auto-recovery, but no dead end either.
- A new shared surface (the alert badge + recovery dialog) is owned by both the
  Device Check and the in-call control bar; the blocked state shows the badge on
  load, suppresses the in-call Switch Device chevron, and repurposes the press as
  "re-request the permission" (the dialog appears only if that re-request fails).
- The recovery dialog carries per-browser instruction copy and a graceful generic
  fallback for unknown browsers; this copy must be maintained as browser UI shifts.
