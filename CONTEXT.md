# Huddle

Self-hosted, browser-based video conferencing (a Google Meet–style product) built
on LiveKit. This glossary fixes the language used across `apps/web`, `apps/api`,
and the docs so the same concept always has the same name.

## Language

### Rooms & roles

**Managed Room**:
A room a host explicitly created. Guests cannot join freely — they must knock and
be admitted (the waiting room). The single source of truth for who may join.
_Avoid_: Meeting, channel, session

**Instant Meeting**:
A managed room created to start immediately — the host jumps straight into the
call. It is not shown in any lobby list; its link is shared from inside the call.
_Avoid_: Ad-hoc room, quick meeting

**Scheduled Meeting**:
A managed room created with a future start time. It appears in the host's
upcoming list (and only there) until its start time passes, from which the host
starts it.
_Avoid_: Booking, event

**Host**:
The signed-in account that created a managed room and controls admission, mute,
kick, and recording. The host records freely (no approval needed) and is the
approver for everyone else's Request to Record. Authority is enforced
server-side via the room's `hostKey`, never trusted from the client.
_Avoid_: Owner (owner is the persistence concept — the account that holds the room
record; usually the same person, but not a live-call role), moderator, admin

**Guest**:
A participant who arrives via a shared link and must knock to enter. Has no
host key and no admin powers — but, like any non-host participant, may send a
Request to Record that the host approves.
_Avoid_: Attendee, viewer, visitor

**Room Code**:
The unique, auto-generated identifier for a managed room (a Meet-style code such
as `abz-mnpq-rfk`). It is the room's only public identity: the path in the share
link and the LiveKit room name. Generated fresh for every room — rooms have no
human-given name.
_Avoid_: Title, name, slug (slug is the internal column that stores the Room
Code; "Room Code" is the domain term)

### Joining

**Knock**:
A guest's request for admission to a managed room — the "ask for join permission"
action. Creates short-lived server-side state (Redis, with a TTL) that the host
sees as a pending entry. Resolved by admit, deny, or withdraw.
_Avoid_: Request to join, join request, ask

**Waiting Room**:
The state a guest is in between knocking and the host's decision. Not a place —
a status (`pending`) on the knock.
_Avoid_: Lobby (lobby is the app's home/landing page, a different thing), queue

**Admit / Deny**:
The host's decision on a knock. Admit mints the guest's join token; deny ends the
knock. Delivered to the waiting guest via polling.
_Avoid_: Accept/reject, approve/decline, let in

**Withdraw**:
A guest cancelling their own pending knock before the host decides.
_Avoid_: Cancel, retract

**Device Check**:
The camera/microphone self-preview plus device selection a participant completes
before media starts (built on LiveKit's `PreJoin`). For a guest it runs **before**
the knock and gates it — the guest must get through the Device Check and press the
join button before the knock is sent. For a host it runs before connecting to the
call. The participant's selections (which camera/mic, and whether each is on) are
carried forward into the call. Passing the Device Check is the guest's act of
"agreeing" to the camera/voice setup; there is no separate consent step. Its
pickers are pre-filled from, and save back to, the Device Preference.
_Avoid_: Pre-join (the LiveKit component name — fine in code, but "Device Check"
is the domain term), camera test, AV check, permission prompt

### Devices

**Switch Device**:
Picking a camera, microphone, or speaker from the in-call pickers attached to
the control bar's mic and camera buttons. A pick always puts the device into
use immediately: choosing any listed device — including the one already active —
turns that track on (the picker doubles as an unmute / camera-on gesture). A
pick also updates the Device Preference.
_Avoid_: Change input, device settings

**Device Preference**:
The remembered last-used camera, microphone, and speaker on a participant's
browser. Written whenever a participant picks a device — in the Device Check or
by switching mid-call — and read to pre-select devices next time. If a
remembered device is absent (unplugged), the browser default is used silently.
_Avoid_: Saved devices, default devices

### Mute feedback

**Mute Reminder**:
A transient, advisory notice shown from the local participant's own microphone
button when they talk while their microphone is off — telling them they are not
being heard. Local-only: it never changes mute state, and it appears whatever the
reason the mic is off (self-mute or Mute on Entry). Detecting speech while
muted means the microphone keeps capturing locally while muted, so the OS
mic-in-use indicator stays lit; the reminder is the in-app counterpart to that
signal.
_Avoid_: You're-muted popup, mute nudge, unmute prompt, talk-while-muted toast

### Keyboard control

**Keyboard Shortcut**:
A modifier-key binding for an in-call control that mirrors a control-bar button:
the audio shortcut toggles the microphone, the video shortcut toggles the camera.
The modifier maps per-platform — Cmd (⌘) on macOS, Ctrl on Windows/Linux — so the
audio shortcut is ⌘D / Ctrl+D and the video shortcut is ⌘E / Ctrl+E. The binding
claims those combos for the call ahead of the browser's own defaults and any
browser extension (the same way Meet/Zoom do). Active on the Device Check screen
and during the call; suspended while the participant is a Controller, when
keystrokes belong to the controlled machine.
_Avoid_: Hotkey, accelerator, keybinding

**Push to Talk**:
A hold-to-talk gesture: while a muted participant holds the spacebar, their
microphone is turned on for the duration of the hold and returns to off on
release. It acts only when the participant is muted — when already live, holding
the spacebar does nothing. In-call only: there is nothing to talk into before
joining, so it is inert on the Device Check screen. The microphone button shows
its live state for the duration; there is no separate indicator. Like the
Keyboard Shortcuts, it is suspended during a Remote Control session, and it never
fires while typing in a text field (chat, name).
_Avoid_: PTT (fine in code), walkie-talkie mode, hold to unmute, hold to speak

### Video layout

**Equal Grid**:
The default call layout when no one is presenting and nothing is pinned: every
remote participant in an equal-sized tile. The local participant is **not** an
ordinary tile here — they appear only as the floating Self-view. Alone in the
room, the local camera fills the stage instead.
_Avoid_: Gallery, tile view, speaker grid

**Self-view**:
The local participant's own camera feed as shown back to themselves. In the Equal
Grid it is a small window that floats over the stage and can be dragged between
the stage's corners (snapping to the nearest on release); the local participant
never appears as an ordinary grid tile. It surfaces only once at least one other
participant is present. In any **focused layout** (a presentation or a Pin) the
Self-view stops floating and docks into the thumbnail strip alongside everyone
else. It is always shown while the camera is on — there is no hide control. Its
corner and visibility are session-only (a rejoin resets it to the default
corner).
_Avoid_: PiP / picture-in-picture (fine in code), self-mirror, local tile,
floating thumbnail

**Pin**:
A local-only focus action: a participant promotes one other participant to fill
the main stage while the rest — and the Self-view — drop to a thumbnail strip
(the same one-big-plus-strip shape a presentation uses). A Pin changes only the
pinning participant's own view; it is never broadcast to others and needs no host
authority. At most one participant is pinned at a time. A Pin lasts for the call
only and clears automatically if the pinned participant leaves. A presentation
outranks a Pin: while someone presents, the presented screen owns the stage and
the Pin is suspended, then restored when the presentation ends.
_Avoid_: Spotlight (that would force the same focus onto everyone's screen — a
different, deliberately un-built feature), focus, lock, feature

### Presenting

**Present**:
The act of sharing your screen with the room. Only one participant can present at
a time. The participant whose screen is being shared is the Presenter.
_Avoid_: Screen share (the LiveKit track-source name — fine in code, but "present"
is the domain verb), broadcast

**Presenter**:
The participant currently sharing their screen. While someone is presenting, the
call layout switches from the equal grid to a split view: the presented content
fills the main area and participant thumbnails move to a sidebar.
_Avoid_: Sharer, broadcaster

**Presenter Placeholder**:
What the Presenter themselves sees in the main stage instead of their own
presented content: a static "You're presenting" card (with a Stop button) over a
dimmed/blurred backdrop. The Presenter is never shown their own live screen feed —
it is not rendered for them at all. This is what defeats the **infinite-mirror**
effect (the Droste tunnel that appears when the presented surface contains the
call window): because the captured pixels of the Presenter's stage are a static
card rather than a live feed, the recursion never forms in the stream everyone
else receives. Applies to both a plain Present and a Present with Control. The
Presenter still sees their own camera thumbnail in the sidebar.
_Avoid_: Self-view (that is the camera thumbnail, a different thing), self-mirror

**Ask to Present**:
When a participant wants to present while someone else already is, they send a
request to the current Presenter via LiveKit data messages. The Presenter can
yield (their share stops, the requester's starts automatically) or decline. The
request times out after 30 seconds with an auto-decline. The host bypasses this
flow entirely — a host can force-take the presentation at any time, stopping the
current share immediately.
_Avoid_: Request to share, take over request

### Remote control

**Remote Control**:
A consent-gated session in which one participant (the Controller) operates the
Presenter's machine — mouse, keyboard, and clipboard (both directions) — while
the Presenter is presenting with control. Exists only inside a Present with
Control; ends automatically when the presentation stops. Only the Presenter can
start one (by granting a request or offering); there is **no host bypass** —
unlike Ask to Present, the host cannot force-take someone's machine.
_Avoid_: Screen control, remote access, takeover, remote desktop

**Present with Control**:
The share-time action that starts a controllable presentation: the Presenter's
Control Agent (not the browser) captures and publishes a whole monitor. Chosen
explicitly when the share starts — a plain Present can never become controllable
mid-flight, and a Present with Control shares exactly one monitor, never a
window. It counts as presenting: the single-presenter rule spans both kinds.
Desktop only (mobile browsers cannot present at all).
_Avoid_: Controllable share, agent share, control mode

**Controller**:
The participant currently operating the Presenter's machine in a Remote Control
session. Exactly one at a time. Becomes Controller when the Presenter grants
their request or offers them control; stops being one on Revoke, Release, or
when the presentation ends. Any participant may be a Controller from a plain
browser — no install needed on the controlling side.
_Avoid_: Driver, operator, remote user

**Control Agent**:
The desktop application on the Presenter's machine that makes Remote Control
possible: it joins the room invisibly as the Presenter's agent, publishes the
monitor, receives the Controller's input over data messages, and injects it
into the OS. It is the enforcement point — it only accepts input from the one
granted Controller, and it is the only component that ever touches the machine.
Launched per-presentation via a deep link from the in-call browser session;
holds no standing credentials. The person remains the Presenter; the agent is
plumbing, never shown as a participant.
_Avoid_: Daemon, helper, client, companion app

**Request / Offer Control**:
The two ways a Remote Control session starts. Request Control: a viewer asks
the Presenter (times out like Ask to Present). Offer Control: the Presenter
hands control to a chosen participant unprompted. Both resolve by the receiving
side's Grant/Accept or Decline.
_Avoid_: Take control, ask to drive

**Revoke / Release**:
The two ways a Remote Control session ends early. Revoke: the Presenter ends
the Controller's session, instantly, at any moment, no confirmation. Release:
the Controller voluntarily gives control back. Either way the presentation
itself continues.
_Avoid_: Kick (that's removing a participant from the call), stop share (that
ends the presentation, which also ends control, but is a different act)

### In-call host controls

**Mute on Entry**:
A room-level setting the host toggles during a call. While on, every participant
present is force-muted and every new joiner arrives with their microphone off.
It is a _default_, not a lock: a muted participant may unmute themselves to
speak (the host can never force a microphone back on). Turning it off only stops
auto-muting future joiners; it does not unmute anyone. Stored as a flag in the
LiveKit room's metadata, so it propagates to every client in real time.
_Avoid_: Mute all (implies a one-shot bulk action, hiding the persistent,
mute-on-join behaviour), room mute (ambiguous — sounds like muting the room's
output), hard mute / lockdown (this never revokes the right to speak)

### Recording

**Recording**:
The single composited capture of a managed room — the same grid + mixed audio a
participant sees — produced as one MP4 per session by LiveKit Egress. There is
at most one active Recording per room at a time. The resulting file always
belongs to the room (the host's account) and is only ever downloaded by the
host, regardless of who started it.
_Avoid_: Capture, session record, tape

**Request to Record**:
A non-host participant's in-call request for permission to record. Any
participant except the host may send one (Guests included); the host never needs
to — they record freely. Sent to the host over LiveKit data messages, like Ask
to Present, and auto-declined after 30 seconds if the host does not respond. The
host's responses are **Approve / Deny**.
_Avoid_: Ask to record, recording request, record permission

**Approve / Deny**:
The host's decision on a Request to Record. Approve **starts the recording
immediately**, attributed to the requester so that either they or the host can
stop it; once it stops, a new Request to Record is needed to record again. Deny
ends the request with nothing started. Approval is a host-key-authorized action
on the server (the host key is never shared); attribution lets the requester's
participant token authorize their stop.
_Avoid_: Accept/reject, admit/deny (admit is the knock decision), grant/revoke

**Recording Indicator**:
The room-wide signal that a Recording is active, shown to **every** participant
regardless of who started it. Driven by a flag in the LiveKit room's metadata
(the same real-time propagation as Mute on Entry), so it appears and clears for
all clients at once. Its purpose is consent: no one is recorded without an
on-screen signal.
_Avoid_: Rec light, recording badge (fine in UI copy, but "Recording Indicator"
is the domain term)
