import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeControlPacket, encodeClipboardUpdate, isTransferableClipboardText, validInputEvent } from '../src/protocol.mjs';

const encode = (value) => new TextEncoder().encode(JSON.stringify(value));

test('accepts a bounded remote-control input packet', () => {
  const packet = decodeControlPacket(
    encode({ v: 1, type: 'remote-control:input', sessionId: 'session_123', sequence: 4, event: { kind: 'move', x: 0.5, y: 0.25 } }),
  );
  assert.deepEqual(packet, {
    sessionId: 'session_123',
    sequence: 4,
    command: { kind: 'input', event: { kind: 'move', x: 0.5, y: 0.25 } },
  });
});

test('rejects packets with extra keys, invalid coordinates, and replay-sized sequences', () => {
  assert.equal(
    decodeControlPacket(encode({ v: 1, type: 'remote-control:input', sessionId: 'session_123', sequence: 4, event: { kind: 'move', x: 1.1, y: 0 } })),
    null,
  );
  assert.equal(
    decodeControlPacket(encode({ v: 1, type: 'remote-control:clipboard-copy', sessionId: 'session_123', sequence: Number.MAX_SAFE_INTEGER + 1, extra: true })),
    null,
  );
  assert.equal(validInputEvent({ kind: 'release-all', extra: true }), false);
});

test('encodes only bounded plain-text clipboard updates', () => {
  const packet = JSON.parse(new TextDecoder().decode(encodeClipboardUpdate({ sessionId: 'session_123', revision: 2, text: 'hello' })));
  assert.equal(packet.type, 'remote-control:clipboard-update');
  assert.equal(isTransferableClipboardText(''), false);
  assert.equal(isTransferableClipboardText('x'.repeat(6_145)), false);
});
