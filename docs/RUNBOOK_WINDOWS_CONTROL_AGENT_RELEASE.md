# Release the Windows Control Agent public beta

This runbook releases the attended Windows x64 and ARM64 beta. It does not authorize a
production deployment or turn source checks into physical Remote Control
acceptance.

## Architecture-only prereleases

On 2026-09-16, [`windows-control-agent-arm64-v0.1.0`](https://github.com/abenezer-ayalneh/huddle/releases/tag/windows-control-agent-arm64-v0.1.0)
and [`windows-control-agent-x64-v0.1.0`](https://github.com/abenezer-ayalneh/huddle/releases/tag/windows-control-agent-x64-v0.1.0)
were published as unsigned GitHub prereleases. Each contains its matching
native installer and SHA-256 sidecar. The x64 artifact was built, analyzed,
and tested on a native GitHub x64 runner in
[run 35060018153](https://github.com/abenezer-ayalneh/huddle/actions/runs/35060018153).
They are deliberately separate testing artifacts, not an advance of
`windows-control-agent-beta`:

- It contains no x64 installer and no signed release manifest.
- The Downloads page offers each installer as an explicitly unsigned,
  architecture-specific prerelease; it must not label either as a verified
  release channel.
- It does not supply x64 or full attended Remote Control acceptance evidence.

The normal dual-architecture release process below remains required before
advancing the signed beta channel.

Use the `Windows Control Agent x64 prerelease` workflow only for a matching
x64-only testing artifact. It builds and packages on `windows-2022`, performs
the focused Flutter checks, and publishes `windows-control-agent-x64-vX.Y.Z`.
It has the same manifest and full-acceptance exclusions as the ARM64-only
prerelease.

## Before a tag

1. On native x64 and native ARM64 Windows 10 22H2 or Windows 11, run
   `flutter analyze` and `flutter test` in `apps/control-agent-windows`. Use
   Flutter 3.44 or later; an x64 VM is not ARM64 acceptance evidence.
2. Build and install each matching installer with
   `build-installer.ps1 -Architecture x64` and
   `build-installer.ps1 -Architecture arm64`. Confirm the app launches from a
   `huddle-control://join` link, Program Files installation uses quoted link
   arguments, and uninstall removes the protocol registration.
3. Exercise two browser participants against each physical Huddle environment:
   normal and elevated app input; two displays with mixed DPI and a portrait
   display; display switch/removal; Ctrl/Cmd copy and paste; lock, sleep,
   network loss, Controller/Sharer disconnect, Stop, and 30-minute renewal.
   Confirm the captured Windows cursor is suppressed while Huddle's browser
   cursor overlay remains visible. If the pinned Flutter WebRTC build cannot
   suppress it, add and audit a narrowly pinned patch before tagging a beta.
4. Record whether Windows publisher warnings were shown. The installer is
   unsigned; do not describe checksum or manifest validation as Authenticode.
5. Configure GitHub secrets `WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64`,
   `WINDOWS_AGENT_UPDATE_PUBLIC_KEY`, and `WINDOWS_AGENT_UPDATE_KEY_ID`.
   Confirm the public key matches the private signing key. The production deploy
   synchronizes that public key and the fixed Windows beta-channel URLs into its
   gitignored `WINDOWS_CONTROL_AGENT_*` environment configuration before it
   rebuilds the Downloads page.

## Publish

1. Create `windows-control-agent-vX.Y.Z` only after the physical acceptance
   record is complete. The GitHub workflow builds, tests, packages, checksums,
   publishes an immutable prerelease, signs its manifest, then advances the
   `windows-control-agent-beta` manifest channel.
2. Verify both immutable installers, their `.sha256` files,
   `release-manifest.json`, and `release-manifest.sig` on GitHub. Confirm that a
   configured Downloads page displays **Verified manifest**, not a
   publisher-trust claim.
3. Test a clean install and upgrade from physical x64 and ARM64 Windows PCs.
   Verify the app blocks a cached required version while the channel is
   unreachable, and shows a newer release only as a manual update.

## Rollback

Do not overwrite or delete a versioned prerelease asset. To withdraw a bad
release, publish a newer manifest with a raised minimum version only after a
replacement installer is available, or remove the Windows release configuration
from the deployment to disable downloads. Existing installed clients retain any
previously verified minimum requirement by design.
