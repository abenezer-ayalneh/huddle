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

**Host**:
The signed-in account that created a managed room and controls admission, mute,
kick, and recording. Authority is enforced server-side via the room's `hostKey`,
never trusted from the client.
_Avoid_: Owner (owner means the account that holds the room record; usually the
same person, but it is a persistence concept, not a live-call role), moderator,
admin

**Guest**:
A participant who arrives via a shared link and must knock to enter. Has no
host key and no admin powers.
_Avoid_: Attendee, viewer, visitor

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
