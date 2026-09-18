import { describe, expect, it } from 'vitest';
import sharedFixtures from '../../../../fixtures/control-protocol-v1.json';
import { decodeRemoteControlMessage, encodeRemoteControlMessage } from './controlProtocol';

describe('Remote Control protocol bounds', () => {
  it('round-trips a bounded withdrawal notice', () => {
    const message = { v: 2 as const, type: 'remote-control:withdrawn' as const, requestId: 'request-123' };
    expect(decodeRemoteControlMessage(encodeRemoteControlMessage(message))).toEqual(message);
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
