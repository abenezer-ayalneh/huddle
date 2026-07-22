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
macOS Launch Services or from command-line arguments. It redeems the bootstrap
code once, validates the signed token metadata and room metadata projection,
then publishes only the desktop screen track and listens for the strict v1
mouse/keyboard data protocol.

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
```

The user must grant Screen Recording and Accessibility permissions in macOS
System Settings. The agent has no clipboard, file-transfer, audio-capture, or
background unattended-control capability.
