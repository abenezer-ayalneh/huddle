const supportedWindowsControlAgentArchitectures = <String>{'x64', 'arm64'};

bool supportsWindowsControlAgentArchitecture(String architecture) =>
    supportedWindowsControlAgentArchitectures.contains(architecture);

String unsupportedWindowsControlAgentArchitectureMessage(String architecture) {
  if (architecture == 'x86' || architecture == 'arm32') {
    return 'Huddle Control Agent requires 64-bit Windows. 32-bit Windows is not supported.';
  }
  return 'Huddle Control Agent supports native x64 and ARM64 Windows only.';
}
