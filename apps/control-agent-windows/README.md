# Huddle Control Agent for Windows

The Windows Control Agent is the narrow, attended companion for Huddle Remote
Control. Only the Sharer installs it; the meeting, request, approval, renewal,
and Stop controls remain in the browser. The app receives a one-time
`huddle-control://join` link, asks the user to trust the exact HTTPS Huddle API
origin, redeems it once, waits for a selected physical display and an explicit
local Start, then joins LiveKit as the existing `control-agent:<sessionId>`
participant.

It targets Windows 10 22H2 and Windows 11 x64. The app is Per-Monitor-V2 DPI
aware and maps normalized browser coordinates through the selected display and
Windows virtual desktop. It publishes display video only: no microphone,
desktop audio, files, rich clipboard, persistent credentials, background
service, or unattended access is included.

## Local development

Install Flutter 3.24.3 or later plus Visual Studio 2022's **Desktop development
with C++** workload, the Windows 10/11 SDK, and Inno Setup 6 for packaging.

```powershell
cd apps/control-agent-windows
flutter pub get
flutter analyze
flutter test
flutter run -d windows
```

The app runs `asInvoker` by default. Before a connection begins, the Sharer may
choose **Allow control of administrator apps**. Windows presents UAC locally and
restarts the app elevated with the same still-unredeemed bootstrap. Switching
mode after connection is intentionally unavailable: stop the attended session,
then obtain a fresh approval in the browser. UAC secure desktop, sign-in,
Ctrl+Alt+Delete, Windows services, and background/unattended control are always
out of scope.

## Release configuration and packaging

The release manifest is optional in local builds. A beta release configures the
following compile-time values in CI; both must be present together:

```powershell
flutter build windows --release `
  --dart-define=WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL=https://github.com/OWNER/REPO/releases/download/windows-control-agent-beta `
  --dart-define=WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY=BASE64_ED25519_PUBLIC_KEY
```

The app verifies the platform-specific signed manifest before redeeming a new
bootstrap. A cached minimum-version requirement remains effective when the
channel is unavailable. An available update is advisory and manual; the agent
never installs updates, especially during an elevated or active session.

Create the unsigned x64 installer locally with:

```powershell
./apps/control-agent-windows/scripts/build-installer.ps1 -Version 0.1.0
```

It installs to Program Files and registers the `huddle-control` link using a
quoted executable and argument. The beta installer is deliberately unsigned:
the SHA-256 checksum and signed release manifest verify release metadata and
artifact bytes, but do not provide Windows publisher trust. See
[`docs/RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md`](../../docs/RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md)
for the release procedure and physical acceptance matrix.
