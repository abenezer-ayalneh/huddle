function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, key, maximum = 512) {
  const candidate = value?.[key];
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > maximum) {
    throw new TypeError('Invalid Control Agent response');
  }
  return candidate;
}

function requiredIdentifier(value, key, maximum = 160) {
  const candidate = requiredString(value, key, maximum);
  if (!/^[A-Za-z0-9_-]+$/.test(candidate)) throw new TypeError('Invalid Control Agent response');
  return candidate;
}

function parseDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new TypeError('Invalid Control Agent response');
  return parsed;
}

function decodeBase64Url(value) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function localHttpOrigin(url) {
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
}

export function parseBootstrapLink(raw) {
  let link;
  try {
    link = new URL(raw);
  } catch {
    throw new TypeError('The Control Agent link is invalid or expired.');
  }
  if (
    link.protocol !== 'huddle-control:' ||
    link.hostname.toLowerCase() !== 'join' ||
    (link.pathname && link.pathname !== '/') ||
    link.hash ||
    link.username ||
    link.password
  ) {
    throw new TypeError('The Control Agent link is invalid or expired.');
  }
  const keys = ['api', 'room', 'session', 'code'];
  if ([...link.searchParams.keys()].length !== keys.length || keys.some((key) => link.searchParams.getAll(key).length !== 1)) {
    throw new TypeError('The Control Agent link is invalid or expired.');
  }
  let api;
  try {
    api = new URL(link.searchParams.get('api'));
  } catch {
    throw new TypeError('The API address is invalid.');
  }
  if (api.username || api.password || api.hash || api.search || (api.protocol !== 'https:' && !localHttpOrigin(api))) {
    throw new TypeError('The API address must use HTTPS (or localhost for development).');
  }
  const room = link.searchParams.get('room');
  const sessionId = link.searchParams.get('session');
  const bootstrapCode = link.searchParams.get('code');
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(room ?? '') || !/^[A-Za-z0-9_-]{1,160}$/.test(sessionId ?? '') || !/^[A-Za-z0-9_-]{8,512}$/.test(bootstrapCode ?? '')) {
    throw new TypeError('The bootstrap code is invalid or expired.');
  }
  return { apiOrigin: api.origin, room, sessionId, bootstrapCode };
}

export function normalizeApiOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !localHttpOrigin(url)) throw new TypeError('Invalid Control Agent server');
  return url.origin;
}

export function parseBootstrapResponse(value) {
  if (!isRecord(value)) throw new TypeError('Invalid Control Agent response');
  const session = value.session;
  if (!isRecord(session)) throw new TypeError('Invalid Control Agent response');
  return {
    token: requiredString(value, 'token', 16_384),
    livekitUrl: requiredString(value, 'livekitUrl', 2_048),
    room: requiredIdentifier(value, 'room'),
    session: {
      sessionId: requiredIdentifier(session, 'sessionId'),
      sharerIdentity: requiredString(session, 'sharerIdentity'),
      sharerName: requiredString(session, 'sharerName'),
      controllerIdentity: requiredString(session, 'controllerIdentity'),
      controllerName: requiredString(session, 'controllerName'),
      agentIdentity: requiredString(session, 'agentIdentity'),
      status: requiredString(session, 'status'),
      agentConnected: session.agentConnected === true,
      renewalDueAt: parseDate(requiredString(session, 'renewalDueAt')),
    },
  };
}

export function parseAgentTokenMetadata(token) {
  const sections = token.split('.');
  if (sections.length !== 3) return null;
  try {
    const text = decodeBase64Url(sections[1]);
    const root = JSON.parse(text);
    if (!isRecord(root) || typeof root.metadata !== 'string' || root.metadata.length > 2_048) return null;
    const metadata = JSON.parse(root.metadata);
    if (!isRecord(metadata)) return null;
    return {
      role: requiredString(metadata, 'role'),
      room: requiredIdentifier(metadata, 'room'),
      sessionId: requiredIdentifier(metadata, 'sessionId'),
      sharerIdentity: requiredString(metadata, 'sharerIdentity'),
      controllerIdentity: requiredString(metadata, 'controllerIdentity'),
      agentIdentity: requiredString(metadata, 'agentIdentity'),
    };
  } catch {
    return null;
  }
}

export function parseRemoteControlProjection(metadata) {
  if (typeof metadata !== 'string' || metadata.length > 64_000) return null;
  try {
    const root = JSON.parse(metadata);
    if (!isRecord(root) || !isRecord(root.remoteControl)) return null;
    const session = root.remoteControl;
    return {
      sessionId: requiredIdentifier(session, 'sessionId'),
      status: requiredString(session, 'status'),
      sharerIdentity: requiredString(session, 'sharerIdentity'),
      controllerIdentity: requiredString(session, 'controllerIdentity'),
      agentIdentity: requiredString(session, 'agentIdentity'),
      agentConnected: session.agentConnected === true,
      renewalDueAt: parseDate(requiredString(session, 'renewalDueAt')),
    };
  } catch {
    return null;
  }
}

export class GrantGate {
  constructor({ room, bootstrap }) {
    this.room = room;
    this.bootstrap = bootstrap;
    this.lastSequence = null;
  }

  canPublishDesktop({ tokenMetadata, localAgentIdentity, projection, now = new Date() }) {
    return this.#matchesToken(tokenMetadata, localAgentIdentity) && this.#activeProjection(projection, now);
  }

  authorize({ packet, senderIdentity, tokenMetadata, localAgentIdentity, projection, connected, now = new Date() }) {
    if (!connected) return 'disconnected';
    if (!this.#matchesToken(tokenMetadata, localAgentIdentity)) return 'token-metadata-mismatch';
    if (!projection) return 'room-metadata-missing';
    if (!this.#projectionMatches(projection)) return 'room-metadata-mismatch';
    if (projection.status !== 'active' || !projection.agentConnected) return 'inactive';
    if (projection.renewalDueAt <= now || this.bootstrap.renewalDueAt > projection.renewalDueAt) return 'expired';
    if (packet.sessionId !== this.bootstrap.sessionId) return 'wrong-session';
    if (senderIdentity !== this.bootstrap.controllerIdentity) return 'wrong-sender';
    if (this.lastSequence !== null && packet.sequence <= this.lastSequence) return 'replayed-sequence';
    this.lastSequence = packet.sequence;
    return null;
  }

  resetSequence() {
    this.lastSequence = null;
  }

  #matchesToken(metadata, identity) {
    return (
      metadata?.role === 'control-agent' &&
      metadata.room === this.room &&
      metadata.sessionId === this.bootstrap.sessionId &&
      metadata.sharerIdentity === this.bootstrap.sharerIdentity &&
      metadata.controllerIdentity === this.bootstrap.controllerIdentity &&
      metadata.agentIdentity === this.bootstrap.agentIdentity &&
      identity === this.bootstrap.agentIdentity
    );
  }

  #projectionMatches(projection) {
    return (
      projection.sessionId === this.bootstrap.sessionId &&
      projection.sharerIdentity === this.bootstrap.sharerIdentity &&
      projection.controllerIdentity === this.bootstrap.controllerIdentity &&
      projection.agentIdentity === this.bootstrap.agentIdentity
    );
  }

  #activeProjection(projection, now) {
    return this.#projectionMatches(projection ?? {}) && projection.status === 'active' && projection.agentConnected && projection.renewalDueAt > now;
  }
}

export function supportsWindowsBuild(value) {
  const parts = String(value)
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  return parts.length >= 3 && parts.every(Number.isInteger) && (parts[0] > 10 || (parts[0] === 10 && parts[1] === 0 && parts[2] >= 19_045));
}
