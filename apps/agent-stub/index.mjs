// Stub Control Agent (docs/REMOTE_CONTROL_PLAN.md, slice 1).
//
// Behaves like the real desktop agent at the protocol level: joins the room
// as `agent:<presenterIdentity>`, publishes a synthetic video track as the
// screen share, enforces who may grant and who may control, logs control
// input, and echoes clipboard messages. It injects nothing — it exists so the
// whole browser side can be exercised before any Rust is written.
//
// Usage (pairing-code flow, same path the real agent takes):
//   node index.mjs --code <code> [--api http://localhost:3001]
//
// Usage (hand-minted, no API needed — reads LIVEKIT_* from env or root .env):
//   node index.mjs --room <slug> --identity <presenterIdentity> [--name <display name>]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalVideoTrack, Room, RoomEvent, TrackPublishOptions, TrackSource, VideoBufferType, VideoFrame, VideoSource } from "@livekit/rtc-node";

const CONTROL_TOPIC = "huddle:control";
const CONTROL_VERSION = 1;
const AGENT_PREFIX = "agent:";
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 10;

// --- CLI / config ----------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) args[key.slice(2)] = argv[i + 1] ?? "";
  }
  return args;
}

// Best-effort read of the repo root .env so hand-minted mode works without
// exporting anything (mirrors how docker compose is fed).
function loadRootEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env — env vars must already be set
  }
}

async function resolveConnection(args) {
  if (args.code) {
    const api = args.api || "http://localhost:3001";
    const res = await fetch(`${api}/control-agent/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: args.code }),
    });
    if (!res.ok) throw new Error(`redeem failed: ${res.status} ${await res.text()}`);
    const out = await res.json();
    return { token: out.token, url: out.livekitUrl, presenter: out.presenterIdentity };
  }

  if (args.room && args.identity) {
    loadRootEnv();
    const { AccessToken, TrackSource: ServerTrackSource } = await import("livekit-server-sdk");
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL || "ws://localhost:7880";
    if (!key || !secret) throw new Error("LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set");
    const at = new AccessToken(key, secret, {
      identity: AGENT_PREFIX + args.identity,
      name: args.name || args.identity,
      ttl: "10m",
      metadata: JSON.stringify({ role: "agent", presenter: args.identity }),
    });
    // Not hidden: LiveKit suppresses a hidden participant's tracks too — the
    // UI hides agents by identity prefix instead (see LivekitService).
    at.addGrant({
      roomJoin: true,
      room: args.room,
      canPublish: true,
      canPublishSources: [ServerTrackSource.SCREEN_SHARE, ServerTrackSource.SCREEN_SHARE_AUDIO],
      canPublishData: true,
      canSubscribe: false,
    });
    return { token: await at.toJwt(), url, presenter: args.identity };
  }

  throw new Error("usage: --code <code> [--api url]  |  --room <slug> --identity <presenter> [--name <n>]");
}

// --- Synthetic "screen" -----------------------------------------------------

// Animated test pattern: drifting two-tone gradient plus a bright sweeping
// bar, so motion (and freezes) are obvious in the call.
function paintFrame(buffer, tick) {
  const barX = Math.floor((((tick * 7) % WIDTH) + WIDTH) % WIDTH);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const inBar = Math.abs(x - barX) < 24;
      buffer[i] = inBar ? 255 : (x + tick * 2) % 256; // R
      buffer[i + 1] = inBar ? 0 : (y + tick) % 256; // G
      buffer[i + 2] = inBar ? 200 : 160; // B
      buffer[i + 3] = 255; // A
    }
  }
}

// --- Protocol ---------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function log(...parts) {
  console.log(new Date().toISOString().slice(11, 23), ...parts);
}

async function main() {
  const args = parseArgs(process.argv);
  const { token, url, presenter } = await resolveConnection(args);
  const agentIdentity = AGENT_PREFIX + presenter;

  log(`connecting to ${url} as ${agentIdentity} (presenter: ${presenter})`);
  const room = new Room();
  await room.connect(url, token, { autoSubscribe: false, dynacast: false });
  log(`connected to room "${room.name}"`);

  // Publish the fake screen.
  const source = new VideoSource(WIDTH, HEIGHT);
  const track = LocalVideoTrack.createVideoTrack("screen", source);
  const publishOptions = new TrackPublishOptions({ source: TrackSource.SOURCE_SCREENSHARE });
  await room.localParticipant.publishTrack(track, publishOptions);
  log(`publishing synthetic ${WIDTH}x${HEIGHT}@${FPS} screen-share track`);

  const buffer = new Uint8Array(WIDTH * HEIGHT * 4);
  let tick = 0;
  const frameTimer = setInterval(() => {
    paintFrame(buffer, tick++);
    source.captureFrame(new VideoFrame(buffer, WIDTH, HEIGHT, VideoBufferType.RGBA));
  }, 1000 / FPS);

  // Session state: who may drive right now. The agent is the enforcement
  // point — identity comes from the SFU's sender attestation per message.
  let controllerId = null;
  let moveCount = 0;
  let lastMoveLog = 0;

  async function send(targets, msg) {
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({ v: CONTROL_VERSION, ...msg })), {
      reliable: true,
      topic: CONTROL_TOPIC,
      destination_identities: targets,
      destinationIdentities: targets,
    });
  }

  async function shutdown(reason) {
    log(`shutting down: ${reason}`);
    clearInterval(frameTimer);
    try {
      await room.disconnect();
    } finally {
      process.exit(0);
    }
  }

  room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    if (topic !== CONTROL_TOPIC || !participant) return;
    let msg;
    try {
      msg = JSON.parse(decoder.decode(payload));
    } catch {
      return;
    }
    if (msg.v !== CONTROL_VERSION) return;
    const sender = participant.identity;

    switch (msg.type) {
      // Only my own presenter's browser may steer the session.
      case "control:grant":
        if (sender !== presenter) return log(`REJECTED grant from non-presenter ${sender}`);
        controllerId = msg.controllerId;
        log(`GRANT: ${msg.controllerName} (${controllerId}) now controls`);
        // Simulate the controlled machine's clipboard arriving (the real
        // agent watches the OS clipboard) — exercises agent→controller sync.
        setTimeout(() => {
          if (controllerId) {
            void send([controllerId], { type: "control:clipboard", text: "hello from the stub agent's clipboard" });
          }
        }, 2000);
        break;

      case "control:revoke":
        if (sender !== presenter) return log(`REJECTED revoke from non-presenter ${sender}`);
        log(`REVOKE: ${controllerId} no longer controls`);
        controllerId = null;
        break;

      case "control:stop-present":
        if (sender !== presenter) return log(`REJECTED stop-present from non-presenter ${sender}`);
        void shutdown("presenter stopped the share");
        break;

      case "control:release":
        if (sender !== controllerId) return log(`REJECTED release from non-controller ${sender}`);
        log(`RELEASE: ${controllerId} gave control back`);
        controllerId = null;
        break;

      case "control:input": {
        if (sender !== controllerId) return log(`REJECTED input from non-controller ${sender}`);
        const e = msg.event;
        if (e.kind === "move") {
          // The real agent injects every move; logging each would flood.
          moveCount++;
          const now = Date.now();
          if (now - lastMoveLog > 1000) {
            log(`input: ${moveCount} moves/s, last at (${e.x.toFixed(3)}, ${e.y.toFixed(3)})`);
            moveCount = 0;
            lastMoveLog = now;
          }
        } else if (e.kind === "key") {
          log(`input: key ${e.action} ${e.key} [${e.code}] mods=${e.modifiers.join("+") || "none"}`);
        } else if (e.kind === "scroll") {
          log(`input: scroll (${e.dx.toFixed(0)}, ${e.dy.toFixed(0)}) at (${e.x.toFixed(3)}, ${e.y.toFixed(3)})`);
        } else {
          log(`input: ${e.kind} ${e.button} at (${e.x.toFixed(3)}, ${e.y.toFixed(3)})`);
        }
        break;
      }

      case "control:clipboard":
        if (sender !== controllerId) return log(`REJECTED clipboard from non-controller ${sender}`);
        log(`clipboard from controller: ${JSON.stringify(msg.text).slice(0, 80)}`);
        // Echo back so the controller-side write path is observable too.
        void send([sender], { type: "control:clipboard", text: `[stub echo] ${msg.text}` });
        break;

      default:
        log(`(ignored ${msg.type} from ${sender})`);
    }
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    if (participant.identity === presenter) {
      void shutdown("presenter left the room");
    }
    if (participant.identity === controllerId) {
      log(`controller ${controllerId} disconnected — control ends`);
      controllerId = null;
    }
  });

  room.on(RoomEvent.Disconnected, () => {
    log("disconnected from room");
    clearInterval(frameTimer);
    process.exit(0);
  });

  process.on("SIGINT", () => void shutdown("SIGINT"));
  log("ready — waiting for control messages");
}

main().catch((err) => {
  console.error("stub agent failed:", err);
  process.exit(1);
});
