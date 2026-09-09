import 'dart:convert';

const remoteControlTopic = 'huddle:remote-control';
const remoteControlVersion = 1;
const maximumControlPacketBytes = 8 * 1024;
const maximumClipboardTextBytes = 6 * 1024;

sealed class ControlCommand {
  const ControlCommand();
}

class InputCommand extends ControlCommand {
  const InputCommand(this.event);
  final Map<String, dynamic> event;
}

class ClipboardCopyCommand extends ControlCommand {
  const ClipboardCopyCommand();
}

class ClipboardPasteCommand extends ControlCommand {
  const ClipboardPasteCommand(this.text);
  final String text;
}

class ControlPacket {
  const ControlPacket({required this.sessionId, required this.sequence, required this.command});
  final String sessionId;
  final int sequence;
  final ControlCommand command;
}

class ControlProtocol {
  static ControlPacket? decode(List<int> bytes) {
    if (bytes.isEmpty || bytes.length > maximumControlPacketBytes) return null;
    try {
      final root = jsonDecode(utf8.decode(bytes));
      if (root is! Map<String, dynamic> || root['v'] != remoteControlVersion || root['type'] is! String) return null;
      final type = root['type'] as String;
      final sessionId = root['sessionId'];
      final sequence = root['sequence'];
      if (!_identifier(sessionId) || sequence is! num || !sequence.isFinite || sequence < 0 || sequence > 9007199254740991 || sequence.truncateToDouble() != sequence) return null;

      switch (type) {
        case 'remote-control:input':
          if (!_exactKeys(root, {'v', 'type', 'sessionId', 'sequence', 'event'}) || !_validInputEvent(root['event'])) return null;
          return ControlPacket(sessionId: sessionId as String, sequence: sequence.toInt(), command: InputCommand(Map<String, dynamic>.from(root['event'] as Map)));
        case 'remote-control:clipboard-copy':
          if (!_exactKeys(root, {'v', 'type', 'sessionId', 'sequence'})) return null;
          return ControlPacket(sessionId: sessionId as String, sequence: sequence.toInt(), command: const ClipboardCopyCommand());
        case 'remote-control:clipboard-paste':
          final text = root['text'];
          if (!_exactKeys(root, {'v', 'type', 'sessionId', 'sequence', 'text'}) || !isTransferableClipboardText(text)) return null;
          return ControlPacket(sessionId: sessionId as String, sequence: sequence.toInt(), command: ClipboardPasteCommand(text as String));
        default:
          return null;
      }
    } catch (_) {
      return null;
    }
  }

  static List<int> clipboardUpdate({required String sessionId, required int revision, required String text}) {
    if (!_identifier(sessionId) || revision < 0 || !isTransferableClipboardText(text)) throw ArgumentError('Invalid clipboard update');
    final bytes = utf8.encode(jsonEncode({'v': remoteControlVersion, 'type': 'remote-control:clipboard-update', 'sessionId': sessionId, 'revision': revision, 'text': text}));
    if (bytes.length > maximumControlPacketBytes) throw ArgumentError('Clipboard update exceeds the protocol limit');
    return bytes;
  }

  static bool isTransferableClipboardText(Object? text) => text is String && text.isNotEmpty && utf8.encode(text).length <= maximumClipboardTextBytes;

  static bool _validInputEvent(Object? value) {
    if (value is! Map || value['kind'] is! String) return false;
    final event = Map<String, dynamic>.from(value);
    final kind = event['kind'];
    bool point() => _coordinate(event['x']) && _coordinate(event['y']);
    switch (kind) {
      case 'move':
        return _exactKeys(event, {'kind', 'x', 'y'}) && point();
      case 'down':
      case 'up':
        return _exactKeys(event, {'kind', 'x', 'y', 'button'}) && point() && {'left', 'middle', 'right'}.contains(event['button']);
      case 'scroll':
        return _exactKeys(event, {'kind', 'x', 'y', 'dx', 'dy'}) && point() && _scroll(event['dx']) && _scroll(event['dy']);
      case 'key':
        final modifiers = event['modifiers'];
        final expectedKeys = event.containsKey('key') ? {'kind', 'action', 'key', 'code', 'modifiers'} : {'kind', 'action', 'code', 'modifiers'};
        return _exactKeys(event, expectedKeys) &&
            {'down', 'up'}.contains(event['action']) &&
            _supportedKeyboardCode(event['code']) &&
            (event['key'] == null || (event['key'] is String && (event['key'] as String).length <= 64)) &&
            modifiers is List && modifiers.length <= 4 && modifiers.toSet().length == modifiers.length && modifiers.every((value) => {'shift', 'ctrl', 'alt', 'meta'}.contains(value));
      case 'release-all':
        return _exactKeys(event, {'kind'});
      default:
        return false;
    }
  }

  static bool _coordinate(Object? value) => value is num && value.isFinite && value >= 0 && value <= 1;
  static bool _scroll(Object? value) => value is num && value.isFinite && value.abs() <= 2000;
  static bool _identifier(Object? value) => _bounded(value, 160) && RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(value as String);
  static bool _bounded(Object? value, int maximum) => value is String && value.isNotEmpty && value.length <= maximum;
  static bool _exactKeys(Map<String, dynamic> value, Set<String> keys) => value.keys.toSet().containsAll(keys) && keys.containsAll(value.keys);

  static bool _supportedKeyboardCode(Object? value) {
    if (!_bounded(value, 64)) return false;
    final code = value as String;
    if (RegExp(r'^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Numpad[0-9])$').hasMatch(code)) return true;
    return _namedKeyboardCodes.contains(code);
  }

  static const _namedKeyboardCodes = {
    'AltLeft',
    'AltRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'Backquote',
    'Backslash',
    'Backspace',
    'BracketLeft',
    'BracketRight',
    'CapsLock',
    'Comma',
    'ContextMenu',
    'ControlLeft',
    'ControlRight',
    'Delete',
    'End',
    'Enter',
    'Equal',
    'Escape',
    'Home',
    'Insert',
    'IntlBackslash',
    'MetaLeft',
    'MetaRight',
    'Minus',
    'NumLock',
    'NumpadAdd',
    'NumpadDecimal',
    'NumpadDivide',
    'NumpadEnter',
    'NumpadMultiply',
    'NumpadSubtract',
    'PageDown',
    'PageUp',
    'Pause',
    'Period',
    'PrintScreen',
    'Quote',
    'ScrollLock',
    'Semicolon',
    'ShiftLeft',
    'ShiftRight',
    'Slash',
    'Space',
    'Tab',
  };
}
