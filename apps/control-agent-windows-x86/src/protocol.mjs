export const REMOTE_CONTROL_TOPIC = 'huddle:remote-control';
export const REMOTE_CONTROL_VERSION = 1;
export const MAXIMUM_CONTROL_PACKET_BYTES = 8 * 1024;
export const MAXIMUM_CLIPBOARD_TEXT_BYTES = 6 * 1024;

const namedKeyboardCodes = new Set([
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
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isIdentifier(value, maximum = 160) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && /^[A-Za-z0-9_-]+$/.test(value);
}

function isCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isScrollDelta(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2_000;
}

function isKeyboardCode(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 64 &&
    (/^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Numpad[0-9])$/.test(value) || namedKeyboardCodes.has(value))
  );
}

export function validInputEvent(value) {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  const point = () => isCoordinate(value.x) && isCoordinate(value.y);
  switch (value.kind) {
    case 'move':
      return exactKeys(value, ['kind', 'x', 'y']) && point();
    case 'down':
    case 'up':
      return exactKeys(value, ['kind', 'x', 'y', 'button']) && point() && ['left', 'middle', 'right'].includes(value.button);
    case 'scroll':
      return exactKeys(value, ['kind', 'x', 'y', 'dx', 'dy']) && point() && isScrollDelta(value.dx) && isScrollDelta(value.dy);
    case 'key': {
      const expected = Object.hasOwn(value, 'key') ? ['kind', 'action', 'key', 'code', 'modifiers'] : ['kind', 'action', 'code', 'modifiers'];
      return (
        exactKeys(value, expected) &&
        ['down', 'up'].includes(value.action) &&
        isKeyboardCode(value.code) &&
        (value.key === undefined || (typeof value.key === 'string' && value.key.length <= 64)) &&
        Array.isArray(value.modifiers) &&
        value.modifiers.length <= 4 &&
        new Set(value.modifiers).size === value.modifiers.length &&
        value.modifiers.every((modifier) => ['shift', 'ctrl', 'alt', 'meta'].includes(modifier))
      );
    }
    case 'release-all':
      return exactKeys(value, ['kind']);
    default:
      return false;
  }
}

export function isTransferableClipboardText(value) {
  return typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).byteLength <= MAXIMUM_CLIPBOARD_TEXT_BYTES;
}

export function decodeControlPacket(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_CONTROL_PACKET_BYTES) return null;
  let root;
  try {
    root = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  if (!isRecord(root) || root.v !== REMOTE_CONTROL_VERSION || typeof root.type !== 'string' || !isIdentifier(root.sessionId)) return null;
  if (!Number.isSafeInteger(root.sequence) || root.sequence < 0) return null;

  if (root.type === 'remote-control:input') {
    if (!exactKeys(root, ['v', 'type', 'sessionId', 'sequence', 'event']) || !validInputEvent(root.event)) return null;
    return { sessionId: root.sessionId, sequence: root.sequence, command: { kind: 'input', event: root.event } };
  }
  if (root.type === 'remote-control:clipboard-copy') {
    if (!exactKeys(root, ['v', 'type', 'sessionId', 'sequence'])) return null;
    return { sessionId: root.sessionId, sequence: root.sequence, command: { kind: 'clipboard-copy' } };
  }
  if (root.type === 'remote-control:clipboard-paste') {
    if (!exactKeys(root, ['v', 'type', 'sessionId', 'sequence', 'text']) || !isTransferableClipboardText(root.text)) return null;
    return { sessionId: root.sessionId, sequence: root.sequence, command: { kind: 'clipboard-paste', text: root.text } };
  }
  return null;
}

export function encodeClipboardUpdate({ sessionId, revision, text }) {
  if (!isIdentifier(sessionId) || !Number.isSafeInteger(revision) || revision < 0 || !isTransferableClipboardText(text)) {
    throw new TypeError('Invalid clipboard update');
  }
  const bytes = new TextEncoder().encode(JSON.stringify({ v: REMOTE_CONTROL_VERSION, type: 'remote-control:clipboard-update', sessionId, revision, text }));
  if (bytes.byteLength > MAXIMUM_CONTROL_PACKET_BYTES) throw new TypeError('Clipboard update exceeds the protocol limit');
  return bytes;
}
