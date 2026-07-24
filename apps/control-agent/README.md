# Huddle Control Agent

The macOS Control Agent is the attended companion for Huddle Remote Control. It
is intentionally a native Swift app: the browser never receives desktop input
permissions, the LiveKit API secret, or the Control Agent token.

## Local development

```bash
swift test --package-path apps/control-agent
swift build --package-path apps/control-agent
```

The executable accepts a one-time `huddle-control://join?...` URL either from
macOS Launch Services or by pasting the complete link into its window. It checks
the signed release channel, asks the Sharer to trust the exact Huddle server
origin once, redeems the bootstrap code, and waits for an explicit display
selection plus **Start Remote Control** confirmation before publishing.

The app uses Huddle's dark visual system and guides the Sharer through server
trust, macOS permissions, and display selection. Manual launch, sanitized
diagnostics, and trusted-server reset remain available under **Having trouble?**
without competing with the primary session flow.

## Build a local `.app`

```bash
./apps/control-agent/scripts/build-app.sh
```

The resulting app is locally signed when an Apple Development identity is
available, but it is not a release artifact. Distribution must use a Developer
ID certificate, hardened runtime, notarization, and a separately published
update channel; those credentials and signing identities are intentionally not
stored in this repository. The build script embeds the LiveKit runtime
frameworks in the app bundle, so the `.app` can run outside SwiftPM's `.build`
directory.

### Regenerate the app icon

The committed `Resources/AppIcon.icns` is generated deterministically from the
editable Huddle artwork in `Resources/AppIcon.svg`:

```bash
./apps/control-agent/scripts/generate-app-icon.sh
```

Regeneration requires ImageMagick and Python Pillow. The normal app/release build
does not: it copies the committed ICNS into `Contents/Resources`, and
`CFBundleIconFile` identifies it to macOS.

### Keep macOS permissions stable during local development

Screen Recording and Accessibility approval are tied to the app's code-signing
identity, not just its bundle name. The build script automatically prefers an
installed `Apple Development` identity; set one explicitly when more than one
is available:

```bash
security find-identity -v -p codesigning
CODE_SIGN_IDENTITY='Apple Development: Your Name (TEAMID)' ./apps/control-agent/scripts/build-app.sh
```

Use `CODE_SIGN_IDENTITY=-` only when no development certificate is available.
That ad-hoc fallback changes identity on every build, so macOS can show an older
Huddle entry as allowed while the new build reports both permissions missing.
After switching identities, reset only Huddle's old grants and grant them again
to the rebuilt app:

```bash
tccutil reset ScreenCapture com.huddle.control-agent
tccutil reset Accessibility com.huddle.control-agent
```

With the required Apple credentials available in the environment, the release
helpers are:

```bash
./apps/control-agent/scripts/sign-and-notarize.sh
./apps/control-agent/scripts/package-dmg.sh
ARCHITECTURE=arm64 ./apps/control-agent/scripts/package-dmg.sh
ARCHITECTURE=x86_64 ./apps/control-agent/scripts/package-dmg.sh
```

The public beta release workflow is `.github/workflows/control-agent-release.yml`.
It builds native arm64 and x86_64 artifacts, signs nested frameworks before the
app, notarizes both the app and final DMG, publishes SHA-256 checksums, and
advances the signed `control-agent-beta` channel manifest. Apple Developer ID,
notarytool, and the separate Ed25519 update-signing key remain GitHub secrets.

Before creating a `control-agent-vX.Y.Z` tag, record signed-release-candidate
acceptance on a physical Apple Silicon Mac and Intel Mac. The tag publishes
immediately after the automated build because the physical gate is a documented
pre-tag release requirement.

The user must grant Screen Recording and Accessibility permissions in macOS
System Settings. The agent has no clipboard, file-transfer, audio-capture, or
background unattended-control capability. **Copy sanitized diagnostics** is an
explicit user action for beta support; it writes only version, macOS,
architecture, permission, and connection state to the clipboard and never reads
or uploads clipboard contents.
