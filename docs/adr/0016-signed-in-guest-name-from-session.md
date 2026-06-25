# A signed-in guest's name comes from the session, not the request body

A **Guest** arrives via a shared link and must **Knock** to enter a **Managed
Room**. Until now every guest typed a display name into the **Device Check**, and
that name travelled in the knock request body — the server trusted it verbatim.
That is fine for an **anonymous** guest, but a **signed-in** guest already has an
authoritative name on their account (signup requires a non-empty `name`). Asking
them to type it again is redundant, and trusting whatever the browser sends lets a
signed-in user appear under a name that isn't theirs.

We make the knock route resolve the BetterAuth session **optionally**: if a valid
session cookie is present, the server uses `session.user.name` and **ignores** any
`name` in the body; if there is no session, it falls back to the body name (the
anonymous path). This is the same rule a **Host**'s name already follows — derived
server-side from the session, never typed — now extended to signed-in guests.

The route stays public (anonymous guests must still be able to knock), so we add an
**optional** auth guard (`OptionalAuthGuard`) that attaches the user when a session
exists and otherwise lets the request through — distinct from the hard `AuthGuard`
that 401s. `KnockDto.name` becomes optional accordingly: a signed-in client may
omit it; an anonymous client must still send one, and the service rejects a knock
that resolves to no name.

This keeps identity decisions on the server, consistent with the project rule that
identity, room, and grants are never trusted from the client (see
[ADR 0001](0001-livekit-secret-single-source.md)), and with how host tokens are
minted from the session today.

## Extension: the Avatar travels the same path as the name

The display **name** is not the only identity attribute an account carries — a
signed-in account (notably one created via Google) also has a profile **image**
(`session.user.image`). The **Avatar** — that image, shown in a tile's camera-off
placeholder in place of the name initials — follows the **exact same rule** as the
name: resolved server-side from the session, never trusted from the browser.

Mechanically the image rides one step further than the name. The name becomes the
LiveKit token's `name` claim; the Avatar URL is added to the token **metadata**
(next to the existing `role`), because that is the channel every client already
reads for per-participant data. For a **Host** the image is read from the session
in the same `mintHostJoin` that already reads the name. For a signed-in **Guest**
the wrinkle is timing: the guest's join token is minted at **admit**, a
host-key-authorized call with no access to the guest's session. So — exactly as the
name is captured at **knock** and carried in the [[Knock]] state until admit — the
image is captured at knock (from the same `OptionalAuthGuard` session) and stored
on the knock alongside the name, then minted into the token at admit. The host's
waiting-room list shows it too. An absent image (anonymous guest, account without a
picture) or a URL that fails to load simply falls back to the initials; a broken
Avatar is never a Fault.

No new trust surface is introduced: the body still carries no image, the
`KnockDto` is unchanged, and the client only ever _reads_ the Avatar back out of
metadata the server signed.

## Considered Options

- **Server derives the name from the session (optional auth on knock)** — chosen.
  A signed-in guest cannot spoof another name; the name field disappears from their
  Device Check; the host and signed-in-guest name paths converge on one rule.
  Cost: an optional-session guard on a public route and a now-optional `KnockDto.name`.
- **Frontend-only: client reads `session.user.name` and sends it as the knock name** —
  rejected. Smaller change, but the server still trusts the body, so a signed-in
  user could POST a different name via devtools. It would leave identity trusted
  from the client, which the architecture rule forbids.
- **Require sign-in to knock at all** — rejected. Anonymous guests joining by link
  are a core part of the product; the waiting-room flow is deliberately public.
- **Let the signed-in guest edit a pre-filled name per call** — rejected. Meet-style
  fixed identity is the intended behaviour; an editable field reintroduces the spoof
  surface and the "which name is real?" ambiguity.

## Consequences

- The knock route carries an `OptionalAuthGuard`: it never rejects, it only enriches
  the request with the signed-in user when a session is present. A new
  `OptionalSessionUser` param decorator exposes `AuthUser | null` to the handler.
- `KnockDto.name` is optional. The resolved name is `session?.user.name ?? dto.name`;
  the service throws `400` if that resolves to empty, so anonymous knocks still
  require a body name.
- A signed-in non-host guest's Device Check no longer shows a name field
  (`requireName=false`); their account name is carried into the knock and the call.
  Anonymous guests are unchanged — they still type a name.
- Signed-in status changes **only** the name source. A signed-in non-owner is still
  a Guest who must knock and be admitted; nothing about admission, host authority,
  or the URL changes.
- The same optional-session pattern is now available for any future knock-adjacent
  endpoint that wants to recognise a signed-in caller without forcing sign-in.
- The pattern now carries **two** identity attributes, not one: the name (token
  `name` claim) and the **Avatar** URL (token `metadata`). The [[Knock]] state gains
  an `image` field captured at knock and minted at admit, mirroring the name. The
  Avatar renders in the camera-off placeholder of every tile (grid, Self-view,
  presentation strip) and in the host's waiting-room list, falling back to initials
  when absent or unloadable.
