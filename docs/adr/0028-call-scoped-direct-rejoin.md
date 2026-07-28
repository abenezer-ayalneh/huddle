# Signed-in Guests receive call-scoped Direct Rejoin Grants

An admitted signed-in Guest may leave or lose their connection and return to the
same ongoing call without another Knock. Huddle records that authority as a
Redis Direct Rejoin Grant bound to the account, Room Code, active LiveKit room
SID, stable participant identity, and an opaque grant ID. It is not persistent
room membership: host Remove revokes it for a connected Guest, and the matching
`room_finished` event ends it.

## Considered Options

- **Server-side, call-scoped grant — chosen.** It supports another tab or device
  without trusting browser storage, preserves one participant identity, and
  keeps the waiting room authoritative for later calls.
- **Reuse a cached join token.** Rejected because a browser-held token is neither
  account-bound nor reliably revocable and can outlive the LiveKit room instance
  it was minted for.
- **Persist admission on the Managed Room.** Rejected because it turns one
  admission into standing membership across later calls.
- **Require a new Knock after every departure.** Rejected because it makes a
  signed-in Guest repeat host approval after an ordinary disconnect or Leave.

## Consequences

- Anonymous Guests never receive a grant and continue to Knock for every entry.
- Explicit Leave preserves the grant, but the Guest still completes the Device
  Check before Direct Rejoin activates media.
- Remove revokes Direct Rejoin but is not a ban; the Guest may Knock again.
- No away-guest list is added. A host can revoke the grant only through the
  existing Remove action while the Guest is connected.
