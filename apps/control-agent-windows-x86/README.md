# Huddle Control Agent for 32-bit Windows

This package is the attended Huddle Remote Control companion for native 32-bit
Windows 10 22H2. It is separate from the Flutter x64/ARM64 agent because Flutter
does not ship a Windows x86 desktop target. It uses Electron 43's final
`win32-ia32` runtime, Chromium's LiveKit client, and a narrow `ia32` Node-API
bridge for selected-display input mapping, bounded plain-text clipboard,
lifecycle release, and explicit UAC relaunch.

The security contract is identical to the other Windows agent: one-time
exact-origin bootstrap; identity, room, grant, metadata, sender, and sequence
checks before OS input; explicit local display selection and Start; either-party
Stop; no unattended access, file transfer, desktop audio, microphone, or rich
clipboard. The browser remains the meeting and the API remains the authority.

## Build on Windows

Install Node 24, Python available to `node-gyp`, and Visual Studio's **Desktop
development with C++** workload including x86 build tools. Then run:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @huddle/control-agent-windows-x86 typecheck
pnpm --filter @huddle/control-agent-windows-x86 test
$env:WINDOWS_CONTROL_AGENT_VERSION = '0.1.0'
pnpm --filter @huddle/control-agent-windows-x86 build
```

The build compiles the Node-API bridge against Electron 43 headers as `ia32`,
bundles the renderer, and writes
`dist/Huddle-Control-Agent-windows-x86.exe` with its SHA-256 file. It does not
claim physical acceptance: test on a real 32-bit Windows 10 22H2 PC before a
tagged beta. Windows 11 has no 32-bit edition.

Electron 43 is the final upstream release line with Windows x86 binaries and
ends support in January 2027. Do not ship later x86 updates without an approved
replacement runtime or an explicit retirement decision. See
[`docs/adr/0034-windows-control-agent-x86.md`](../../docs/adr/0034-windows-control-agent-x86.md)
and the [Windows release runbook](../../docs/RUNBOOK_WINDOWS_CONTROL_AGENT_RELEASE.md).
