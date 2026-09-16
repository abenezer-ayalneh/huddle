# Huddle Control Agent

The macOS Control Agent is the attended companion for Huddle Remote Control. It
is intentionally a native Swift app: the browser never receives desktop input
permissions, the LiveKit API secret, or the Control Agent token.

## Local development

```bash
swift test --package-path apps/control-agent
swift build --package-path apps/control-agent
# SDK-fork capture filter and selected-display dimension coverage (macOS)
swift test --package-path apps/control-agent/Vendor/client-sdk-swift --filter MacOSScreenCapturerTests
```

The executable accepts a one-time `huddle-control://join?...` URL either from
macOS Launch Services or by pasting the complete link into its window. It asks
the Sharer to trust the exact Huddle server origin once, redeems the bootstrap
code, and waits for an explicit display selection plus **Start Remote Control**
confirmation before publishing.

The app uses Huddle's dark visual system and guides the Sharer through server
trust, macOS permissions, and display selection. The selected display is the
entire physical monitor, including the menu bar, Dock, desktop, all app windows,
and the Control Agent window. After publishing, the Sharer's **Change display**
picker switches immediately within the same approved session; input is disabled
through the protected unpublish/publish gap and a failed switch stays retryable.
Manual launch, sanitized diagnostics, and trusted-server reset remain available
under **Having trouble?** without competing with the primary session flow.

## Build a local `.app`

```bash
./apps/control-agent/scripts/build-app.sh
```

The build script embeds the LiveKit runtime frameworks in the app bundle, so the
`.app` can run outside SwiftPM's `.build` directory. For public distribution,
use the beta packaging commands below and publish the DMG with its checksum.

### Build a no-cost Apple-Silicon public beta

```bash
./apps/control-agent/scripts/build-free-beta.sh
./apps/control-agent/scripts/publish-free-beta.sh
```

The first command creates an arm64 DMG and an adjacent SHA-256 checksum; the
second publishes them to the permanent `control-agent-free-beta` GitHub
prerelease. A free GitHub account with write access is enough, but it must be
authenticated locally first.

This path is unsigned and unnotarized.
macOS will show a warning on first launch; after verifying the checksum from the
same GitHub release, the tester must explicitly choose **Open Anyway** in
**System Settings → Privacy & Security**. It is a testing/public-beta path only,
and newer versions are installed manually from the Downloads page.

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

The user must grant Screen Recording and Accessibility permissions in macOS
System Settings. During an active, approved Remote Control session, the agent
observes and relays only transferable plain-text clipboard changes to the exact
Controller, accepts Controller text only through the native Paste shortcut, and
never persists or uploads clipboard contents. It has no rich/binary clipboard,
file-transfer, desktop-audio capture, or background unattended-control
capability. Sharer renewal remains required every 30 minutes and Present remains
mutually exclusive.
**Copy sanitized diagnostics** is an explicit user action for beta support; it
writes only version, macOS, architecture, permission, and connection state to
the clipboard.
