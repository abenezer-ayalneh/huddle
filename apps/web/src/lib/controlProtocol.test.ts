import { describe, expect, it } from 'vitest';
import sharedFixtures from '../../../../fixtures/control-protocol-v1.json';
import { decodeRemoteControlMessage, encodeRemoteControlMessage } from './controlProtocol';

describe('remote-control:agent-unavailable', () => {
  it('round-trips a bounded session notice', () => {
    const message = { v: 1 as const, type: 'remote-control:agent-unavailable' as const, sessionId: 'session-123' };
    expect(decodeRemoteControlMessage(encodeRemoteControlMessage(message))).toEqual(message);
  });

  it('rejects extra fields and malformed session ids', () => {
    const extra = new TextEncoder().encode(JSON.stringify({ v: 1, type: 'remote-control:agent-unavailable', sessionId: 'session-123', reason: 'missing' }));
    const empty = new TextEncoder().encode(JSON.stringify({ v: 1, type: 'remote-control:agent-unavailable', sessionId: '' }));
    expect(decodeRemoteControlMessage(extra)).toBeNull();
    expect(decodeRemoteControlMessage(empty)).toBeNull();
  });

  it('rejects packets over the shared data-message budget', () => {
    expect(decodeRemoteControlMessage(new Uint8Array(8193))).toBeNull();
  });
});

describe('shared Control Agent v1 fixtures', () => {
  it('keeps the browser decoder aligned with the native agents', () => {
    for (const fixture of sharedFixtures.packets) {
      const decoded = decodeRemoteControlMessage(new TextEncoder().encode(JSON.stringify(fixture.payload)));
      expect(decoded === null, fixture.name).toBe(!fixture.valid);
    }
  });
});
