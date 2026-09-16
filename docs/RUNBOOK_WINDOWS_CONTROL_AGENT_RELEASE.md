# Release the Windows Control Agent public beta

This runbook releases the attended Windows x64 and ARM64 beta. It does not authorize a
production deployment or turn source checks into physical Remote Control
acceptance.

## Architecture-specific prereleases

The historical `windows-control-agent-arm64-v0.1.0` and
`windows-control-agent-x64-v0.1.0` releases are architecture-specific testing
artifacts. The Downloads page now selects the newest complete dual-architecture
Windows prerelease, which contains both native installers and their SHA-256
sidecars.

Use the `Windows Control Agent x64 prerelease` workflow only for a matching
x64-only testing artifact. It builds and packages on `windows-2022`, performs
the focused Flutter checks, and publishes `windows-control-agent-x64-vX.Y.Z`.
It remains separate from the full dual-architecture release and physical
acceptance evidence.

## Before a tag

1. On native x64 and native ARM64 Windows 10 22H2 or Windows 11, run
   `flutter analyze` and `flutter test` in `apps/control-agent-windows`. Use
   Flutter 3.44 or later; an x64 VM is not ARM64 acceptance evidence.
2. Build and install each matching installer with
   `build-installer.ps1 -Architecture x64` and
   `build-installer.ps1 -Architecture arm64`. Confirm the app launches from a
   `huddle-control://join` link, Program Files installation uses quoted link
   arguments, the executable, Start menu entry, and protocol association show
   the Huddle icon, and uninstall removes the protocol registration.
3. Exercise two browser participants against each physical Huddle environment:
   normal and elevated app input; two displays with mixed DPI and a portrait
   display; display switch/removal; Ctrl/Cmd copy and paste; lock, sleep,
   network loss, Controller/Sharer disconnect, Stop, and 30-minute renewal.
   Confirm the captured Windows cursor is suppressed while Huddle's browser
   cursor overlay remains visible. If the pinned Flutter WebRTC build cannot
   suppress it, add and audit a narrowly pinned patch before tagging a beta.
4. Record whether Windows publisher warnings were shown. The installer is
   unsigned; do not describe its checksum as publisher identity.
5. Ensure the repository is publicly readable so the Downloads page can read
   its release list and link to the current installers.

## Publish

1. Create `windows-control-agent-vX.Y.Z` only after the physical acceptance
   record is complete. The GitHub workflow builds, tests, packages, creates
   checksums, and publishes an immutable prerelease.
2. Verify both immutable installers, their `.sha256` files,
   on GitHub. The Downloads page refreshes the GitHub release list at most once
   per minute, so the new installer link can take up to one minute to appear.
3. Test a clean install and upgrade from physical x64 and ARM64 Windows PCs.
   Verify the app blocks a cached required version while the channel is
   unreachable, and shows a newer release only as a manual update.

## Rollback

Do not overwrite or delete a versioned prerelease asset. To withdraw a bad
release, publish a newer complete prerelease after the replacement installers
are available. The Downloads page will then select it automatically.
