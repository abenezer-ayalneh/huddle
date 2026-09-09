import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:huddle_control_agent_windows/core/control_protocol.dart';

void main() {
  test('accepts the shared v1 protocol fixtures used by the browser and macOS agent', () {
    final file = File('../../../fixtures/control-protocol-v1.json');
    final fixtures = (jsonDecode(file.readAsStringSync()) as Map<String, dynamic>)['packets'] as List<dynamic>;
    for (final fixture in fixtures.cast<Map<String, dynamic>>()) {
      final packet = utf8.encode(jsonEncode(fixture['payload']));
      expect(ControlProtocol.decode(packet) != null, fixture['valid'], reason: fixture['name'] as String);
    }
  });

  test('accepts a bounded packet and rejects replay-safe malformed variants', () {
    final valid = utf8.encode(jsonEncode({
      'v': 1,
      'type': 'remote-control:input',
      'sessionId': 'session-1',
      'sequence': 4,
      'event': {'kind': 'key', 'action': 'down', 'key': 'a', 'code': 'KeyA', 'modifiers': ['ctrl']},
    }));
    expect(ControlProtocol.decode(valid)?.sequence, 4);

    final extra = utf8.encode(jsonEncode({
      'v': 1,
      'type': 'remote-control:clipboard-copy',
      'sessionId': 'session-1',
      'sequence': 4,
      'untrusted': true,
    }));
    expect(ControlProtocol.decode(extra), isNull);
    expect(ControlProtocol.decode(List<int>.filled(maximumControlPacketBytes + 1, 0)), isNull);
  });

  test('keeps keyboard packets compatible with the browser v1 schema', () {
    final withoutOptionalKey = utf8.encode(jsonEncode({
      'v': 1,
      'type': 'remote-control:input',
      'sessionId': 'session-1',
      'sequence': 5,
      'event': {'kind': 'key', 'action': 'down', 'code': 'Numpad7', 'modifiers': const []},
    }));
    expect(ControlProtocol.decode(withoutOptionalKey), isNotNull);

    final unknownCode = utf8.encode(jsonEncode({
      'v': 1,
      'type': 'remote-control:input',
      'sessionId': 'session-1',
      'sequence': 6,
      'event': {'kind': 'key', 'action': 'down', 'code': 'UntrustedKey', 'modifiers': const []},
    }));
    expect(ControlProtocol.decode(unknownCode), isNull);
  });

  test('bounds clipboard updates before data publication', () {
    expect(ControlProtocol.isTransferableClipboardText('text'), isTrue);
    expect(ControlProtocol.isTransferableClipboardText(''), isFalse);
    expect(ControlProtocol.isTransferableClipboardText('x' * (maximumClipboardTextBytes + 1)), isFalse);
    expect(
      () => ControlProtocol.clipboardUpdate(sessionId: 'session', revision: 1, text: 'x' * (maximumClipboardTextBytes + 1)),
      throwsArgumentError,
    );
  });
}
