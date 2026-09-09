# Release the Windows Control Agent public beta

This runbook releases the attended Windows x64 beta. It does not authorize a
production deployment or turn source checks into physical Remote Control
acceptance.

## Before a tag

1. On Windows 10 22H2 and Windows 11 x64, run `flutter analyze` and
   `flutter test` in `apps/control-agent-windows`.
2. Build and install the x64 installer. Confirm the app launches from a
   `huddle-control://join` link, Program Files installation uses quoted link
   arguments, and uninstall removes the protocol registration.
3. Exercise two browser participants against a physical Huddle environment:
   normal and elevated app input; two displays with mixed DPI and a portrait
   display; display switch/removal; Ctrl/Cmd copy and paste; lock, sleep,
   network loss, Controller/Sharer disconnect, Stop, and 30-minute renewal.
   Confirm the captured Windows cursor is suppressed while Huddle's browser
   cursor overlay remains visible. If the pinned Flutter WebRTC build cannot
   suppress it, add and audit a narrowly pinned patch before tagging a beta.
4. Record whether Windows publisher warnings were shown. The installer is
   unsigned; do not describe checksum or manifest validation as Authenticode.
5. Configure GitHub secrets `WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64` and
   `WINDOWS_AGENT_UPDATE_KEY_ID`. Add the matching public key and channel URL to
   the deployment's `WINDOWS_CONTROL_AGENT_*` environment configuration.

## Publish

1. Create `windows-control-agent-vX.Y.Z` only after the physical acceptance
   record is complete. The GitHub workflow builds, tests, packages, checksums,
   publishes an immutable prerelease, signs its manifest, then advances the
   `windows-control-agent-beta` manifest channel.
2. Verify the immutable installer, `.sha256`, `release-manifest.json`, and
   `release-manifest.sig` on GitHub. Confirm that a configured Downloads page
   displays **Verified manifest**, not a publisher-trust claim.
3. Test a clean install and upgrade from a physical Windows PC. Verify the app
   blocks a cached required version while the channel is unreachable, and shows
   a newer release only as a manual update.

## Rollback

Do not overwrite or delete a versioned prerelease asset. To withdraw a bad
release, publish a newer manifest with a raised minimum version only after a
replacement installer is available, or remove the Windows release configuration
from the deployment to disable downloads. Existing installed clients retain any
previously verified minimum requirement by design.
