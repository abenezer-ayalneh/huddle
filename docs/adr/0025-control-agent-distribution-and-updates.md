# Public Beta Distribution and Updates for the Control Agent

Status: accepted

The Control Agent is distributed as a public macOS beta through versioned GitHub
Releases. Only the Sharer installs it; the Controller remains browser-only.

## Decisions

- Publish separate arm64 and x86_64 DMGs for macOS 13+.
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

## Consequences

Huddle owns an Apple release credential set, an update-signing key, a public
release channel, and a physical acceptance checklist. The public beta does not
add Windows/Linux agents, auto-updating, telemetry, clipboard/file/audio
features, or unattended access.
