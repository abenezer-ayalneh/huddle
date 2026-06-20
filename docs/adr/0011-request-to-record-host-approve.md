# Request to Record with host approval

Status: accepted

Amends ADR-0003 ("Who can record: host-only, manual"). Recording is still a
single composited room capture, host-owned, host-downloaded — but the **trigger**
is opened to every non-host participant via a host-approved **Request to Record**.

Any participant except the host (Guests included) may send a Request to Record.
The host approves or denies it. The host themselves never requests — they record
freely, as before. **Approval starts the recording immediately**, attributed to
the requester so that either they or the host can stop it; once it stops, a new
Request to Record is needed to record again. The file always belongs to the
host's account and is only ever downloaded by the host. A room-wide **Recording
Indicator** shows every participant when a recording is active.

## Why this is worth an ADR

Hard to reverse: it changes the recording authority model. The host's approval
now _starts_ a recording (previously only the host's own `HostGuard` start did),
and the stop endpoint must accept a non-host participant proven by their
participant token and matched against the recording's starter. The data-message
schema and that attribution become contracts other code depends on. Surprising: a
reader of ADR-0003 expects recording to be strictly host-only; this directly
contradicts that. Real trade-off: we chose approve-starts-immediately over an
unlock-and-press-Start grant, host-only file access over a shared download, and
data-message signaling over the Redis-polling used by Knock.

## Decisions and alternatives considered

### Approval starts the recording immediately

Approve is the start: the host's approval begins the recording in one action,
attributed to the requester. There is no standing capability and no intermediate
"you may now press Start" state — one approval yields one recording, and stopping
it requires a fresh Request to Record to record again.

- **Unlock a Start button, requester presses it** (rejected): approval would
  grant a one-shot, short-lived permission (a Redis grant keyed by identity) that
  the requester redeems by pressing Start. Rejected as an extra step and extra
  moving part (the grant, its TTL, a participant-authorized start endpoint) for no
  real benefit — the requester already asked to record, so approval may as well
  start it. Dropping it also removes a whole authorization path from the server.
- **Standing recorder capability** (rejected): approval promotes the participant
  to a recorder for the rest of the call. Rejected as too large an authority
  change for a per-room, per-moment decision — the host loses per-recording
  control, and a Guest would hold a lingering power that is easy to forget about.

### File access: host-owned only

The composited file belongs to the room (host's account) and is downloaded only
by the host, exactly as in ADR-0003. The requester triggers the recording but
never receives the file.

- **Requester also gets a download link** (rejected): would require a non-host
  download authorization and a way to deliver a file to an anonymous Guest who may
  have already left. Disproportionate to the goal, which is letting participants
  _initiate_ a recording, not redistribute it.

### Signaling: LiveKit data messages, start authorized by the host key

The request and the host's decision travel over LiveKit reliable data messages,
mirroring Ask to Present (ADR-0009). The actual start runs server-side under the
host's own `x-host-key` authority (the host already may start recordings), so no
separate grant is needed; the recording is stamped with the requester's identity
(`startedByIdentity`) so their participant token can later authorize the stop.

- **Redis + polling** (like Knock, ADR-0005, rejected as the primary transport):
  consistent with admit/deny, but a heavier mechanism for an in-call, transient
  prompt where the host is already present in the room.

### Expiry: auto-decline after 30 seconds

A pending Request to Record auto-declines after 30 seconds with no host action,
identical to Ask to Present. Keeps the host's prompt from accumulating stale
requests and gives the requester a definite outcome.

### Recording Indicator: room-wide, via room metadata

A flag in the LiveKit room's metadata marks a recording active, propagating to
every client in real time (the same mechanism as Mute on Entry, ADR-0007). The
purpose is consent: no participant is recorded without an on-screen signal,
regardless of who started the recording.

## Protocol

Transport: **LiveKit reliable data messages** for the request/decision UX. The
request is _broadcast_ (the requester doesn't track the host's identity; only the
host's UI acts on it); approve/deny are addressed back to the requester.

### Message types

| Type             | Sender    | Recipient | Payload                          |
| ---------------- | --------- | --------- | -------------------------------- |
| `record:request` | Requester | (all)     | `{ requesterId, requesterName }` |
| `record:approve` | Host      | Requester | `{}`                             |
| `record:deny`    | Host      | Requester | `{}`                             |

### Flow

1. A non-host participant clicks "Request to record".
2. Client broadcasts `record:request`; requester sees "Waiting for the host to
   approve recording…".
3. Host sees a prompt: "X wants to record. Approve?"
4. **Approve**: the host's client calls the approve endpoint, which **starts the
   recording** (attributed to X) under the host key, then sends `record:approve`.
   X takes ownership (Stop button) and the Recording Indicator appears for
   everyone via room metadata.
5. **Deny**: host sends `record:deny`; X gets "The host denied your request." (If
   the start fails — e.g. one is already running — the host's client sends
   `record:deny` too, so X is never left waiting.)
6. **Timeout (30 s)**: auto-decline; X gets "The host didn't respond. Try again."
7. X or the host stops it. To record again, X sends a new Request to Record.

### Authorization

- Host start/stop and **approve** (start-for-participant): `HostGuard`
  (`x-host-key`).
- Requester stop: participant token (as used by the Control Agent link, via
  `ParticipantGuard`), matched against the recording's `startedByIdentity`.
- The host key is never shared with the requester.

## Consequences

- Approval is a host-key action that starts a recording on a participant's behalf;
  the recording carries `startedByIdentity` so the requester's own stop can be
  authorized by their participant token.
- The data-message schema (`record:*`) becomes a contract between clients.
- If the requester disconnects mid-recording, the host can always stop it
  (host stop authority is retained).
- A Recording Indicator now exists room-wide; its source of truth is room metadata,
  set when a recording becomes active and cleared when it ends.
- ADR-0003 remains correct on what/where (composited room → MinIO) and on
  host-only file ownership; only its "who can start" clause is superseded here.
