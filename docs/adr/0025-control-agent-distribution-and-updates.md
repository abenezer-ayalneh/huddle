# Public Beta Distribution and Updates for the Control Agent

Status: accepted (amended for the no-cost Apple-Silicon beta)

The Control Agent is distributed as a public macOS beta through versioned GitHub
Releases. Only the Sharer installs it; the Controller remains browser-only.

## Decisions

- The trusted channel publishes separate arm64 and x86_64 DMGs for macOS 13+.
- Use `control-agent-vX.Y.Z` tags for versioned prereleases and a permanent
  `control-agent-beta` release containing the signed channel manifest.
- Sign and notarize the app and final DMG in GitHub Actions. The workflow runs
  on native arm64 and Intel macOS runners and publishes only after both jobs
  pass. Physical signed-release-candidate acceptance on both architectures is
  a pre-tag gate.
- The manifest contains version, minimum supported version, macOS minimum,
  immutable artifact URLs, sizes, SHA-256 values, release notes, and a key id.
  It is signed with a separate Ed25519 key. The app and Downloads page verify
  it when the public key is configured.
- Normal updates are advisory and send the Sharer to `/downloads`. A release
  may mark a minimum version; an older agent blocks new bootstrap redemption.
  If GitHub is unavailable, a previously verified minimum remains enforced;
  otherwise the agent may continue with an update warning.
- The app trusts an exact HTTPS API origin only after a local confirmation. The
  trust record contains no room, participant, bootstrap, or LiveKit credential.
- A bootstrap reissue is participant-authorized and Sharer-only. It revokes the
  prior bearer and creates a fresh two-minute single-use code while the active
  session is still awaiting its agent.

### No-cost Apple-Silicon beta

- The first public arm64 beta may be built locally with an ad-hoc signature and
  uploaded to the permanent `control-agent-free-beta` GitHub prerelease. Its
  DMG and SHA-256 checksum are produced by
  `apps/control-agent/scripts/build-free-beta.sh`; publication uses
  `publish-free-beta.sh` and only a free GitHub account with repository write
  access.
- This is intentionally **not** a Developer ID-signed or notarized release. The
  Downloads page labels it as such, links the exact checksum, and gives the
  narrow macOS **Open Anyway** path. It never tells a user to disable Gatekeeper
  globally.
- The no-cost beta has no signed release manifest or automatic/required update
  enforcement. The app's empty update public key makes release checking
  unavailable while preserving the attended Remote Control authority boundary.
- The trusted `control-agent-vX.Y.Z` and `control-agent-beta` channels remain
  available for a future Developer ID release; the no-cost asset must not be
  substituted into either signed channel.

## Consequences

Huddle has published a no-cost Apple-Silicon beta with a deliberate Gatekeeper
warning instead of Apple trust; physical two-browser acceptance remains a
separate, outstanding gate. A future trusted release still needs an Apple
release credential set, an update-signing key, a public release channel, and a
physical acceptance checklist. Neither path adds Windows/Linux agents,
telemetry, clipboard/file/audio features, or unattended access.
