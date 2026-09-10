# Native ARM64 Windows Control Agent release path

Status: accepted

This decision amends the x64-only Windows distribution boundary in ADR 0032.
It extends the existing attended Remote Control agent to native ARM64 Windows;
it does not add a capability, authority, endpoint, grant, or background mode.
ADR 0024, ADR 0026, and ADR 0032 remain authoritative for consent, identity,
Stop, renewal, display, clipboard, UAC, and lifecycle constraints.

## Decisions

- The Windows Control Agent supports native `x64` and `arm64` installations on
  Windows 10 22H2 and Windows 11. The Win32 bridge identifies the native system
  architecture through `GetNativeSystemInfo`; a 32-bit process or an unknown
  architecture fails before a bootstrap can be redeemed.
- Flutter 3.44 or later is required. ARM64 builds run on a native ARM64 Windows
  host, and their release script verifies the produced executable's PE machine
  type before packaging. x64 and ARM64 are not treated as cross-compile targets.
- Each architecture has its own Inno Setup installer, filename, SHA-256 value,
  and architecture restriction. The signed Windows manifest carries both
  immutable artifacts. When a configured channel is reachable and its signature
  is valid, the agent requires the manifest entry matching its native
  architecture before redeeming a newly approved bootstrap.
- GitHub Actions builds and tests x64 on `windows-2022` and ARM64 on
  `windows-11-arm`, then publishes the two installers only after both jobs
  complete. This is automation, not device acceptance evidence.
- 32-bit Windows (`x86`) and 32-bit ARM (`arm32`) remain unsupported. Flutter's
  Windows desktop target produces x64 and ARM64 artifacts, not a 32-bit Windows
  application; no installer or manifest entry may imply otherwise.

## Consequences

The Downloads page can offer a verified ARM64 installer beside the x64 installer
without silently selecting either one. Physical acceptance still needs both
architectures: ordinary and elevated applications, browser handoff, selected
display geometry and DPI, input, clipboard, lifecycle termination, installer
upgrade/uninstall, release verification, and unsigned-publisher behavior. ARM64
acceptance also needs real Windows-on-ARM hardware; an x64 Windows VM or runner
is not a substitute.
