import assert from 'node:assert/strict';
import test from 'node:test';

import { GrantGate, parseAgentTokenMetadata, parseBootstrapLink, parseRemoteControlProjection, supportsWindowsBuild } from '../src/agent.mjs';

const bootstrap = {
  sessionId: 'session_123',
  sharerIdentity: 'sharer',
  controllerIdentity: 'controller',
  agentIdentity: 'control-agent:session_123',
  renewalDueAt: new Date('2030-01-01T00:00:00.000Z'),
};

const projection = {
  ...bootstrap,
  status: 'active',
  agentConnected: true,
  renewalDueAt: new Date('2030-01-01T00:10:00.000Z'),
};

const tokenMetadata = {
  role: 'control-agent',
  room: 'room_123',
  ...bootstrap,
};

test('accepts only an exact, HTTPS bootstrap link', () => {
  const result = parseBootstrapLink('huddle-control://join?api=https%3A%2F%2Fmeet.example.test&room=room_123&session=session_123&code=code_12345678');
  assert.equal(result.apiOrigin, 'https://meet.example.test');
  assert.throws(
    () => parseBootstrapLink('huddle-control://join?api=http%3A%2F%2Fmeet.example.test&room=room_123&session=session_123&code=code_12345678'),
    /HTTPS/,
  );
});

test('requires matching signed-token metadata, room projection, sender, and sequence', () => {
  const gate = new GrantGate({ room: 'room_123', bootstrap });
  const packet = { sessionId: 'session_123', sequence: 1 };
  const base = {
    packet,
    senderIdentity: 'controller',
    tokenMetadata,
    localAgentIdentity: bootstrap.agentIdentity,
    projection,
    connected: true,
    now: new Date('2029-01-01T00:00:00.000Z'),
  };
  assert.equal(gate.authorize(base), null);
  assert.equal(gate.authorize(base), 'replayed-sequence');
  assert.equal(gate.authorize({ ...base, packet: { ...packet, sequence: 2 }, senderIdentity: 'attacker' }), 'wrong-sender');
});

test('parses bounded token and room metadata and preserves the Windows 10 22H2 floor', () => {
  const metadata = { role: 'control-agent', room: 'room_123', ...bootstrap };
  const payload = Buffer.from(JSON.stringify({ metadata: JSON.stringify(metadata) })).toString('base64url');
  assert.equal(parseAgentTokenMetadata(`header.${payload}.signature`)?.agentIdentity, bootstrap.agentIdentity);
  assert.equal(parseRemoteControlProjection(JSON.stringify({ remoteControl: projection }))?.controllerIdentity, 'controller');
  assert.equal(supportsWindowsBuild('10.0.19045'), true);
  assert.equal(supportsWindowsBuild('10.0.19044'), false);
});
