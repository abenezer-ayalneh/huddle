# Windows x86 Control Agent release path

Status: accepted

This decision amends ADR 0033's 32-bit Windows exclusion. It does not change
the attended Remote Control authority boundary in ADR 0024, ADR 0026, or ADR
0032: the browser still owns request, approval, renewal, and Stop; the agent
still accepts a one-time bootstrap, requires an explicit local display and
Start, and remains the final authority for OS input.

## Decisions

- Native Windows x64 and ARM64 remain the Flutter/C++ agent described in ADR 0033. The x86 implementation is a separate Electron 43 companion with the
  browser LiveKit client and a narrow `ia32` Node-API Windows bridge for
  selected-display coordinate mapping, `SendInput`, bounded plain-text
  clipboard, UAC relaunch, and lifecycle state. It does not use a Flutter
  binary labelled as x86.
- The x86 package accepts the same exact-origin one-time bootstrap, validates
  the same token and room metadata bindings, targets packets to the approved
  Controller identity, rejects replayed sequences, sends only bounded
  plain-text clipboard data, releases held input on all termination paths, and
  publishes one local screen only after the active room grant and explicit
  local Start.
- The x86 artifact targets 32-bit Windows 10 22H2. Windows 11 has no 32-bit
  edition, so x86 is not presented as a Windows 11 compatibility path. It may
  also run under WoW64 where the installer is deliberately selected, but that
  does not replace native 32-bit physical acceptance.
- Each tagged beta now has immutable x64, ARM64, and x86 installers and
  checksums in one signed manifest. A configured x86 agent stops before
  bootstrap redemption if a valid signed manifest lacks `downloads.x86`.
- Electron 43 is pinned because it is Electron's final line shipping
  `win32-ia32` binaries; Electron 44 removes 32-bit builds. Treat the end of
  Electron 43 support in January 2027 as a release-blocking maintenance
  deadline: do not silently continue shipping an unmaintained x86 runtime.

## Consequences

The project has two Windows client implementations rather than claiming
unsupported Flutter x86 output. The release workflow cross-builds the Electron
x86 installer and its native bridge on `windows-2022`, while ARM64 continues to
build on a native Windows-on-ARM runner. CI proves source and packaging wiring
only. Before a release, a physical 32-bit Windows 10 22H2 PC must verify
protocol handoff, ordinary and UAC input, selected-display geometry/DPI,
clipboard, lifecycle stop, installer upgrade/uninstall, release verification,
and unsigned-publisher behavior. A 64-bit VM, WoW64 run, or green build is not
substitute evidence.
