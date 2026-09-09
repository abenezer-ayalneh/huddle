# Attended Remote Control via a Windows Control Agent

Status: accepted

This ADR extends the server-authorized Remote Control model in ADR 0024 to
Windows 10 22H2 and Windows 11 x64. It does not create a new Remote Control
product, grant type, API endpoint, or browser capability. The existing active
room, explicit Sharer consent, one-time bootstrap, LiveKit companion identity,
Redis grant, Postgres metadata-only audit, 30-minute reconfirmation, either-party
Stop, Present mutual exclusion, and v1 data protocol remain authoritative.

## Decisions

- `apps/control-agent-windows` is a Flutter desktop app using LiveKit's Flutter
  SDK and a narrow C++ Win32 bridge. Dart owns link parsing, exact-origin trust,
  helper redemption, grant validation, session state, display flow, and UI. The
  bridge alone owns Per-Monitor-V2 DPI setup, virtual-desktop coordinate mapping,
  `SendInput`, bounded Unicode clipboard access, UAC relaunch, and Windows
  lifecycle notifications.
- The agent accepts only screen sources, never a window. It publishes only a
  selected physical display with screen audio disabled. Switching a display
  releases held input, stops clipboard monitoring, unpublishes the old track,
  updates physical display geometry, then requires a fresh local Start before
  publishing the replacement. Failure remains blank and retryable; display
  removal does not select a replacement automatically.
- Before every desktop publication and privileged packet, the agent verifies the
  JWT metadata, current room projection, local companion identity, exact
  SFU-attested Controller, session id, monotonic sequence, and renewal deadline.
  Loss of any value releases input, stops clipboard handling, unpublishes, and
  disconnects. Clipboard remains plain text, recipient-targeted, <=6 KiB, and
  never enters HTTP, Redis, Postgres, metadata, logs, recordings, or audit rows.
- The normal executable requests `asInvoker`, with `uiAccess=false`. A Sharer
  can deliberately relaunch the still-unredeemed app using Windows `runas`
  before connecting to control administrator applications. The UAC prompt is a
  local Sharer decision. An elevated process serves one attended session and
  exits; it never accepts additional links. UAC secure desktop, login, services,
  Ctrl+Alt+Delete, policy changes, and unattended elevation are excluded.
- The application ends rather than resumes when the workstation locks, logs out,
  disconnects its desktop session, or suspends. Re-entry always requires a new
  browser-approved session.
- Public Windows beta artifacts are x64 Inno Setup installers in GitHub Releases.
  They install in Program Files and register a quoted `huddle-control` protocol.
  The installer is unsigned. A separate Ed25519-signed Windows manifest records
  its immutable URL, SHA-256, version, minimum version, Windows minimum, and
  release notes. Its signature authenticates the metadata and expected checksum;
  the checksum must be used to verify downloaded bytes. Neither is Authenticode
  publisher trust.

## Consequences

Windows is now a source-level implementation and CI release path, but not a
completed device acceptance claim. Release requires Windows 10 and Windows 11
physical tests covering ordinary/elevated apps, two browsers, monitor topology
and DPI changes, display removal, locks/sleep, reconnects, grant expiry,
installer upgrades/uninstall, and unsigned-publisher behavior. ARM64 and Linux
remain future platform work.
