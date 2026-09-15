# Retire the Windows x86 Control Agent

Status: accepted

## Decision

Windows Control Agent support is limited to native `x64` and `arm64` builds.
The separate Electron 43 x86 companion, its Node-API bridge, signed-manifest
`x86` artifact, Downloads entry, and CI release job are removed. ADR 0034 is
superseded.

## Rationale

The x86 implementation existed only because Flutter does not ship a supported
32-bit Windows desktop target. Electron 43 was its final upstream Windows x86
runtime and created a January 2027 maintenance deadline. Retiring native
32-bit Windows support removes that unmaintained-runtime risk without changing
the attended Remote Control authority boundary.

## Consequences

Windows 10 22H2 and Windows 11 users need a native x64 or ARM64 PC to use the
Control Agent. Windows release manifests publish x64 and optional ARM64
artifacts only. The Flutter/C++ agent retains the one-time bootstrap, local
display selection and Start, identity-bound grants, bounded clipboard, and
either-party Stop requirements.
