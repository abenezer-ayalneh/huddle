import 'package:flutter_test/flutter_test.dart';
import 'package:huddle_control_agent_windows/core/bootstrap_link.dart';

void main() {
  test('accepts the exact approved deep-link shape', () {
    final descriptor = BootstrapLink.parse('huddle-control://join?api=https%3A%2F%2Fhuddle.example&room=room-1&session=session_1&code=abcdefgh');
    expect(descriptor.apiOrigin.toString(), 'https://huddle.example');
    expect(descriptor.room, 'room-1');
  });

  test('rejects public HTTP, duplicate security parameters, and malformed identifiers', () {
    expect(() => BootstrapLink.parse('huddle-control://join?api=http%3A%2F%2Fhuddle.example&room=room&session=session&code=abcdefgh'), throwsA(isA<BootstrapLinkException>()));
    expect(
      () => BootstrapLink.parse('huddle-control://join?api=https%3A%2F%2Fhuddle.example&api=https%3A%2F%2Fevil.example&room=room&session=session&code=abcdefgh'),
      throwsA(isA<BootstrapLinkException>()),
    );
    expect(() => BootstrapLink.parse('huddle-control://join?api=https%3A%2F%2Fhuddle.example&room=wrong%20room&session=session&code=abcdefgh'), throwsA(isA<BootstrapLinkException>()));
  });
}
