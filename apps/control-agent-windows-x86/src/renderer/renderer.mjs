import { Room, RoomEvent } from 'livekit-client';

import {
  GrantGate,
  normalizeApiOrigin,
  parseAgentTokenMetadata,
  parseBootstrapLink,
  parseBootstrapResponse,
  parseRemoteControlProjection,
  supportsWindowsBuild,
} from '../agent.mjs';
import { MAXIMUM_CLIPBOARD_TEXT_BYTES, REMOTE_CONTROL_TOPIC, decodeControlPacket, encodeClipboardUpdate, isTransferableClipboardText } from '../protocol.mjs';
import { checkRelease } from '../release.mjs';

const APP_VERSION = __WINDOWS_CONTROL_AGENT_VERSION__;
const RELEASE_CHANNEL_URL = __WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL__;
const UPDATE_PUBLIC_KEY = __WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY__;
const trustedOriginsKey = 'trusted-api-origins-v1';
const api = window.controlAgent;

const Phase = Object.freeze({
  WAITING: 'waiting',
  TRUST: 'trust',
  READY: 'ready',
  CONNECTING: 'connecting',
  CHOOSE_DISPLAY: 'choose-display',
  AWAITING_ACTIVATION: 'awaiting-activation',
  READY_TO_START: 'ready-to-start',
  ACTIVE: 'active',
  SWITCHING: 'switching',
  ENDED: 'ended',
  FAILED: 'failed',
});

function apiOrigins() {
  try {
    const parsed = JSON.parse(localStorage.getItem(trustedOriginsKey) ?? '[]');
    return Array.isArray(parsed) && parsed.every((value) => typeof value === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function isTrusted(origin) {
  return apiOrigins().includes(origin);
}

function trust(origin) {
  const next = [...new Set([...apiOrigins().filter((value) => value !== origin), origin])];
  localStorage.setItem(trustedOriginsKey, JSON.stringify(next));
}

function activePhase(phase) {
  return phase === Phase.ACTIVE || phase === Phase.SWITCHING;
}

function phaseTitle(phase) {
  return {
    [Phase.WAITING]: 'Open an approved Remote Control link',
    [Phase.TRUST]: 'Trust this Huddle server',
    [Phase.READY]: 'Prepare for attended control',
    [Phase.CONNECTING]: 'Connecting safely',
    [Phase.CHOOSE_DISPLAY]: 'Select a display',
    [Phase.AWAITING_ACTIVATION]: 'Waiting for the room grant',
    [Phase.READY_TO_START]: 'Start when you are ready',
    [Phase.ACTIVE]: 'Remote Control is active',
    [Phase.SWITCHING]: 'Switching display',
    [Phase.ENDED]: 'Remote Control ended',
    [Phase.FAILED]: 'This link needs attention',
  }[phase];
}

function phaseDescription(phase) {
  return {
    [Phase.WAITING]: 'The Sharer starts inside an active Huddle room. Paste the full one-time link if the browser could not open this app.',
    [Phase.TRUST]: 'The link names a Huddle server this computer has not trusted yet.',
    [Phase.READY]: 'The browser call remains the meeting. This companion shares one display and applies only approved input.',
    [Phase.CONNECTING]: 'The one-time code is being redeemed. It is never saved to disk.',
    [Phase.CHOOSE_DISPLAY]: 'Choose the display locally, then explicitly start the attended session.',
    [Phase.AWAITING_ACTIVATION]: 'The agent is connected but the room must report the attended grant before a display can be published.',
    [Phase.READY_TO_START]: 'The connected Controller can use only the display you select and explicitly start.',
    [Phase.ACTIVE]: 'Input and clipboard sharing stop immediately if the grant, room, display, or local Windows session ends.',
    [Phase.SWITCHING]: 'Input is released while the display changes.',
    [Phase.ENDED]: 'The agent disconnected and released all held input.',
    [Phase.FAILED]: 'Correct the link or use the browser room to issue a fresh approved link.',
  }[phase];
}

class ElectronControlAgent {
  constructor() {
    this.phase = Phase.WAITING;
    this.error = null;
    this.descriptor = null;
    this.rawLink = null;
    this.response = null;
    this.gate = null;
    this.projection = null;
    this.room = null;
    this.display = null;
    this.displayOptions = [];
    this.elevated = false;
    this.elevatedLinkAccepted = false;
    this.releaseStatus = null;
    this.inputDispatch = Promise.resolve();
    this.clipboardTimer = null;
    this.lifecycleTimer = null;
    this.clipboardChangeCount = 0;
    this.expectedClipboardChangeCount = null;
    this.clipboardRevision = 0;
    this.clipboardSyncInFlight = false;
    this.lifecycleCheckInFlight = false;
    this.stopping = false;
  }

  async initialize(link) {
    await api.configureDpiAwareness();
    this.elevated = await api.isElevated();
    if (!supportsWindowsBuild(await api.windowsVersion())) {
      this.fail('Huddle Control Agent requires Windows 10 22H2 or Windows 11 on a 64-bit PC.');
      return;
    }
    await api.acknowledgeDisplayChange();
    if (link) this.acceptLink(link);
    else this.render();
  }

  acceptLink(raw) {
    if (this.elevated && this.elevatedLinkAccepted) {
      this.fail('This elevated Control Agent accepts one launch link only. Close it and obtain a fresh browser approval.');
      return;
    }
    try {
      const descriptor = parseBootstrapLink(raw);
      this.rawLink = raw;
      this.descriptor = descriptor;
      this.error = null;
      this.phase = isTrusted(descriptor.apiOrigin) ? Phase.READY : Phase.TRUST;
      if (this.elevated) this.elevatedLinkAccepted = true;
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'The Control Agent link is invalid or expired.');
    }
    this.render();
  }

  trustServer() {
    if (!this.descriptor) return;
    trust(normalizeApiOrigin(this.descriptor.apiOrigin));
    this.phase = Phase.READY;
    this.render();
  }

  async restartElevated() {
    if (!this.descriptor || this.room) return;
    const { apiOrigin, room, sessionId, bootstrapCode } = this.descriptor;
    const link = `huddle-control://join?api=${encodeURIComponent(apiOrigin)}&room=${encodeURIComponent(room)}&session=${encodeURIComponent(sessionId)}&code=${encodeURIComponent(bootstrapCode)}`;
    await api.restartElevated(link);
    window.close();
  }

  async connect() {
    if (!this.descriptor || this.phase !== Phase.READY) return;
    this.phase = Phase.CONNECTING;
    this.error = null;
    this.render();
    try {
      this.releaseStatus = await checkRelease({
        currentVersion: APP_VERSION,
        currentWindows: await api.windowsVersion(),
        channelUrl: RELEASE_CHANNEL_URL,
        publicKey: UPDATE_PUBLIC_KEY,
        verify: api.verifyReleaseManifest,
      });
      if (this.releaseStatus.blocking) throw new Error('required-update');
      if (this.releaseStatus.unsupportedWindows) throw new Error('unsupported-windows');
      if (this.releaseStatus.missingNativeArchitecture) throw new Error('missing-native-architecture');
      const response = await this.redeem(this.descriptor);
      if (response.room !== this.descriptor.room || response.session.sessionId !== this.descriptor.sessionId) {
        throw new TypeError('The server returned a session that does not match this link.');
      }
      const tokenMetadata = parseAgentTokenMetadata(response.token);
      if (
        !tokenMetadata ||
        tokenMetadata.room !== response.room ||
        tokenMetadata.sessionId !== response.session.sessionId ||
        tokenMetadata.agentIdentity !== response.session.agentIdentity
      ) {
        throw new TypeError('The server returned an invalid Control Agent token.');
      }
      this.response = response;
      this.gate = new GrantGate({ room: this.descriptor.room, bootstrap: response.session });
      const room = new Room({ adaptiveStream: false, dynacast: false });
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic === REMOTE_CONTROL_TOPIC && participant) this.enqueuePacket({ payload, senderIdentity: participant.identity });
      });
      room.on(RoomEvent.RoomMetadataChanged, (metadata) => this.receiveMetadata(metadata));
      room.on(RoomEvent.Disconnected, () => void this.stop());
      await room.connect(response.livekitUrl, response.token);
      this.room = room;
      this.projection = parseRemoteControlProjection(room.metadata);
      this.phase = Phase.CHOOSE_DISPLAY;
      this.startLifecycleMonitor();
    } catch (error) {
      await this.cleanupTransport();
      if (error instanceof Error && error.message === 'required-update') {
        this.fail('This Control Agent version is no longer supported. Install the required update from Huddle Downloads before starting a new session.');
      } else if (error instanceof Error && error.message === 'unsupported-windows') {
        this.fail('This Windows version does not meet the current Control Agent release requirement. Update Windows before starting a new session.');
      } else if (error instanceof Error && error.message === 'missing-native-architecture') {
        this.fail('The configured Control Agent release has no installer for 32-bit Windows. Install the matching current beta from Huddle Downloads.');
      } else {
        this.fail('The Control Agent could not connect. The approved link may have expired or the Huddle server is unavailable.');
      }
    }
    this.render();
  }

  async listDisplays() {
    if (!this.room || activePhase(this.phase)) return;
    try {
      this.displayOptions = await api.listDisplays();
      this.error = null;
    } catch {
      this.error = 'Windows could not enumerate displays. Try again.';
    }
    this.render();
  }

  async chooseDisplay(sourceId) {
    if (!this.room || activePhase(this.phase)) return;
    const display = this.displayOptions.find((option) => option.id === sourceId);
    if (!display) return;
    try {
      await api.setCaptureSource(sourceId);
      this.display = display;
      this.error = null;
      this.phase = this.canPublishNow() ? Phase.READY_TO_START : Phase.AWAITING_ACTIVATION;
    } catch {
      this.error = 'Windows could not map that display. Select it again.';
    }
    this.render();
  }

  async start() {
    if (!this.display || !this.canPublishNow() || !this.room) return;
    this.phase = Phase.SWITCHING;
    this.render();
    try {
      await this.room.localParticipant.setScreenShareEnabled(true, {
        audio: false,
        video: { displaySurface: 'monitor' },
        resolution: { width: 1920, height: 1080, frameRate: 15 },
        selfBrowserSurface: 'exclude',
        systemAudio: 'exclude',
      });
      this.clipboardChangeCount = await api.clipboardChangeCount();
      this.expectedClipboardChangeCount = null;
      this.startClipboardMonitor();
      this.phase = Phase.ACTIVE;
    } catch {
      await api.releaseAll();
      await this.unpublishDisplay();
      this.phase = Phase.READY_TO_START;
      this.error = 'The selected display could not be published. Choose a display and try again.';
    }
    this.render();
  }

  async switchDisplay() {
    if (this.phase !== Phase.ACTIVE) return;
    this.phase = Phase.SWITCHING;
    this.stopClipboardMonitor();
    await api.releaseAll();
    await this.unpublishDisplay();
    this.gate?.resetSequence();
    this.phase = Phase.CHOOSE_DISPLAY;
    this.display = null;
    this.displayOptions = [];
    this.render();
  }

  async stop() {
    if (this.stopping) return;
    this.stopping = true;
    this.phase = Phase.ENDED;
    this.stopClipboardMonitor();
    clearInterval(this.lifecycleTimer);
    this.lifecycleTimer = null;
    try {
      await api.releaseAll();
      await this.cleanupTransport();
    } finally {
      this.stopping = false;
      this.render();
      if (this.elevated) window.close();
    }
  }

  enqueuePacket(received) {
    this.inputDispatch = this.inputDispatch
      .then(() => this.receivePacket(received))
      .catch(async () => {
        if (this.phase !== Phase.ACTIVE) return;
        if ((await api.sessionState()) === 'display-changed') await this.suspendForDisplayChange();
        else await this.stop();
      });
  }

  async receivePacket(received) {
    if (this.phase !== Phase.ACTIVE || !this.response || !this.gate) return;
    const packet = decodeControlPacket(new Uint8Array(received.payload));
    if (!packet) return;
    const rejection = this.gate.authorize({
      packet,
      senderIdentity: received.senderIdentity,
      tokenMetadata: parseAgentTokenMetadata(this.response.token),
      localAgentIdentity: this.response.session.agentIdentity,
      projection: this.projection,
      connected: !!this.room,
    });
    if (rejection) return;
    if (packet.command.kind === 'input') await api.applyInput(packet.command.event);
    if (packet.command.kind === 'clipboard-copy') {
      await api.releaseAll();
      await api.sendClipboardShortcut('copy');
    }
    if (packet.command.kind === 'clipboard-paste') {
      await api.releaseAll();
      this.expectedClipboardChangeCount = await api.writeClipboardText(packet.command.text);
      this.clipboardChangeCount = this.expectedClipboardChangeCount;
      await api.sendClipboardShortcut('paste');
    }
  }

  receiveMetadata(metadata) {
    this.projection = parseRemoteControlProjection(metadata);
    if (this.phase === Phase.AWAITING_ACTIVATION && this.canPublishNow() && this.display) this.phase = Phase.READY_TO_START;
    if (activePhase(this.phase) && !this.canPublishNow()) void this.stop();
    this.render();
  }

  canPublishNow() {
    return !!(
      this.response &&
      this.gate?.canPublishDesktop({
        tokenMetadata: parseAgentTokenMetadata(this.response.token),
        localAgentIdentity: this.response.session.agentIdentity,
        projection: this.projection,
      })
    );
  }

  startClipboardMonitor() {
    this.stopClipboardMonitor();
    this.clipboardTimer = setInterval(() => void this.syncClipboard(), 500);
  }

  stopClipboardMonitor() {
    clearInterval(this.clipboardTimer);
    this.clipboardTimer = null;
    this.expectedClipboardChangeCount = null;
  }

  async syncClipboard() {
    if (this.clipboardSyncInFlight || this.phase !== Phase.ACTIVE || !this.canPublishNow() || !this.response || !this.room) return;
    this.clipboardSyncInFlight = true;
    try {
      if ((await api.sessionState()) === 'display-changed') {
        await this.suspendForDisplayChange();
        return;
      }
      const nextCount = await api.clipboardChangeCount();
      if (nextCount === this.clipboardChangeCount) return;
      this.clipboardChangeCount = nextCount;
      if (this.expectedClipboardChangeCount === nextCount) {
        this.expectedClipboardChangeCount = null;
        return;
      }
      const text = await api.readClipboardText();
      if (!isTransferableClipboardText(text) || !this.canPublishNow() || !this.response || !this.room) return;
      this.clipboardRevision += 1;
      await this.room.localParticipant.publishData(
        encodeClipboardUpdate({ sessionId: this.response.session.sessionId, revision: this.clipboardRevision, text }),
        { reliable: true, topic: REMOTE_CONTROL_TOPIC, destinationIdentities: [this.response.session.controllerIdentity] },
      );
    } catch {
      this.stopClipboardMonitor();
    } finally {
      this.clipboardSyncInFlight = false;
    }
  }

  startLifecycleMonitor() {
    clearInterval(this.lifecycleTimer);
    this.lifecycleTimer = setInterval(() => void this.checkLifecycle(), 250);
  }

  async checkLifecycle() {
    if (this.lifecycleCheckInFlight) return;
    this.lifecycleCheckInFlight = true;
    try {
      const state = await api.sessionState();
      if (state === 'display-changed') {
        if (this.phase === Phase.ACTIVE) await this.suspendForDisplayChange();
        else await api.acknowledgeDisplayChange();
      } else if (state !== 'active') {
        await this.stop();
      }
    } finally {
      this.lifecycleCheckInFlight = false;
    }
  }

  async suspendForDisplayChange() {
    if (this.phase !== Phase.ACTIVE) return;
    this.phase = Phase.SWITCHING;
    this.stopClipboardMonitor();
    await api.releaseAll();
    await this.unpublishDisplay();
    this.gate?.resetSequence();
    this.display = null;
    this.displayOptions = [];
    await api.acknowledgeDisplayChange();
    this.phase = Phase.CHOOSE_DISPLAY;
    this.error = 'Your display setup changed. Select a display again before Remote Control can resume.';
    this.render();
  }

  async redeem(descriptor) {
    const endpoint = new URL(
      `/rooms/${encodeURIComponent(descriptor.room)}/remote-control/${encodeURIComponent(descriptor.sessionId)}/helper-token`,
      descriptor.apiOrigin,
    );
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ bootstrapCode: descriptor.bootstrapCode }),
      cache: 'no-store',
    });
    if (!response.ok) throw new TypeError('Control Agent bootstrap rejected');
    return parseBootstrapResponse(await response.json());
  }

  async unpublishDisplay() {
    if (this.room) await this.room.localParticipant.setScreenShareEnabled(false);
  }

  async cleanupTransport() {
    const room = this.room;
    this.room = null;
    if (room) {
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } finally {
        await room.disconnect();
      }
    }
  }

  fail(message) {
    this.phase = Phase.FAILED;
    this.error = message;
    this.render();
  }

  render() {
    render(this);
  }
}

function button(label, callback, { primary = false, disabled = false } = {}) {
  const element = document.createElement('button');
  element.className = primary ? 'primary-button' : 'secondary-button';
  element.type = 'button';
  element.disabled = disabled;
  element.textContent = label;
  element.addEventListener('click', () => void callback());
  return element;
}

function addText(container, tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  container.append(element);
  return element;
}

function render(agent) {
  const root = document.querySelector('#app');
  root.replaceChildren();
  const page = document.createElement('main');
  const card = document.createElement('section');
  card.className = 'agent-card';
  addText(card, 'p', 'HUDDLE', 'eyebrow');
  addText(card, 'h1', phaseTitle(agent.phase));
  addText(card, 'p', phaseDescription(agent.phase), 'description');

  if ([Phase.WAITING, Phase.FAILED, Phase.ENDED].includes(agent.phase)) {
    const input = document.createElement('textarea');
    input.className = 'link-input';
    input.rows = 4;
    input.placeholder = 'huddle-control://join?...';
    input.autocapitalize = 'off';
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (agent.rawLink) input.value = agent.rawLink;
    card.append(
      input,
      button('Open approved link', () => agent.acceptLink(input.value.trim()), { primary: true }),
    );
  }
  if (agent.phase === Phase.TRUST && agent.descriptor) {
    addText(
      card,
      'p',
      `Trust ${agent.descriptor.apiOrigin} on this computer before this agent redeems the one-time link. This stores only the server origin, never the room or token.`,
      'notice',
    );
    card.append(button('Trust this Huddle server', () => agent.trustServer(), { primary: true }));
  }
  if (agent.phase === Phase.READY) {
    addText(
      card,
      'p',
      agent.elevated
        ? 'Administrator-app mode is enabled for this one attended session.'
        : 'Use ordinary mode for normal desktop applications. You can instead request local UAC approval before connecting if the Sharer needs to control an administrator app.',
      'notice',
    );
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(button('Connect to approved room', () => agent.connect(), { primary: true }));
    if (!agent.elevated) actions.append(button('Allow control of administrator apps', () => agent.restartElevated()));
    card.append(actions);
  }
  if (agent.phase === Phase.CONNECTING || agent.phase === Phase.AWAITING_ACTIVATION) {
    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.setAttribute('role', 'progressbar');
    card.append(progress);
  }
  if ([Phase.CHOOSE_DISPLAY, Phase.READY_TO_START].includes(agent.phase)) {
    addText(
      card,
      'p',
      agent.display
        ? `Selected display: ${agent.display.name}`
        : 'Select one entire physical display. Huddle shares no audio and does not offer window sharing.',
      'notice',
    );
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(button(agent.displayOptions.length ? 'Refresh displays' : 'Select display', () => agent.listDisplays()));
    if (agent.phase === Phase.READY_TO_START) actions.append(button('Start Remote Control', () => agent.start(), { primary: true }));
    card.append(actions);
    if (agent.displayOptions.length) {
      const choices = document.createElement('div');
      choices.className = 'display-choices';
      for (const display of agent.displayOptions)
        choices.append(button(display.name, () => agent.chooseDisplay(display.id), { disabled: agent.phase === Phase.READY_TO_START }));
      card.append(choices);
    }
  }
  if ([Phase.ACTIVE, Phase.SWITCHING].includes(agent.phase)) {
    addText(
      card,
      'p',
      agent.elevated
        ? 'Remote Control is active in administrator-app mode. The Sharer can stop it here at any time.'
        : 'Remote Control is active. The Sharer can stop it here at any time.',
      'notice',
    );
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(button('Change display', () => agent.switchDisplay(), { disabled: agent.phase !== Phase.ACTIVE }));
    actions.append(button('Stop Remote Control', () => agent.stop(), { primary: true }));
    card.append(actions);
  }
  if (agent.error) addText(card, 'p', agent.error, 'error');
  if (agent.releaseStatus?.availableVersion)
    addText(
      card,
      'p',
      `Version ${agent.releaseStatus.availableVersion} is available. Download and install it manually after this attended session ends.`,
      'notice',
    );
  addText(
    card,
    'p',
    `Windows x86 companion · version ${APP_VERSION} · clipboard is limited to ${MAXIMUM_CLIPBOARD_TEXT_BYTES / 1024} KiB of plain text.`,
    'footer',
  );
  page.append(card);
  root.append(page);
}

const agent = new ElectronControlAgent();
api.onLink((link) => agent.acceptLink(link));
agent.initialize(await api.initialLink());
