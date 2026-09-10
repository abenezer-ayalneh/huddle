import 'package:flutter_test/flutter_test.dart';
import 'package:huddle_control_agent_windows/core/native_architecture.dart';

void main() {
  test('accepts native x64 and ARM64 Windows', () {
    expect(supportsWindowsControlAgentArchitecture('x64'), isTrue);
    expect(supportsWindowsControlAgentArchitecture('arm64'), isTrue);
  });

  test('keeps 32-bit and unknown Windows architectures outside the beta', () {
    expect(supportsWindowsControlAgentArchitecture('x86'), isFalse);
    expect(supportsWindowsControlAgentArchitecture('arm32'), isFalse);
    expect(supportsWindowsControlAgentArchitecture('unknown'), isFalse);
    expect(unsupportedWindowsControlAgentArchitectureMessage('x86'), contains('32-bit'));
  });
}
