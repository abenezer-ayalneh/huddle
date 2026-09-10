# Release the Windows Control Agent public beta

This runbook releases the attended Windows x64, ARM64, and x86 beta. It does not authorize a
production deployment or turn source checks into physical Remote Control
acceptance.

## Before a tag

1. On native x64 and native ARM64 Windows 10 22H2 or Windows 11, run
   `flutter analyze` and `flutter test` in `apps/control-agent-windows`. Use
   Flutter 3.44 or later; an x64 VM is not ARM64 acceptance evidence.
2. Build and install each matching installer with
   `build-installer.ps1 -Architecture x64` and
   `build-installer.ps1 -Architecture arm64`. Confirm the app launches from a
   `huddle-control://join` link, Program Files installation uses quoted link
   arguments, and uninstall removes the protocol registration.
3. On a physical 32-bit Windows 10 22H2 PC, run `corepack enable`,
   `pnpm install --frozen-lockfile`, and the `typecheck`, `test`, and `build`
   scripts in `apps/control-agent-windows-x86`. The package must produce
   `Huddle-Control-Agent-windows-x86.exe`; a 64-bit VM or WoW64 launch is not
   native x86 acceptance evidence. Do not test this artifact on Windows 11:
   Windows 11 has no 32-bit edition.
4. Exercise two browser participants against each physical Huddle environment:
   normal and elevated app input; two displays with mixed DPI and a portrait
   display; display switch/removal; Ctrl/Cmd copy and paste; lock, sleep,
   network loss, Controller/Sharer disconnect, Stop, and 30-minute renewal.
   Confirm the captured Windows cursor is suppressed while Huddle's browser
   cursor overlay remains visible. If the pinned Flutter WebRTC build cannot
   suppress it, add and audit a narrowly pinned patch before tagging a beta.
5. Record whether Windows publisher warnings were shown. The installer is
   unsigned; do not describe checksum or manifest validation as Authenticode.
6. Configure GitHub secrets `WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64` and
   `WINDOWS_AGENT_UPDATE_KEY_ID`. Add the matching public key and channel URL to
   the deployment's `WINDOWS_CONTROL_AGENT_*` environment configuration.

## Publish

1. Create `windows-control-agent-vX.Y.Z` only after the physical acceptance
   record is complete. The GitHub workflow builds, tests, packages, checksums,
   publishes an immutable prerelease, signs its manifest, then advances the
   `windows-control-agent-beta` manifest channel. The x86 job cross-builds the
   Electron 43 `ia32` package and Node-API bridge on `windows-2022`; Electron
   43 is the final upstream Windows x86 runtime. Do not create a release after
   its January 2027 end of support without an approved replacement or explicit
   retirement decision.
2. Verify all three immutable installers, their `.sha256` files,
   `release-manifest.json`, and `release-manifest.sig` on GitHub. Confirm that a
   configured Downloads page displays **Verified manifest**, not a
   publisher-trust claim.
3. Test a clean install and upgrade from physical x64 and ARM64 Windows PCs,
   plus native x86 Windows 10 22H2.
   Verify the app blocks a cached required version while the channel is
   unreachable, and shows a newer release only as a manual update.

## Rollback

Do not overwrite or delete a versioned prerelease asset. To withdraw a bad
release, publish a newer manifest with a raised minimum version only after a
replacement installer is available, or remove the Windows release configuration
from the deployment to disable downloads. Existing installed clients retain any
previously verified minimum requirement by design.
