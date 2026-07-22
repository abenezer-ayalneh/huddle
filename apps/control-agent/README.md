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

The resulting app is unsigned. Release distribution must use a Developer ID
certificate, hardened runtime, notarization, and a separately published update
channel; those credentials and signing identities are intentionally not stored
in this repository. The build script embeds the LiveKit runtime frameworks in
the app bundle, so the `.app` can run outside SwiftPM's `.build` directory.

With the required Apple credentials available in the environment, the release
helpers are:

```bash
./apps/control-agent/scripts/sign-and-notarize.sh
./apps/control-agent/scripts/package-dmg.sh
```

The user must grant Screen Recording and Accessibility permissions in macOS
System Settings. The agent has no clipboard, file-transfer, audio-capture, or
background unattended-control capability.
