# Remote Control — implementation plan

Phase 10. Language: `CONTEXT.md` → "Remote control". Decision:
`docs/adr/0010-remote-control-hidden-agent.md`. This file is the build plan;
when reality diverges, update this file or the ADR, not just the code.

## Picture

```
Controller (browser)                Presenter (browser)            Presenter's machine
┌─────────────────────┐            ┌─────────────────────┐         ┌──────────────────────┐
│ presented video tile│            │ in-call UI          │         │ Control Agent        │
│  input capture      │            │  grant/revoke UI    │  deep   │  (Rust + Tauri shell)│
│  control:input ───────┐          │  "Present w/ control"│─ link ─▶│  capture ─▶ publish  │
└─────────────────────┘ │          └──────────┬──────────┘         │  inject ◀─ input     │
                        │   LiveKit room       │ control:grant      │  clipboard sync      │
                        └────── (SFU data) ────┴────────────────────▶                      │
                                                                    └──────────────────────┘
```

Everyone talks through the room. The agent joins as `agent:<presenterIdentity>`;
it publishes the screen-share track and is the sole enforcement point — it
injects input only from the identity named in the last grant it received from
its own presenter's browser.

> **Empirical correction (slice 1):** the agent is _not_ `hidden: true`.
> LiveKit suppresses a hidden participant's track publications and sender
> identity along with the participant — nobody could subscribe to the hidden
> agent's screen share. "Never shown as a participant" is enforced by the web
> UI filtering the `agent:` identity prefix (VideoGrid placeholders, HostPanel,
> Offer picker) instead. See docs/adr/0010 → Consequences.

## Components

### 1. Protocol — `apps/web/src/lib/controlProtocol.ts` (+ Rust mirror)

Sibling of `presentProtocol.ts`, topic `control`, every message carries
`v: 1`. The schema is a contract across TS and Rust — change only additively
or bump `v`.

| Type                   | Sender              | Recipient         | Payload                                                              |
| ---------------------- | ------------------- | ----------------- | -------------------------------------------------------------------- |
| `control:request`      | viewer              | Presenter         | `{ requesterId, requesterName }`                                     |
| `control:offer`        | Presenter           | chosen viewer     | `{}`                                                                 |
| `control:accept`       | offered viewer      | Presenter         | `{}`                                                                 |
| `control:decline`      | either              | counterpart       | `{}`                                                                 |
| `control:grant`        | Presenter's browser | **agent** + ctrl  | `{ controllerId, controllerName }`                                   |
| `control:revoke`       | Presenter's browser | agent + ctrl      | `{}`                                                                 |
| `control:release`      | Controller          | agent + Presenter | `{}`                                                                 |
| `control:stop-present` | Presenter's browser | its agent         | `{}` (unpublish + leave; the share button's "stop" for agent shares) |
| `control:input`        | Controller          | agent             | input event (below)                                                  |
| `control:clipboard`    | Controller ⇄ agent  | each other        | `{ text }`                                                           |

Input events (inside `control:input`): `{ kind: "move"|"down"|"up"|
"scroll"|"key", x?, y?, button?, dx?, dy?, key?, code?, action?, modifiers? }` with `x, y`
**normalized to [0,1] of the published track** — the agent owns the mapping to
monitor pixels (it knows the monitor's origin, size, and DPI scale; the
browser doesn't). Mouse moves go over **lossy** data messages at ≤ 60 Hz
(coalesce on the sender); everything else reliable.

Lifecycle rules the state machines implement (both sides):

- Request times out (30 s, reuse the Ask to Present pattern/constants).
- Exactly one Controller; a new grant implies revoking the old one first.
- Revoke is instant and unconditional; Release is the Controller's same exit.
- Agent tears down control on: revoke, release, controller disconnect,
  presenter's browser disconnect, share stop, room disconnect.
- **No host bypass — there is deliberately no `control:force-*` message.**

### 2. API — pairing endpoints (`apps/api`) ✅ implemented

Two-step so the JWT never sits in a URL and codes are atomically single-use:

- `POST /rooms/:room/control-agent-link` — authorized by the participant's own
  LiveKit join token (`x-participant-token` header, verified server-side via
  `TokenVerifier`; `ParticipantGuard`). Mints an 8-char one-time code in Redis
  (60s TTL). Returns `{ code, expiresInSeconds }`.
- `POST /control-agent/redeem` `{ code }` — public; the code is the bearer.
  Redis `GETDEL` makes the first redeem win. Mints the agent token (identity
  `agent:<presenterIdentity>`, name = presenter's display name, `canPublish`
  restricted to screen-share sources, `canPublishData`, `canSubscribe: false`,
  **not hidden** — see the correction above, ttl 2m) and returns
  `{ token, livekitUrl, room, presenterIdentity, presenterName }`.

Code: `apps/api/src/rooms/control-agent.service.ts`, `participant.guard.ts`,
`livekit.service.ts` (mintAgentToken / verifyParticipantToken). Unit tests in
`control-agent.service.spec.ts`. No new env vars.

### 3. Web — Present with Control + session UX (`apps/web`)

- **ControlBar**: the share button grows a split/secondary action, "Present
  with control" (desktop browsers only — hide where `getDisplayMedia` is
  absent anyway). It calls the link endpoint, then opens
  `huddle://present?code=…&api=…` **from a hidden iframe** — assigning
  `location.href` to an unhandled custom scheme unloads the page and
  disconnects the call (found in slice-1 verification). A dialog shows the
  copy-paste code as the no-handler fallback and auto-closes when the agent's
  share appears.
- **Presenter attribution**: `usePresentation` derives the Presenter from the
  track's participant — controllable shares arrive under `agent:<identity>`.
  Add one resolver (agent identity → human participant) and use it everywhere
  a Presenter is displayed; the agent must never appear as a participant.
- **`useRemoteControl`** hook (sibling of `usePresentation`): the
  request/offer/grant state machine, plus session state (who controls now).
- **Controller input capture**: on the presented tile while Controller —
  pointer/keyboard listeners, normalize coordinates against the _rendered
  video box_ (object-fit letterboxing!), coalesce moves, swallow
  browser-reserved keys it can. Visible "You are controlling X — Release"
  ribbon; Esc-Esc or button to Release.
- **Presenter indicators**: persistent "Y is controlling your screen — Revoke"
  ribbon (browser) while a session is live.
- **Single-presenter rule spans both kinds** — Ask to Present must treat an
  agent-published share as "someone is presenting" (it already keys off the
  ScreenShare source, but verify, including host force-take of a _presentation_
  while a control session is live: control must die with the share).

### 4. Control Agent (new: `apps/agent`)

Rust core + minimal Tauri shell (Tauri 2 — confirm dialog, monitor picker,
session indicator, tray; deep-link plugin for `huddle://`).

- **Room**: `livekit` (Rust SDK) — join (not hidden; see correction above),
  publish screen track, data in/out.
- **Capture**: `scap`/`xcap`-class capture of one monitor feeding a
  `NativeVideoSource` (validate frame-rate/format path early — riskiest crate
  choice in the stack).
- **Injection**: `enigo` for pointer/keys; map normalized coords → monitor
  pixel coords (origin + DPI scale).
- **Clipboard**: `arboard` + a polling watcher; mirror both directions for the
  session, text-only v1. **No concealment-flag filtering — decided, see ADR;
  do not add it silently.**
- **Enforcement**: accept `control:grant`/`revoke` only from
  `<presenterIdentity>` (its own human); accept `control:input` only from the
  currently granted Controller; identities come from the SFU's sender
  attestation on each message.
- **OS permissions onboarding**: macOS Screen Recording + Accessibility (TCC)
  prompts on first run, with a status screen; Windows `SendInput` (note: can't
  inject into elevated apps unless the agent is elevated — document, don't
  chase); Linux: X11 first, Wayland needs the `xdg-desktop-portal`
  RemoteDesktop path — acceptable to ship X11-only v1 with a clear error.

## Build order (vertical slices, each independently provable)

1. **Protocol + browser UX against a stub agent.** ✅ A throwaway Node script
   (`apps/agent-stub`, @livekit/rtc-node) joins the room, publishes a
   synthetic video track as the screen share, and enforces/logs/echoes
   `control:*` messages. Proves the whole browser side with zero Rust.
   _Verified against live LiveKit_ (`apps/agent-stub/test-drive.mjs` +
   in-browser run): forged grants and pre/post-session input rejected; full
   input pipeline (move/click/key/scroll); clipboard both directions; revoke;
   stop-present teardown; presenter attribution + agent filtering in the real
   call UI. Full two-browser request/offer UX remains a **manual two-window
   test**, as established in Phases 2–9.
2. **API endpoint + deep link.** ✅ Link + redeem endpoints (see §2),
   single-use verified live (second redeem 404s, garbage token 401s), code
   flows browser → dialog → stub redeem end-to-end. `huddle://` launch ships
   via hidden iframe; protocol _registration_ lands with the real agent
   (slice 3) — until then the dialog's copy-paste code is the path.
3. **Agent: join + capture + publish.** 🚧 Tauri 2 + Rust skeleton
   implemented: redeem flow, LiveKit room join, xcap monitor capture → I420 →
   NativeVideoSource, control:\* protocol handler, deep-link + CLI arg entry
   points. Compiles and links (livekit 0.7.45 + xcap 0.8 + libwebrtc 0.3.36).
   **Blocked at runtime on macOS 26 (Tahoe):** the prebuilt WebRTC binary in
   webrtc-sys crashes on `+[NSString stringForAbslStringView:]` during
   PeerConnectionFactory init ([rust-sdks#795][gh795]). The `-ObjC` linker
   fix is applied but needs an updated prebuilt binary from upstream. Code is
   structurally complete; will be testable on macOS 15 or when upstream ships
   a Tahoe-compatible binary.
   [gh795]: https://github.com/livekit/rust-sdks/issues/795
4. **Agent: injection.** ✅ `enigo` 0.3 for mouse/keyboard. Normalized
   [0,1] coordinates from `control:input` mapped to monitor pixel coords
   using monitor origin (x,y), dimensions, and DPI scale factor. Mouse
   move/down/up/scroll and full keyboard (Unicode keys, modifiers, F-keys,
   nav keys). Dedicated injector thread receives events via channel from
   the protocol handler. Scroll magnitude scaled ×3 for usable feel.
5. **Clipboard + teardown edges.** ✅ `arboard` 3 for bidirectional
   clipboard sync (text-only v1). Polling watcher (500ms) on a dedicated
   thread detects local changes and sends `control:clipboard` to the
   controller. Incoming clipboard from controller written to local
   clipboard. Teardown: `controller_id` cleared on revoke, release,
   stop-present, presenter disconnect, controller disconnect, and room
   disconnect — input injection and clipboard sync are gated on
   `controller_id.is_some()`.
6. **Packaging.** ✅ macOS TCC permission onboarding: `permissions.rs`
   checks Screen Recording (test capture) and Accessibility (osascript
   probe). UI shows a permission gate screen with "Open Settings" buttons
   before the setup screen. `Info.plist` with `NSScreenCaptureUsageDescription`
   and `NSAccessibilityUsageDescription`. `Entitlements.plist` disabling
   App Sandbox (required for screen capture and input injection).
   Windows/Linux: permissions reported as granted (no TCC equivalent).

## Risks / open questions (resolve in slice order, update here)

- ~~LiveKit **Rust SDK screen-publish maturity** vs. capture crate choice —
  validate in slice 3 before committing; this is the long pole.~~
  **Resolved (slice 3):** livekit 0.7.45 + xcap 0.8 compile and link. The
  capture → I420 → NativeVideoSource → publish pipeline is structurally
  complete. Runtime validation blocked by the macOS 26 WebRTC crash
  (rust-sdks#795); the code path itself is correct.
- **macOS 26 (Tahoe) runtime crash** (rust-sdks#795): prebuilt WebRTC binary
  references `+[NSString stringForAbslStringView:]` which is gone from
  Foundation in macOS 26. The `-ObjC` linker flag (PR #847, merged, in
  livekit 0.7.45) loads the category, but the category's implementation
  references a missing symbol. Needs an upstream rebuild of the WebRTC
  prebuilt against the macOS 26 SDK. Track the issue; no in-project
  workaround.
- **Coordinate fidelity**: letterboxing on the controller side × DPI scaling on
  the agent side. Slice 4's acceptance test exists to flush this out.
- **Browser-reserved shortcuts** (Cmd-W and friends) can't all be captured —
  acceptable v1 caveat; document for Controllers.
- **Data-channel input rate**: lossy + coalesced moves are expected to be fine
  at ≤ 60 Hz; measure under packet loss in slice 4.
- **Wayland**: defer; X11-only Linux v1 with a clear error message.
