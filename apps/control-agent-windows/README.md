# Huddle Control Agent for Windows

The Windows Control Agent is the narrow, attended companion for Huddle Remote
Control. Only the Sharer installs it; the meeting, request, approval, renewal,
and Stop controls remain in the browser. The app receives a one-time
`huddle-control://join` link, asks the user to trust the exact HTTPS Huddle API
origin, redeems it once, waits for a selected physical display and an explicit
local Start, then joins LiveKit as the existing `control-agent:<sessionId>`
participant.

This Flutter implementation targets native x64 and ARM64 Windows 10 22H2 and
Windows 11 PCs; 32-bit Windows is unsupported. This app is Per-Monitor-V2 DPI aware and maps normalized
browser coordinates through the selected display and Windows virtual desktop. It publishes display video only: no microphone,
desktop audio, files, rich clipboard, persistent credentials, background
service, or unattended access is included.

## Local development

Install Flutter 3.44 or later plus Visual Studio 2022's **Desktop development
with C++** workload, the Windows 10/11 SDK, and Inno Setup 6 for packaging.

```powershell
cd apps/control-agent-windows
flutter pub get
flutter analyze
flutter test
flutter run -d windows
```

The app runs `asInvoker` by default. The browser handoff waits for the Sharer to
choose **Open Agent**, then connects the companion directly to the room and
leaves display selection and the local **Start Remote Control** action with the
Sharer. If administrator applications need control, choose **Copy for admin
mode** in the browser first, paste that still-unredeemed link into the app's
manual fallback, and select **Open in administrator-app mode**; Windows presents
UAC locally and restarts the app elevated before redemption. Switching
mode after connection is intentionally unavailable: stop the attended session,
then obtain a fresh approval in the browser. UAC secure desktop, sign-in,
Ctrl+Alt+Delete, Windows services, and background/unattended control are always
out of scope.

## Packaging

Public beta installers use only the version supplied to the build:

```powershell
flutter build windows --release --dart-define=WINDOWS_CONTROL_AGENT_VERSION=0.1.1
```

Updates are manual. Download the newer installer from Huddle's Downloads page
and install it after ending any active Remote Control session.

Create the unsigned installer on a Windows computer with the matching native
processor architecture:

```powershell
./apps/control-agent-windows/scripts/build-installer.ps1 -Version 0.1.0 -Architecture x64
# Or, on native Windows on ARM:
./apps/control-agent-windows/scripts/build-installer.ps1 -Version 0.1.0 -Architecture arm64
```

It produces an architecture-specific installer in `dist/`, installs to Program
Files, creates a Start menu entry, and registers the `huddle-control` link
using a quoted executable and argument. The Huddle app icon is embedded in the
executable and used by the installed app, Start menu entry, and protocol
association. Verify its SHA-256 checksum before opening it. See
[`docs/RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md`](../../docs/RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md)
for the release procedure and physical acceptance matrix.
