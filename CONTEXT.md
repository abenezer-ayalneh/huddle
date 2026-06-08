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
kick, and recording. Authority is enforced server-side via the room's `hostKey`,
never trusted from the client.
_Avoid_: Owner (owner is the persistence concept — the account that holds the room
record; usually the same person, but not a live-call role), moderator, admin

**Guest**:
A participant who arrives via a shared link and must knock to enter. Has no
host key and no admin powers.
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
"agreeing" to the camera/voice setup; there is no separate consent step.
_Avoid_: Pre-join (the LiveKit component name — fine in code, but "Device Check"
is the domain term), camera test, AV check, permission prompt

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
