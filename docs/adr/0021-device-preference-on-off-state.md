# ADR-0021: Device Preference to include microphone/camera on/off state

**Status:** Accepted

**Date:** 2026-06-27

**Context:**

The [[Device Preference]] currently stores only device IDs (which camera, microphone,
speaker to use). When a participant joins a new huddle or returns to the app, they
must manually toggle their microphone and camera on or off again, even if they had a
consistent preference (e.g., always joining with camera off).

Storing the on/off state in Device Preference would avoid this repetition while
respecting the optional nature of Device Check overrides.

**Decision:**

Extend [[Device Preference]] to include the microphone and camera on/off states
(whether each track should start enabled or disabled).

- **What to store:** Only the toggle state (on/off); device IDs remain separate.
- **When to store:** At [[Device Check]] submission time only — when the participant
  presses the join button. Mid-call toggles do not update the preference.
- **Scope:** Browser-local (localStorage). Same storage mechanism as device IDs today.
- **Semantics:** Device Preference is a default, never enforced. The participant can
  always override the toggles on the next Device Check.
- **Room rules override:** [[Mute on Entry]] is a room-level rule that forces all
  participants muted on join, regardless of their saved preference. The host-set
  rule wins; the personal preference is superseded for that join only.

**Rationale:**

1. **Simplicity:** Saving only at Device Check submission is predictable and low-cost.
   Avoiding mid-call captures means temporary toggles don't pollute future defaults.

2. **Consistency:** Extending the existing Device Preference concept keeps media
   initialization (device + state) unified, rather than splitting it into two
   separate mechanisms.

3. **User control intact:** Treating it as a default (not enforced) keeps the Device
   Check interactive — users can always opt out for a given session.

4. **Room authority preserved:** [[Mute on Entry]] is a host control. Allowing the
   host rule to override personal preferences maintains host authority over call
   safety and meeting norms.

**Consequences:**

- A participant who frequently toggles camera mid-call to match different meeting
  contexts will not see those toggles reflected in the next join — only the Device
  Check's initial submission matters. This is intentional: one-off toggles should
  not become defaults.

- Guests without accounts (anonymous) and signed-in users share the same browser-local
  storage; the preference is not per-account. This is consistent with the existing
  device ID storage and acceptable for a browser-only app.

- On a shared browser, the most recent joiner's preference becomes the default for
  the next user. This is a known tradeoff of browser-local storage; it is not
  account-scoped.

**Alternatives Considered:**

1. **Save on every mid-call toggle:** Pros: captures real-time preference. Cons:
   temporary toggles pollute defaults; more storage churn; harder to reason about
   "what is my default?"

2. **Server-side storage per account:** Pros: syncs across browsers; only affects
   signed-in users. Cons: adds server infrastructure; guests still need fallback;
   introduces account-device coupling where none exists today.

3. **Hybrid (server if signed-in, localStorage if guest):** Pros: best of both.
   Cons: adds complexity and two code paths to maintain.

We chose **at-submit time, browser-local** because it is simple, consistent with
existing device storage, non-invasive to implement, and sufficient for the use case.
