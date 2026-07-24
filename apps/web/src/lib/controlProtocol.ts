import type { LocalParticipant, Participant } from 'livekit-client';

// Remote Control crosses the browser and the native Control Agent. Keep the
// schema additive within a version, and reject malformed/unbounded packets at
// the edge rather than casting JSON into a privileged input type.
export const REMOTE_CONTROL_TOPIC = 'huddle:remote-control';
export const REMOTE_CONTROL_VERSION = 1 as const;
export const CONTROL_AGENT_IDENTITY_PREFIX = 'control-agent:';

export const MAX_REMOTE_CONTROL_PACKET_BYTES = 8192;
// Keep text well below the packet ceiling so normal JSON framing fits without
// widening the established Remote Control data budget. The full encoded packet
// is still checked before it is published.
export const MAX_CLIPBOARD_TEXT_BYTES = 6 * 1024;
const MAX_ID_LENGTH = 160;
const MAX_NAME_LENGTH = 256;
const MAX_KEY_LENGTH = 64;
const MAX_CODE_LENGTH = 64;
const MAX_SCROLL_DELTA = 2000;

export type RemoteControlStatus = 'awaiting-agent' | 'active';

export type RemoteControlSession = {
  sessionId: string;
  status: RemoteControlStatus;
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  agentIdentity: string;
  agentConnected: boolean;
  renewalDueAt: string;
};

export type MouseButton = 'left' | 'middle' | 'right';
export type KeyModifier = 'shift' | 'ctrl' | 'alt' | 'meta';

export type RemoteControlInputEvent =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'down' | 'up'; x: number; y: number; button: MouseButton }
  | { kind: 'scroll'; x: number; y: number; dx: number; dy: number }
  | { kind: 'key'; action: 'down' | 'up'; code: string; key?: string; modifiers: KeyModifier[] }
  | { kind: 'release-all' };

export type RemoteControlMessage =
  | { v: 1; type: 'remote-control:request'; requestId: string }
  | { v: 1; type: 'remote-control:denied'; requestId: string }
  | { v: 1; type: 'remote-control:input'; sessionId: string; sequence: number; event: RemoteControlInputEvent }
  | { v: 1; type: 'remote-control:clipboard-copy'; sessionId: string; sequence: number }
  | { v: 1; type: 'remote-control:clipboard-paste'; sessionId: string; sequence: number; text: string }
  | { v: 1; type: 'remote-control:clipboard-update'; sessionId: string; revision: number; text: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedString(value: unknown, max = MAX_ID_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isClipboardText(value: unknown): value is string {
  return typeof value === 'string' && encoder.encode(value).byteLength > 0 && encoder.encode(value).byteLength <= MAX_CLIPBOARD_TEXT_BYTES;
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isScrollDelta(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_SCROLL_DELTA;
}

function isMouseButton(value: unknown): value is MouseButton {
  return value === 'left' || value === 'middle' || value === 'right';
}

function isModifiers(value: unknown): value is KeyModifier[] {
  if (!Array.isArray(value) || value.length > 4) return false;
  const allowed = new Set<KeyModifier>(['shift', 'ctrl', 'alt', 'meta']);
  const unique = new Set<KeyModifier>();
  for (const modifier of value) {
    if (typeof modifier !== 'string' || !allowed.has(modifier as KeyModifier) || unique.has(modifier as KeyModifier)) return false;
    unique.add(modifier as KeyModifier);
  }
  return true;
}

function decodeInputEvent(value: unknown): RemoteControlInputEvent | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;

  switch (value.kind) {
    case 'move':
      if (!hasOnlyKeys(value, ['kind', 'x', 'y']) || !isCoordinate(value.x) || !isCoordinate(value.y)) return null;
      return { kind: 'move', x: value.x, y: value.y };
    case 'down':
    case 'up':
      if (!hasOnlyKeys(value, ['kind', 'x', 'y', 'button']) || !isCoordinate(value.x) || !isCoordinate(value.y) || !isMouseButton(value.button)) return null;
      return { kind: value.kind, x: value.x, y: value.y, button: value.button };
    case 'scroll':
      if (
        !hasOnlyKeys(value, ['kind', 'x', 'y', 'dx', 'dy']) ||
        !isCoordinate(value.x) ||
        !isCoordinate(value.y) ||
        !isScrollDelta(value.dx) ||
        !isScrollDelta(value.dy)
      )
        return null;
      return { kind: 'scroll', x: value.x, y: value.y, dx: value.dx, dy: value.dy };
    case 'key':
      if (
        !hasOnlyKeys(value, ['kind', 'action', 'key', 'code', 'modifiers']) ||
        (value.action !== 'down' && value.action !== 'up') ||
        !isBoundedString(value.code, MAX_CODE_LENGTH) ||
        (value.key !== undefined && (typeof value.key !== 'string' || value.key.length > MAX_KEY_LENGTH)) ||
        !isModifiers(value.modifiers)
      )
        return null;
      return {
        kind: 'key',
        action: value.action,
        code: value.code,
        ...(typeof value.key === 'string' ? { key: value.key } : {}),
        modifiers: value.modifiers,
      };
    case 'release-all':
      return hasOnlyKeys(value, ['kind']) ? { kind: 'release-all' } : null;
    default:
      return null;
  }
}

export function encodeRemoteControlMessage(message: RemoteControlMessage): Uint8Array {
  const encoded = encoder.encode(JSON.stringify(message));
  if (encoded.byteLength === 0 || encoded.byteLength > MAX_REMOTE_CONTROL_PACKET_BYTES) throw new RangeError('Remote Control message exceeds the packet limit');
  return encoded;
}

export function decodeRemoteControlMessage(data: Uint8Array): RemoteControlMessage | null {
  if (data.byteLength === 0 || data.byteLength > MAX_REMOTE_CONTROL_PACKET_BYTES) return null;
  try {
    const value: unknown = JSON.parse(decoder.decode(data));
    if (!isRecord(value) || value.v !== REMOTE_CONTROL_VERSION || typeof value.type !== 'string') return null;

    switch (value.type) {
      case 'remote-control:request':
      case 'remote-control:denied':
        if (!hasOnlyKeys(value, ['v', 'type', 'requestId']) || !isBoundedString(value.requestId)) return null;
        return { v: 1, type: value.type, requestId: value.requestId };
      case 'remote-control:input': {
        if (!hasOnlyKeys(value, ['v', 'type', 'sessionId', 'sequence', 'event']) || !isBoundedString(value.sessionId) || !isSequence(value.sequence))
          return null;
        const event = decodeInputEvent(value.event);
        if (!event) return null;
        return { v: 1, type: 'remote-control:input', sessionId: value.sessionId, sequence: value.sequence, event };
      }
      case 'remote-control:clipboard-copy':
        if (!hasOnlyKeys(value, ['v', 'type', 'sessionId', 'sequence']) || !isBoundedString(value.sessionId) || !isSequence(value.sequence)) return null;
        return { v: 1, type: value.type, sessionId: value.sessionId, sequence: value.sequence };
      case 'remote-control:clipboard-paste':
        if (
          !hasOnlyKeys(value, ['v', 'type', 'sessionId', 'sequence', 'text']) ||
          !isBoundedString(value.sessionId) ||
          !isSequence(value.sequence) ||
          !isClipboardText(value.text)
        )
          return null;
        return { v: 1, type: value.type, sessionId: value.sessionId, sequence: value.sequence, text: value.text };
      case 'remote-control:clipboard-update':
        if (
          !hasOnlyKeys(value, ['v', 'type', 'sessionId', 'revision', 'text']) ||
          !isBoundedString(value.sessionId) ||
          !isSequence(value.revision) ||
          !isClipboardText(value.text)
        )
          return null;
        return { v: 1, type: value.type, sessionId: value.sessionId, revision: value.revision, text: value.text };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function isLossyRemoteControlMessage(message: RemoteControlMessage): boolean {
  return message.type === 'remote-control:input' && message.event.kind === 'move';
}

export function sendRemoteControlMessage(localParticipant: LocalParticipant, targets: string[], message: RemoteControlMessage): Promise<void> {
  return localParticipant.publishData(encodeRemoteControlMessage(message), {
    reliable: !isLossyRemoteControlMessage(message),
    topic: REMOTE_CONTROL_TOPIC,
    destinationIdentities: targets,
  });
}

export function isControlAgentIdentity(identity: string): boolean {
  return identity.startsWith(CONTROL_AGENT_IDENTITY_PREFIX);
}

function participantRole(metadata?: string): string | null {
  if (!metadata || metadata.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(metadata);
    if (!isRecord(value)) return null;
    return typeof value.role === 'string' ? value.role : null;
  } catch {
    return null;
  }
}

export function isControlAgentParticipant(participant: Pick<Participant, 'identity' | 'metadata'>, expectedAgentIdentity?: string | null): boolean {
  if (expectedAgentIdentity && participant.identity === expectedAgentIdentity) return true;
  return participantRole(participant.metadata) === 'control-agent' || isControlAgentIdentity(participant.identity);
}

export function parseRemoteControlSession(metadata?: string): RemoteControlSession | null {
  if (!metadata || metadata.length > 64_000) return null;
  try {
    const roomMetadata: unknown = JSON.parse(metadata);
    if (!isRecord(roomMetadata) || !isRecord(roomMetadata.remoteControl)) return null;
    const value = roomMetadata.remoteControl;
    if (
      !isBoundedString(value.sessionId) ||
      (value.status !== 'awaiting-agent' && value.status !== 'active') ||
      !isBoundedString(value.sharerIdentity) ||
      !isBoundedString(value.sharerName, MAX_NAME_LENGTH) ||
      !isBoundedString(value.controllerIdentity) ||
      !isBoundedString(value.controllerName, MAX_NAME_LENGTH) ||
      !isBoundedString(value.agentIdentity) ||
      typeof value.agentConnected !== 'boolean' ||
      !isBoundedString(value.renewalDueAt) ||
      !Number.isFinite(Date.parse(value.renewalDueAt))
    )
      return null;

    return {
      sessionId: value.sessionId,
      status: value.status,
      sharerIdentity: value.sharerIdentity,
      sharerName: value.sharerName,
      controllerIdentity: value.controllerIdentity,
      controllerName: value.controllerName,
      agentIdentity: value.agentIdentity,
      agentConnected: value.agentConnected,
      renewalDueAt: value.renewalDueAt,
    };
  } catch {
    return null;
  }
}
