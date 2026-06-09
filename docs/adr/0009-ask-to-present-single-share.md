# Single-presenter model with ask-to-present handoff

Status: accepted

Only one participant can present (screen-share) at a time. When someone wants to
present while another participant already is, they send an **ask-to-present**
request to the current Presenter. The Presenter can yield or decline. The host
bypasses this flow and can force-take the presentation at any time.

## Why this is worth an ADR

Hard to reverse: the ask-to-present protocol defines a data-message schema, a
client-side state machine, and UX flows (request, yield, decline, timeout) that
other code will depend on. Surprising: a reader might expect either unrestricted
multi-share (like the current grid prominence approach) or a simple block.
Trade-off is real: we chose a cooperative handoff over multi-share complexity and
over a blunt one-at-a-time block.

## Alternatives considered

**Allow multiple screen shares.** Each share gets its own prominent tile.
Rejected because the layout becomes chaotic with two or more shares competing for
space, and the real-world use case (someone else wants to show something) is
almost always sequential, not simultaneous.

**Block — first share wins.** If someone is presenting, the share button is
disabled for everyone else. Simple, but frustrating: you have to ask verbally
("can you stop sharing?") and wait for them to notice. The in-band request flow
is strictly better UX.

**Host-mediated approval.** Route requests through the host instead of the
current Presenter. Rejected because the host may not be the one presenting, and
adding a third party slows down a peer interaction that should be instant.

## Protocol

Transport: **LiveKit reliable data messages** (JSON over the existing
`canPublishData` grant). No backend involvement — the entire flow is client-side.

### Message types

| Type                 | Sender    | Recipient         | Payload                          |
| -------------------- | --------- | ----------------- | -------------------------------- |
| `present:request`    | Requester | Current Presenter | `{ requesterId, requesterName }` |
| `present:yield`      | Presenter | Requester         | `{}`                             |
| `present:decline`    | Presenter | Requester         | `{}`                             |
| `present:force-take` | Host      | Current Presenter | `{}`                             |

### Flow — guest-to-presenter

1. Participant clicks the share button while someone else is presenting.
2. Client sends `present:request` to the current Presenter.
3. Requester sees a pending toast: "Waiting for X to respond…"
4. Presenter sees a prompt: "Y wants to present. Allow?"
5. **Yield**: Presenter's share stops automatically → requester's share starts
   automatically (clean handoff). Presenter gets a toast: "You yielded to Y."
6. **Decline**: Requester gets a toast: "X declined your request."
7. **Timeout (30 s)**: Auto-decline. Requester gets: "X didn't respond. Try again
   later."

### Flow — host force-take

1. Host clicks the share button while someone else is presenting.
2. Client sends `present:force-take` to the current Presenter.
3. Presenter's share stops immediately. Host's share starts.
4. Presenter gets a toast: "The host started presenting."

### Race condition — presenter leaves or stops

If the current Presenter disconnects or stops sharing while a request is pending,
the constraint disappears. The pending request auto-resolves and the requester's
share starts immediately — no second click needed.

## Layout changes (context, not the decision)

The ask-to-present protocol exists because of the single-presenter layout: when
someone is presenting, the call switches from the equal participant grid to a
split view (presented content fills the main area, participant thumbnails in a
right sidebar on desktop / bottom filmstrip on mobile). This layout only makes
sense with one share — hence the one-at-a-time constraint that requires the
handoff protocol.

## Consequences

- The share button's behaviour becomes context-dependent: "start presenting" when
  nobody is, "ask to present" when someone is (for non-hosts), "take over" when
  someone is (for the host).
- A client-side state machine must track request lifecycle (idle → pending →
  yielded/declined/timed-out) and clean up on participant disconnect.
- The data-message schema (`present:*`) becomes a contract between clients —
  changes require coordination across versions.
- The host's force-take power is consistent with existing host authority (admit,
  deny, mute, kick) and requires no new backend grant.
