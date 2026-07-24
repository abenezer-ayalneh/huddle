# Plain-text Clipboard Sharing for attended Remote Control

Status: accepted

An active Remote Control session includes **Clipboard Sharing**. While its
desktop is published, the macOS Control Agent observes changes to the Sharer's
plain-text pasteboard and sends transferable values only to the exact active
Controller. The browser Controller may send their own plain text only by using
their platform Paste shortcut; the agent writes that text to the Sharer's
pasteboard and injects the native Paste shortcut. A Controller Copy shortcut is
also injected natively, so remote application context-menu Copy is observed as a
regular pasteboard change.

This replaces ADR 0024's clipboard exclusion without relaxing its attended,
room-scoped authority boundary. Approval and each 30-minute reconfirmation name
mouse, keyboard, and plain-text clipboard sharing. The enabled status appears
only to the Sharer. Packets remain versioned, identity-bound, recipient-targeted,
session-scoped, authorization-sequenced, and reliable. The existing 8 KiB
on-wire budget applies; plain text is capped below it and oversized values are
rejected whole.

Clipboard contents are ephemeral. They never enter the HTTP API, Redis,
Postgres, LiveKit room metadata, logs, recordings, or audit records. The agent
clears its expected paste echo after observation and the browser retains at most
the latest value temporarily when browser clipboard write permission is blocked,
behind a one-click copy action. Once that in-memory state clears, Huddle retains
no copy.

Rich content, images, files, arbitrary binary data, desktop audio,
browser-independent background clipboard reads, remote context-menu Paste, and
unattended access remain out of scope.
