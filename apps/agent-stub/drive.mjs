// Scripted Control session driver (verification harness, not shipped).
//
// Stands in for the two browsers in a remote-control session so the real Rust
// agent's INPUT INJECTION can be verified objectively:
//   - "alice" (the presenter) joins and sends control:grant naming the controller
//   - "bob" (the controller) joins and streams control:input mouse events
// The real agent (running as agent:alice) enforces both and injects into the OS.
//
// Usage:
//   node drive.mjs --room rc-e2e --presenter alice --controller bob \
//        --x 0.5 --y 0.5 --hold 4000 [--click] [--type "hello"]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';

const CONTROL_TOPIC = 'huddle:control';
const V = 1;
const AGENT_PREFIX = 'agent:';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const next = argv[i + 1];
      a[k.slice(2)] = next && !next.startsWith('--') ? next : 'true';
    }
  }
  return a;
}

function loadRootEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}

const enc = new TextEncoder();
const log = (...p) => console.log(new Date().toISOString().slice(11, 23), ...p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintJoin(room, identity) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const at = new AccessToken(key, secret, { identity, name: identity, ttl: '15m' });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  return at.toJwt();
}

async function connect(url, room, identity) {
  const r = new Room();
  await r.connect(url, await mintJoin(room, identity), { autoSubscribe: false, dynacast: false });
  log(`${identity} connected to "${r.name}"`);
  return r;
}

async function send(room, targets, msg) {
  const payload = enc.encode(JSON.stringify({ v: V, ...msg }));
  await room.localParticipant.publishData(payload, {
    reliable: true,
    topic: CONTROL_TOPIC,
    destination_identities: targets,
    destinationIdentities: targets,
  });
}

async function main() {
  loadRootEnv();
  const args = parseArgs(process.argv);
  const url = process.env.LIVEKIT_URL || 'ws://localhost:7880';
  const room = args.room || 'rc-e2e';
  const presenter = args.presenter || 'alice';
  const controller = args.controller || 'bob';
  const agent = AGENT_PREFIX + presenter;
  const x = parseFloat(args.x ?? '0.5');
  const y = parseFloat(args.y ?? '0.5');
  const hold = parseInt(args.hold ?? '4000', 10);

  const alice = await connect(url, room, presenter);
  const bob = await connect(url, room, controller);
  // Let the agent register both of us as participants before granting. In the
  // real product the presenter is long-present before granting; here both join
  // fresh, so a one-shot grant can land before the agent knows the sender.
  await sleep(2500);

  log(`GRANT: ${presenter} -> ${controller} (x3)`);
  for (let i = 0; i < 3; i++) {
    await send(alice, [agent, controller], { type: 'control:grant', controllerId: controller, controllerName: controller });
    await sleep(300);
  }
  await sleep(400); // let the agent record the grant before input

  log(`MOVE: streaming move(${x}, ${y}) for ${hold}ms as ${controller} -> ${agent}`);
  const start = Date.now();
  while (Date.now() - start < hold) {
    await send(bob, [agent], { type: 'control:input', event: { kind: 'move', x, y } });
    await sleep(100);
  }

  if (args.click === 'true') {
    log('CLICK: down+up at target');
    await send(bob, [agent], { type: 'control:input', event: { kind: 'down', x, y, button: 'left' } });
    await sleep(80);
    await send(bob, [agent], { type: 'control:input', event: { kind: 'up', x, y, button: 'left' } });
    await sleep(200);
  }

  if (args.type && args.type !== 'true') {
    log(`TYPE: "${args.type}"`);
    for (const ch of args.type) {
      const code = /[a-z]/i.test(ch) ? 'Key' + ch.toUpperCase() : ch === ' ' ? 'Space' : 'Unidentified';
      await send(bob, [agent], { type: 'control:input', event: { kind: 'key', action: 'down', key: ch, code, modifiers: [] } });
      await sleep(40);
      await send(bob, [agent], { type: 'control:input', event: { kind: 'key', action: 'up', key: ch, code, modifiers: [] } });
      await sleep(60);
    }
  }

  log('RELEASE + disconnect');
  await send(bob, [agent, presenter], { type: 'control:release' });
  await sleep(200);
  await alice.disconnect();
  await bob.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('drive failed:', e);
  process.exit(1);
});
