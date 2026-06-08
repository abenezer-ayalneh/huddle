# Mute on Entry stored in LiveKit room metadata, honored by clients

Status: accepted

The host gets a **Mute on Entry** toggle (see CONTEXT.md): while on, everyone
present is force-muted and every new joiner arrives mic-off, though anyone may
unmute themselves to speak. We store that on/off state as a flag in the LiveKit
**room metadata** and let each client honor it (start mic-off), rather than
enforcing it server-side via the `track_published` webhook or persisting it in
our own Postgres/Redis.

## Why this is worth an ADR

The choice is hard to reverse and surprising: the metadata shape becomes a
contract the web client, the API's join payloads, and the room-admin code all
couple to. A future reader will reasonably ask "why is a moderation control
client-trusted instead of enforced on the server?" — so the reasoning needs to
be on record.

## What we're doing

- **Storage:** the flag lives in the LiveKit room's `metadata`
  (`{ "muteOnEntry": boolean }`), set via `RoomServiceClient.updateRoomMetadata`.
  LiveKit pushes metadata changes to every connected client in real time, so the
  host's toggle propagates without any polling of our own.
- **The toggle action** (`POST /rooms/:room/mute-on-entry`, host-key authorized)
  writes the flag and, when turning it on, force-mutes every **non-host** mic
  currently published (reusing the existing `mutePublishedTrack` path; the host
  is identified by the `role: "host"` token metadata claim and skipped).
- **New joiners** learn the flag from the join payload they already fetch
  (`hostJoin` and the admitted `knockStatus`), so the client connects with
  `audio` disabled — there is never a window of live audio on entry.

## Why client-honored, not server-enforced

The feature is deliberately a **soft default, not a lockdown** (CONTEXT.md): a
muted participant may always unmute themselves. Since we are never actually
preventing anyone from speaking, server-enforcing the _initial_ mute buys little.
Trusting the client to start mic-off is consistent with the soft-mute promise,
and it is dramatically simpler than the alternatives:

- **Webhook-authoritative** (`track_published` → force-mute) was rejected: it
  adds a live-audio race window before the webhook fires, more webhook code, and
  authority we don't need given soft-mute. We can layer it on later as a backstop
  without changing the storage model.
- **Own datastore (Redis/DB)** was rejected: it duplicates state LiveKit already
  holds, gains no real-time client propagation (needs polling), and adds a
  consistency burden — for a flag whose natural lifetime is exactly the LiveKit
  room's.

## Consequences

- The metadata key `muteOnEntry` is now a contract across web + API; renaming or
  relocating it touches the client, the join payloads, and the admin code.
- The flag's lifetime is the LiveKit room's: when the room ends it is gone, which
  is the desired behavior (a fresh call starts unmuted).
- Because enforcement is client-side, a hand-crafted client could join mic-on
  despite the flag. That is acceptable: it is no different from a participant
  unmuting themselves a moment later, which the soft-mute design already allows.
- If we later need a true webinar-style lockdown (revoke `canPublish`), that is a
  separate, larger feature — not a tweak to this one.
