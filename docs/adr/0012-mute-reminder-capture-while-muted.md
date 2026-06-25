# Mute Reminder keeps the mic capturing while muted

To tell a participant they're talking while muted (the Mute Reminder), the app
runs a local audio-level analyser on the participant's microphone **the whole
time they are muted**. LiveKit mute disables the published track, which emits
silence, so the only way to detect speech-while-muted is a separate getUserMedia
stream that keeps physically capturing. Consequently the OS "microphone in use"
indicator stays lit even though the participant believes they are muted.

We accept this because the feature is impossible otherwise, and it matches Google
Meet / Zoom behaviour. The reminder is purely local and advisory — it never
publishes audio, never changes mute state, and fires regardless of why the mic is
off (self-mute or Mute on Entry, ADR-0007).

## Considered Options

- **Capture only briefly / on demand** — rejected: you cannot know speech has
  started without already listening, so it can't catch the moment reliably.
- **On-by-default with an opt-out toggle** — deferred: more honest given our
  consent-first stance (cf. the Recording Indicator), but there is no settings
  surface yet, so it would be net-new scope. Revisit if the always-on mic draws
  complaints.

## Consequences

- The mic genuinely stays open while muted; the OS mic light is the user-visible
  signal, with no in-app setting to disable detection (MVP scope).
- The analyser stream is opened only while muted and torn down on unmute/leave,
  so an unmuted participant runs a single (LiveKit) capture, not two.
- If mic permission is denied, no input device exists, or the participant joined
  with audio off, detection is silently inactive.
