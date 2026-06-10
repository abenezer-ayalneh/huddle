import type { LocalParticipant } from "livekit-client";

// Remote Control protocol (see docs/adr/0010 and docs/REMOTE_CONTROL_PLAN.md).
// This schema is a contract across clients AND the Control Agent (Rust) —
// change only additively, or bump the version.

export const CONTROL_TOPIC = "huddle:control";
export const CONTROL_VERSION = 1 as const;

// The Control Agent joins as `agent:<presenterIdentity>` (hidden participant).
// The person remains the Presenter — these helpers map between the two.
export const AGENT_IDENTITY_PREFIX = "agent:";

export function isAgentIdentity(identity: string): boolean {
  return identity.startsWith(AGENT_IDENTITY_PREFIX);
}

export function agentIdentityFor(presenterIdentity: string): string {
  return AGENT_IDENTITY_PREFIX + presenterIdentity;
}

export function presenterIdentityFor(identity: string): string {
  return isAgentIdentity(identity) ? identity.slice(AGENT_IDENTITY_PREFIX.length) : identity;
}

export type MouseButton = "left" | "middle" | "right";
export type KeyModifier = "shift" | "ctrl" | "alt" | "meta";

// Pointer coordinates are normalized to [0,1] of the published track — the
// agent owns the mapping to monitor pixels (it knows origin, size, and DPI
// scale; the browser doesn't).
export type ControlInputEvent =
  | { kind: "move"; x: number; y: number }
  | { kind: "down"; x: number; y: number; button: MouseButton }
  | { kind: "up"; x: number; y: number; button: MouseButton }
  | { kind: "scroll"; x: number; y: number; dx: number; dy: number }
  | { kind: "key"; action: "down" | "up"; key: string; code: string; modifiers: KeyModifier[] };

export type ControlMessage =
  // Viewer asks the Presenter for control (decided in the Presenter's browser).
  | { v: 1; type: "control:request"; requesterId: string; requesterName: string }
  // Presenter proactively offers control to a chosen participant.
  | { v: 1; type: "control:offer" }
  // Offered viewer accepts; the Presenter's browser follows up with a grant.
  | { v: 1; type: "control:accept" }
  // Either side declines a pending request/offer.
  | { v: 1; type: "control:decline" }
  // Presenter's browser → agent + controller: this identity may control now.
  // A new grant implies revoking the previous controller first.
  | { v: 1; type: "control:grant"; controllerId: string; controllerName: string }
  // Presenter's browser → agent + controller: control ends now. Unconditional.
  | { v: 1; type: "control:revoke" }
  // Controller → agent + presenter: voluntarily giving control back.
  | { v: 1; type: "control:release" }
  // Presenter's browser → its agent: stop presenting (unpublish and leave).
  // Ends the presentation, which also ends any control session.
  | { v: 1; type: "control:stop-present" }
  // Controller → agent only.
  | { v: 1; type: "control:input"; event: ControlInputEvent }
  // Clipboard sync, both directions (controller ⇄ agent). Deliberately
  // unguarded in v1 — see docs/adr/0010 before "fixing" this.
  | { v: 1; type: "control:clipboard"; text: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeControl(msg: ControlMessage): Uint8Array {
  return encoder.encode(JSON.stringify(msg));
}

export function decodeControl(data: Uint8Array): ControlMessage | null {
  try {
    const msg = JSON.parse(decoder.decode(data)) as ControlMessage;
    if (msg.v !== CONTROL_VERSION || typeof msg.type !== "string" || !msg.type.startsWith("control:")) return null;
    return msg;
  } catch {
    return null;
  }
}

// Mouse moves are high-frequency and self-superseding — lossy. Everything
// else (clicks, keys, grants, clipboard) must arrive — reliable.
function isLossy(msg: ControlMessage): boolean {
  return msg.type === "control:input" && msg.event.kind === "move";
}

export function sendControlMessage(localParticipant: LocalParticipant, targets: string[], msg: ControlMessage): Promise<void> {
  return localParticipant.publishData(encodeControl(msg), {
    reliable: !isLossy(msg),
    topic: CONTROL_TOPIC,
    destinationIdentities: targets,
  });
}
