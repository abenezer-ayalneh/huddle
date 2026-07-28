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
Request to Record that the host approves. A guest may be **anonymous** or
**signed-in**: an anonymous guest types a display name during the Device Check,
while a signed-in guest's name comes from their account and is never typed (the
server derives it from the session, the same way a host's name does). Signed-in
status does not make a non-owner a Host: a signed-in Guest must knock on their
first entry to each call, then may use a [[Direct Rejoin Grant]] for that call.
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
knock. For a signed-in Guest, Admit also creates a [[Direct Rejoin Grant]].
_Avoid_: Accept/reject, approve/decline, let in

**Direct Rejoin Grant**:
The call-scoped permission that lets an admitted signed-in Guest re-enter the
same ongoing call without another Knock. It survives disconnection and Leave,
and ends when the host Removes the connected Guest or the call ends.
_Avoid_: Membership, remembered token, reconnect token, standing access

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
The remembered settings for a participant's media on this browser: which camera,
microphone, and speaker were last used, plus whether the microphone and camera
should start on or off at the next Device Check. Written when the participant
submits the Device Check before joining (the camera and microphone on/off toggles),
and read to pre-fill the Device Check's toggles and device pickers next time.
Device Preference is a default, not a lock — the participant can always change
the toggles on the Device Check before joining. If a remembered device is absent
(unplugged), the browser default is used silently. Note: [[Mute on Entry]]
(a room-level rule) overrides the saved microphone preference if active.
_Avoid_: Saved devices, default devices, startup state (use "on/off state" or
"enabled/disabled state" for the toggle preference)

**Device Recovery**:
What surfaces when a participant's camera or microphone can't be accessed — they
blocked it, another app is holding it, or none is present — and helps them restore
it without leaving the [[Device Check]] or the call. The affected device's button
shows it on sight: it carries a **Device Alert** (a small "!" badge) the moment the
page loads, turns red, and disables its device picker ("Permission blocked").
Pressing the button — or its [[Keyboard Shortcut]], which mirrors the button —
**re-requests the permission**, firing the browser's own popup the way Google Meet
does, rather than telling the user to hunt for the address-bar icon. Only when the
browser won't re-prompt (or the device is busy or missing) does the **Device
Recovery dialog** appear, with guidance tailored to the cause: friendly,
browser-specific unblock steps, "close the other app", or "connect a device".
Camera and microphone recover **independently** — one may be blocked while the
other works. When access returns the device comes back **on** and its picker
repopulates (a first-time grant during a normal join is left alone, so a saved
mute-on-join preference still holds). A blocked or unavailable device is a
[[Domain Outcome]] (the participant's own choice or their environment), never a
[[Fault]], so it must never show the Fault surface.
Lives on both the Device Check and the in-call controls; where a device is blocked,
its in-call button drops the [[Switch Device]] chevron and the press triggers
recovery instead of a toggle.
_Avoid_: Permission prompt (that is the browser's own dialog, not ours), permission
error, camera/mic error, blocked-device toast

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
and during the call.
_Avoid_: Hotkey, accelerator, keybinding

**Push to Talk**:
A hold-to-talk gesture: while a muted participant holds the spacebar, their
microphone is turned on for the duration of the hold and returns to off on
release. It acts only when the participant is muted — when already live, holding
the spacebar does nothing. In-call only: there is nothing to talk into before
joining, so it is inert on the Device Check screen. The microphone button shows
its live state for the duration; there is no separate indicator. It never fires
while typing in a text field (chat, name).
_Avoid_: PTT (fine in code), walkie-talkie mode, hold to unmute, hold to speak

### Video layout

**Equal Grid**:
The default call layout when no one is presenting and nothing is pinned: every
remote participant in an equal-sized tile. The local participant is **not** an
ordinary tile here — they appear only as the floating Self-view. Alone in the
room, the local camera fills the stage instead.
_Avoid_: Gallery, tile view, speaker grid

**Portrait Equal Grid**:
The orientation-based Equal Grid used when the viewport is portrait: remote
tiles stack at full usable width, with one to three tiles sharing the stage
equally and four or more showing four equal rows with vertical scrolling. The
local participant remains the floating Self-view.
_Avoid_: Vertical device layout, mobile-only grid

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
_Avoid_: PiP / Picture-in-Picture — that is now a distinct feature, the OS-level
[[Picture-in-Picture]] window. The Self-view is the in-page floating self-camera
and is never called PiP. Also: self-mirror, local tile, floating thumbnail

**Active Speaker**:
The remote participant LiveKit currently reports as loudest. The [[Equal Grid]]
gives every tile equal size and does **not** focus the speaker — the Active
Speaker is used only as the fallback feed for [[Picture-in-Picture]] when nothing
is presented and no one is pinned. It carries no on-stage emphasis in the normal
grid.
_Avoid_: Dominant speaker, loudest, current talker

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

**Avatar**:
The participant's account profile image, shown in a tile's camera-off placeholder
in place of the name initials. Sourced **server-side** from the signed-in account
— the same session that supplies the name (a Host's, or a signed-in [[Guest]]'s) —
and carried to every client in the participant's LiveKit token metadata, never
trusted from the browser. For a signed-in guest the image is captured at
**[[Knock]]** time (alongside the name) and minted into the token at **admit**.
Falls back to the name initials whenever no image exists (anonymous guests, or
accounts with no picture) or the image fails to load — a broken Avatar is never a
[[Fault]]; it degrades silently. Shown only in the camera-off state; when the
camera is on the video replaces it.
_Avoid_: Profile picture/photo (fine in prose, but "Avatar" is the domain term),
gravatar, headshot, initials (the initials are the fallback — a distinct thing)

### Accounts

**Verification Email Delivery**:
The product obligation to get the email-confirmation message for a new local
account into the participant's inbox so they can finish creating the account.
Without it, an email/password signup remains incomplete; social sign-in is a
separate path because the provider has already verified the address.
_Avoid_: Emailing issue, SMTP issue (implementation detail), magic link (this
confuses account verification with passwordless sign-in)

### Mobile & background

**Background Call**:
A call that keeps running while the app loses the foreground on mobile (the user
switches apps or locks the screen). The participant stays a present member of the
room: their microphone keeps publishing so they are still heard, while their
camera turns **off** (the OS suspends capture anyway, and others see the
participant's [[Avatar]] rather than a frozen frame); the camera returns to its
prior state on foreground. This is a property of the [[Call Connection]] surviving
backgrounding — distinct from leaving, which tears the connection down. The main
stage is offered as [[Picture-in-Picture]] so the user can keep watching.
_Avoid_: Background mode, keep-alive, minimize

**Picture-in-Picture (PiP)**:
The OS-level floating window that shows a single video feed outside the browser,
so a [[Background Call]] stays visible while the user is in another app. It holds
exactly one feed (a native browser window, not a custom player or the grid),
mirroring the main stage: the presented screen if someone is presenting, else the
pinned participant ([[Pin]]), else the [[Active Speaker]]. Entered via an explicit
pop-out control (a user gesture, reliable everywhere PiP exists) and, where the
browser permits, automatically on backgrounding. On iOS, entering PiP is also what
keeps the media session alive in the background; on Android background audio
survives without it. Distinct from the [[Self-view]] (an in-page floating
self-camera, never called PiP).
_Avoid_: Pop-out (fine as the control's label/verb), mini player, floating grid,
Self-view

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

**Presenter Preview**:
What the Presenter sees in the main stage during a normal [[Present]]: their own
live shared content under a dark protective tint, with the choice to reveal or
hide it locally. The tint makes an **infinite mirror** (the Droste tunnel when
the presented surface contains the call window) less visually disruptive, but a
live preview cannot eliminate recursive capture. It affects only the Presenter;
everyone else receives the unmasked presentation, and the camera thumbnail stays
in the sidebar.
_Avoid_: Presenter Placeholder (the retired static-card behavior), Self-view
(that is the camera thumbnail, a different thing), self-mirror

**Ask to Present**:
When a participant wants to present while someone else already is, they send a
request to the current Presenter via LiveKit data messages. The Presenter can
yield (their share stops, the requester's starts automatically) or decline. The
request times out after 30 seconds with an auto-decline. The host bypasses this
flow entirely — a host can force-take the presentation at any time, stopping the
current share immediately.
_Avoid_: Request to share, take over request

### Remote control

**Selected Display**:
The entire physical monitor chosen by the Sharer in the macOS Control Agent:
menu bar, Dock, desktop, every app window, and the Control Agent window are
included. The Sharer may change this display locally at any time during the
same approved Remote Control session. Huddle briefly hides the desktop and
disables input while the old track is unpublished and the replacement track is
published; a failed switch stays non-interactive until the Sharer retries.
_Avoid_: selected window, app capture, primary monitor

**Remote Control**:
In-call, attended control of one admitted participant's desktop by another
admitted participant. The Sharer's [[Selected Display]] is visible to the whole
room while control is active. It requires an explicit Request from the
Controller and approval from the Sharer, permits mouse, keyboard, and
plain-text Clipboard Sharing, and is reconfirmed by the Sharer every 30 minutes.
Clipboard Sharing automatically sends the Sharer's plain-text clipboard changes
only to the Controller; the Controller sends text only with their normal Paste
shortcut. Remote Control and [[Present]] are mutually exclusive.
_Avoid_: Remote access (suggests unattended access), desktop sharing, support
code

**Request Control**:
The participant-scoped proposal to control another admitted participant's
desktop. It creates no control authority until that participant explicitly
approves and becomes the Sharer.
_Avoid_: Ask for control, control invite, request remote access

**Remote Control Status**:
The persistent room-wide signal that identifies the Controller and Sharer and
states whether their Remote Control is waiting for the Control Agent, switching
displays, or active. During display switching the room shows a non-interactive
safety surface instead of another participant's video. Only the Sharer also
sees that Clipboard Sharing is enabled.
_Avoid_: Remote Control banner, control toast, control notification

**Control Cursor**:
The immediate, Controller-only visual feedback for the latest intended mouse or
pen position on the Sharer's desktop. It does not confirm macOS input injection
or confer control authority; the Control Agent remains authoritative for the
actual desktop pointer.
_Avoid_: Native cursor, pointer acknowledgement, remote cursor

**Trackpad Scroll**:
The Controller's two-finger horizontal or vertical scrolling of the Sharer's
visible desktop during [[Remote Control]]. It moves remote content in the same
apparent direction as the Controller's view. Pinch, zoom, rotation, and system
swipe gestures are excluded.
_Avoid_: Gesture support (too broad), remote touch controls

**Sharer**:
The participant whose desktop is visible and controlled during Remote Control.
The Sharer approves or denies the Request, launches the [[Control Agent]], may
stop at any time, and must reconfirm every 30 minutes. This role is scoped to one
active Remote Control session and is distinct from the [[Presenter]].
_Avoid_: Presenter, Host, controlled user

**Controller**:
The admitted participant whom the Sharer approved to send mouse and keyboard
input to the Sharer's [[Control Agent]]. The Controller receives only the
Sharer's current transferable plain text and may send their own text only by
using the platform Paste shortcut. The Controller may stop at any time and may
type secrets; Huddle never records input events or clipboard contents.
_Avoid_: Operator, driver, support agent

**Control Agent**:
The signed and notarized native macOS helper app that only the [[Sharer]]
installs. It captures the Sharer's entire [[Selected Display]], publishes it
LiveKit room, applies input only from the server-approved [[Controller]], and
relays bounded plain-text clipboard updates only to that Controller. It joins as
a companion participant hidden from people-facing participant UI, has
no room Host authority, and holds no standing credential. The installed app is
inert until the Sharer trusts the Huddle server, chooses a display, and confirms
Start Remote Control. Its local Change display picker switches immediately
within the same approved session; its local Stop action disconnects it, which
ends Remote Control. Windows and Linux downloads are not available in the public
beta.
_Avoid_: Host (already the room role), daemon, desktop client

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
belongs to the room (the host's account). The Host controls its local download
and optional Cloud Destination; a non-Host receives Drive access only after
their own [[Recording Share Consent]], regardless of who started it.
_Avoid_: Capture, session record, tape

**Local Recording Copy**:
The temporary MP4 stored by Huddle for a completed Recording. It has a fixed
expiry and may be deleted sooner after verified Cloud Destination delivery; the
Recording's metadata remains after deletion.
_Avoid_: Archive, permanent copy, backup

**Cloud Destination**:
The one optional external storage account a Host explicitly connects for future
Recording delivery. It is separate from sign-in and owned by the Host account.
_Avoid_: Synced drive, shared folder, public storage

**Recording Share Consent**:
A signed-in non-Host participant's explicit, final choice to receive eligible
Recordings in the Host's Cloud Destination. It is limited to the current call,
starts from the moment of consent, and ends when that call ends. Anonymous
Guests cannot give it.
_Avoid_: Recording permission, audience membership, folder access

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

### Errors & faults

**Fault**:
An _unexpected_ failure — the app could not do what was asked through no choice
of the user: the API is unreachable, a request 500s, a network drop, the LiveKit
connection fails, or a component crashes while rendering. Faults are what the
error-handling strategy targets; they are surfaced through a single, consistent
mechanism and carry a stable machine-readable code so the client can react
specifically (re-login, retry, reload). A Fault is never a normal step in any
flow.
_Avoid_: Error (too broad — covers domain outcomes too), exception, crash (a
crash is one _kind_ of Fault), bug

**Domain Outcome**:
An _expected_ rejection that is part of normal flow even though it travels over
an HTTP error status: a host **Deny**, an expired **Knock**, "you are not the
host", "a display name is required". A Domain Outcome is **not** a Fault — it has
its own tailored UX (e.g. the guest's "denied" screen) and must never appear as
the generic Fault surface. The two are deliberately kept visually and
conceptually distinct.
_Avoid_: Error, validation error, rejection (fine in prose, but the contrast
that matters is Domain Outcome vs. [[Fault]])

**API Reachability**:
Whether the web app can reach the **API/auth backend over HTTP** at all — a
property of the REST + BetterAuth connection, separate from any call. It is
_unreachable_ when a request rejects at the transport layer (connection refused,
DNS/CORS failure, offline, timeout) — a [[Fault]] carrying a client-minted `NET_*`
code, since no server envelope exists. Surfacing splits by origin: a
**user-initiated** fault (clicked Sign in, Create meeting) raises the Fault toast
with a recovery action; a **passive/background** fault (the on-focus session
refetch, polling) raises no toast — only a single quiet, persistent **Server
Unreachable** indicator that clears when reachability returns. Distinct from
[[Call Connection]].
_Avoid_: Offline (implies the user's whole network is down; usually it is
specifically the API that is unreachable), connection state (that is the call's —
see [[Call Connection]])

**Call Connection**:
The LiveKit **media** connection lifecycle during a call — connecting,
reconnecting, disconnected — owned by the existing in-call connection-state UI.
LiveKit's automatic _reconnecting_ is a normal transient, **not** a [[Fault]];
this UI owns the whole lifecycle including a permanent drop. Entirely separate
from [[API Reachability]] (the HTTP/auth backend), which can fail on the lobby
with no call in sight.
_Avoid_: Reachability (that is the API's — see [[API Reachability]]), network
status
