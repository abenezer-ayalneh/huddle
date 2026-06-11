// Protocol exerciser for the stub agent (slice 1 verification). Plays both
// sides of a Remote Control session against a running stub:
//   - "presenter" client: the browser of the human whose agent is presenting
//   - "viewer" client: another participant who becomes the Controller
// Drives grant → input → clipboard → revoke → stop-present and reports what
// each client observed, including whether the hidden agent's track is visible.
//
// Usage: node test-drive.mjs --room <slug> --identity <presenterIdentity>
// (the stub must already be in the room as agent:<presenterIdentity>)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room, RoomEvent } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';

const CONTROL_TOPIC = 'huddle:control';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return args;
}

function loadRootEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* env must already be set */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintToken(room, identity, name) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, name, ttl: '10m' });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
  return at.toJwt();
}

async function connect(label, room, token, url, observed) {
  const client = new Room();
  client.on(RoomEvent.ParticipantConnected, (p) => observed.push(`${label}: participant-connected ${p.identity}`));
  client.on(RoomEvent.ParticipantDisconnected, (p) => observed.push(`${label}: participant-disconnected ${p.identity}`));
  client.on(RoomEvent.TrackSubscribed, (_t, pub, p) => observed.push(`${label}: track-subscribed ${p.identity} ${pub.source ?? ''}`));
  client.on(RoomEvent.DataReceived, (payload, p, _k, topic) => {
    if (topic !== CONTROL_TOPIC) return;
    observed.push(`${label}: data ${decoder.decode(payload)} from ${p?.identity}`);
  });
  await client.connect(url, token, { autoSubscribe: true, dynacast: false });
  return client;
}

async function send(client, targets, msg) {
  await client.localParticipant.publishData(encoder.encode(JSON.stringify({ v: 1, ...msg })), {
    reliable: true,
    topic: CONTROL_TOPIC,
    destination_identities: targets,
    destinationIdentities: targets,
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.room || !args.identity) throw new Error('usage: --room <slug> --identity <presenterIdentity>');
  loadRootEnv();
  const url = process.env.LIVEKIT_URL || 'ws://localhost:7880';
  const agentId = `agent:${args.identity}`;
  const viewerId = 'viewer-ctrl-test';
  const observed = [];

  const presenter = await connect('presenter', args.room, await mintToken(args.room, args.identity, 'RC Tester'), url, observed);
  const viewer = await connect('viewer', args.room, await mintToken(args.room, viewerId, 'Viewer'), url, observed);
  console.log('both clients connected; settling…');
  await sleep(3000);

  // Agent visibility report (decides the hidden:true question empirically).
  const presenterSees = [...presenter.remoteParticipants.keys()];
  const viewerSees = [...viewer.remoteParticipants.keys()];
  console.log('presenter sees participants:', presenterSees);
  console.log('viewer sees participants:', viewerSees);

  // Negative: viewer tries to self-grant and to drive before any grant.
  await send(viewer, [agentId], { type: 'control:grant', controllerId: viewerId, controllerName: 'Viewer' });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'move', x: 0.5, y: 0.5 } });
  await sleep(500);

  // Real grant from the presenter's browser, then drive.
  await send(presenter, [agentId, viewerId], { type: 'control:grant', controllerId: viewerId, controllerName: 'Viewer' });
  await sleep(300);
  for (let i = 0; i < 30; i++) await send(viewer, [agentId], { type: 'control:input', event: { kind: 'move', x: i / 30, y: 0.4 } });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'down', x: 0.5, y: 0.4, button: 'left' } });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'up', x: 0.5, y: 0.4, button: 'left' } });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'key', action: 'down', key: 'a', code: 'KeyA', modifiers: ['meta'] } });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'key', action: 'up', key: 'a', code: 'KeyA', modifiers: [] } });
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'scroll', x: 0.5, y: 0.5, dx: 0, dy: 120 } });
  await send(viewer, [agentId], { type: 'control:clipboard', text: 'clip-from-controller' });
  console.log('granted + drove input; waiting for clipboard echoes…');
  await sleep(3000);

  // Revoke, then a post-revoke input that must be rejected.
  await send(presenter, [agentId, viewerId], { type: 'control:revoke' });
  await sleep(300);
  await send(viewer, [agentId], { type: 'control:input', event: { kind: 'move', x: 0.9, y: 0.9 } });
  await sleep(500);

  // Stop the presentation — the stub should unpublish and leave.
  await send(presenter, [agentId], { type: 'control:stop-present' });
  await sleep(2500);

  console.log('\n--- observations ---');
  for (const line of observed) console.log(line);

  const checks = {
    'agent visible to presenter': presenterSees.includes(agentId),
    'agent visible to viewer': viewerSees.includes(agentId),
    'agent screen track subscribed': observed.some((l) => l.includes('track-subscribed') && l.includes(agentId)),
    'viewer got clipboard push': observed.some((l) => l.startsWith('viewer: data') && l.includes("stub agent's clipboard")),
    'viewer got clipboard echo': observed.some((l) => l.startsWith('viewer: data') && l.includes('[stub echo] clip-from-controller')),
    'agent left after stop-present': observed.some((l) => l.includes(`participant-disconnected ${agentId}`)),
  };
  console.log('\n--- checks ---');
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);

  await presenter.disconnect();
  await viewer.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('test-drive failed:', err);
  process.exit(1);
});
