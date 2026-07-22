import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RemoteControlSession, Room } from '@prisma/client';
import { FaultCode, faultBody } from '../common/faults';
import { LivekitService, type ConnectedParticipant, type RemoteControlRoomState } from './livekit.service';
import type { CallParticipant } from './participant.guard';
import { RemoteControlRepository, type RemoteControlSessionWithRoom } from './remote-control.repo';
import {
  REMOTE_CONTROL_RENEWAL_MS,
  REMOTE_CONTROL_REQUEST_TTL_MS,
  RemoteControlStateService,
  type ActiveRemoteControlGrant,
  type PendingRemoteControlRequest,
} from './remote-control.state';
import { RoomRepository } from './rooms.repo';

export interface RemoteControlRequestSummary {
  requestId: string;
  room: string;
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  requestedAt: string;
  expiresAt: string;
}

export interface RemoteControlSessionSummary {
  sessionId: string;
  status: 'awaiting-agent' | 'active';
  sharerIdentity: string;
  sharerName: string;
  controllerIdentity: string;
  controllerName: string;
  agentIdentity: string;
  agentConnected: boolean;
  renewalDueAt: string;
}

@Injectable()
export class RemoteControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemoteControlService.name);
  private expiryTimer?: NodeJS.Timeout;
  private reconciling = false;

  constructor(
    private readonly rooms: RoomRepository,
    private readonly audit: RemoteControlRepository,
    private readonly state: RemoteControlStateService,
    private readonly livekit: LivekitService,
  ) {}

  onModuleInit(): void {
    void this.reconcileExpirations();
    this.expiryTimer = setInterval(() => void this.reconcileExpirations(), 5_000);
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async requestControl(roomSlug: string, controller: CallParticipant, sharerIdentity: string): Promise<RemoteControlRequestSummary> {
    const room = await this.requireRoom(roomSlug);
    if (controller.identity === sharerIdentity) {
      throw this.notAllowed('You cannot request control of your own participant');
    }
    if (await this.state.hasOwner(roomSlug)) {
      throw this.inProgress();
    }

    const [connectedController, sharer, presenting] = await Promise.all([
      this.connectedParticipant(roomSlug, controller.identity),
      this.connectedParticipant(roomSlug, sharerIdentity),
      this.presentationActive(roomSlug),
    ]);
    if (!connectedController || !sharer) {
      throw this.notAllowed('Both the Controller and Sharer must be connected');
    }
    if (connectedController.role === 'control-agent' || sharer.role === 'control-agent') {
      throw this.notAllowed('A Control Agent cannot be a Sharer or Controller');
    }
    if (presenting) throw this.presentActive();

    const audit = await this.audit.createRequest({
      roomId: room.id,
      sharerIdentity: sharer.identity,
      sharerName: sharer.name,
      controllerIdentity: connectedController.identity,
      controllerName: connectedController.name,
    });
    const requestedAt = audit.createdAt.toISOString();
    const pending: PendingRemoteControlRequest = {
      requestId: audit.id,
      room: roomSlug,
      sharerIdentity: sharer.identity,
      sharerName: sharer.name,
      controllerIdentity: connectedController.identity,
      controllerName: connectedController.name,
      requestedAt,
      expiresAt: new Date(audit.createdAt.getTime() + REMOTE_CONTROL_REQUEST_TTL_MS).toISOString(),
      controllerTokenExpiresAt: new Date(controller.tokenExpiresAt ?? Date.now() + 60 * 60_000).toISOString(),
    };

    let acquired = false;
    try {
      acquired = await this.state.createPending(pending);
    } catch {
      await this.audit.failRequest(audit.id, 'redis_unavailable', new Date());
      throw this.upstream('Remote Control state is unavailable');
    }
    if (!acquired) {
      await this.audit.failRequest(audit.id, 'room_in_progress', new Date());
      throw this.inProgress();
    }
    return this.toRequestSummary(pending);
  }

  async getRequest(room: string, requestId: string, participant: CallParticipant): Promise<RemoteControlRequestSummary> {
    const pending = await this.requirePending(room, requestId);
    if (participant.identity !== pending.sharerIdentity && participant.identity !== pending.controllerIdentity) {
      throw this.notAllowed('Only the target Sharer or requesting Controller may read this request');
    }
    return this.toRequestSummary(pending);
  }

  async approve(
    roomSlug: string,
    requestId: string,
    sharerParticipant: CallParticipant,
  ): Promise<{
    session: RemoteControlSessionSummary;
    helper: { bootstrapCode: string; expiresAt: string };
  }> {
    const room = await this.requireRoom(roomSlug);
    const pending = await this.requirePending(roomSlug, requestId);
    if (sharerParticipant.identity !== pending.sharerIdentity) {
      throw this.notAllowed('Only the requested Sharer may approve Remote Control');
    }

    const [controller, sharer, presenting] = await Promise.all([
      this.connectedParticipant(roomSlug, pending.controllerIdentity),
      this.connectedParticipant(roomSlug, pending.sharerIdentity),
      this.presentationActive(roomSlug),
    ]);
    if (!controller || !sharer) {
      throw this.notAllowed('Both the Controller and Sharer must still be connected');
    }
    if (controller.role === 'control-agent' || sharer.role === 'control-agent') {
      throw this.notAllowed('A Control Agent cannot be a Sharer or Controller');
    }
    if (presenting) throw this.presentActive();

    const consumed = await this.state.consumePending(roomSlug, requestId);
    if (!consumed) throw this.notFound('Remote Control request was already resolved or expired');

    const now = new Date();
    const authorizationExpiresAt = Math.min(
      new Date(consumed.controllerTokenExpiresAt).getTime(),
      sharerParticipant.tokenExpiresAt ?? Date.now() + 60 * 60_000,
    );
    if (!Number.isFinite(authorizationExpiresAt) || authorizationExpiresAt <= now.getTime()) {
      await this.audit.failRequest(requestId, 'participant_authorization_expired', now);
      await this.state.releasePending(roomSlug, requestId);
      throw this.notAllowed('Participant authorization expired before approval');
    }

    const agentIdentity = `control-agent:${requestId}`;
    const renewalDueAt = new Date(Math.min(now.getTime() + REMOTE_CONTROL_RENEWAL_MS, authorizationExpiresAt));
    const grant: ActiveRemoteControlGrant = {
      sessionId: requestId,
      room: roomSlug,
      roomId: room.id,
      sharerIdentity: consumed.sharerIdentity,
      sharerName: consumed.sharerName,
      controllerIdentity: consumed.controllerIdentity,
      controllerName: consumed.controllerName,
      agentIdentity,
      status: 'awaiting-agent',
      agentConnected: false,
      startedAt: now.toISOString(),
      renewalDueAt: renewalDueAt.toISOString(),
      authorizationExpiresAt: new Date(authorizationExpiresAt).toISOString(),
    };

    if (!(await this.state.activate(grant))) {
      await this.audit.failRequest(requestId, 'room_in_progress', now);
      await this.state.releasePending(roomSlug, requestId);
      throw this.inProgress();
    }

    try {
      const activated = await this.audit.activate(requestId, {
        agentIdentity,
        startedAt: now,
        renewalDueAt,
      });
      if (!activated) {
        await this.state.clearActive(roomSlug, requestId);
        throw this.notFound('Remote Control request was already resolved');
      }
      await this.livekit.setRemoteControlState(roomSlug, this.toRoomState(grant));
      const helper = await this.state.issueBootstrap(grant);
      return { session: this.toSessionSummary(grant), helper };
    } catch (error) {
      await this.endGrant(grant, 'failed', 'startup_failed', new Date());
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) throw error;
      if (this.isUniqueViolation(error)) throw this.inProgress();
      throw this.upstream('Remote Control could not be started');
    }
  }

  async deny(room: string, requestId: string, participant: CallParticipant): Promise<{ status: 'denied' }> {
    const pending = await this.requirePending(room, requestId);
    if (participant.identity !== pending.sharerIdentity) {
      throw this.notAllowed('Only the requested Sharer may deny Remote Control');
    }
    const consumed = await this.state.consumePending(room, requestId);
    if (!consumed) throw this.notFound('Remote Control request was already resolved or expired');

    try {
      const denied = await this.audit.deny(requestId, new Date());
      if (!denied) throw this.notFound('Remote Control request was already resolved');
      return { status: 'denied' };
    } finally {
      await this.state.releasePending(room, requestId);
    }
  }

  async redeemHelperToken(
    room: string,
    sessionId: string,
    bootstrapCode: string,
  ): Promise<{
    token: string;
    livekitUrl: string;
    room: string;
    session: RemoteControlSessionSummary;
  }> {
    const bootstrap = await this.state.consumeBootstrap(room, sessionId, bootstrapCode);
    if (!bootstrap) throw this.bootstrapInvalid();

    const grant = await this.state.getActive(room);
    if (!grant || grant.sessionId !== sessionId || this.isGrantExpired(grant)) {
      if (grant?.sessionId === sessionId) await this.endGrant(grant, 'expired', 'renewal_timeout', new Date());
      throw this.bootstrapInvalid();
    }

    try {
      const token = await this.livekit.mintControlAgentToken({
        room,
        sessionId,
        sharerIdentity: grant.sharerIdentity,
        controllerIdentity: grant.controllerIdentity,
        agentIdentity: grant.agentIdentity,
      });
      const summary = this.toSessionSummary(grant);
      return {
        token,
        livekitUrl: this.livekit.livekitUrl,
        room,
        session: summary,
      };
    } catch {
      await this.endGrant(grant, 'failed', 'helper_token_failed', new Date());
      throw this.upstream('Control Agent token could not be created');
    }
  }

  async stop(room: string, sessionId: string, participant: CallParticipant): Promise<{ status: 'ended'; endedAt: string }> {
    const grant = await this.requireActive(room, sessionId);
    if (participant.identity !== grant.sharerIdentity && participant.identity !== grant.controllerIdentity) {
      throw this.notAllowed('Only the Sharer or Controller may stop Remote Control');
    }
    const reason = participant.identity === grant.sharerIdentity ? 'sharer_stopped' : 'controller_stopped';
    const endedAt = new Date();
    await this.endGrant(
      grant,
      this.isGrantExpired(grant, endedAt) ? 'expired' : 'ended',
      this.isGrantExpired(grant, endedAt) ? 'renewal_timeout' : reason,
      endedAt,
    );
    return { status: 'ended', endedAt: endedAt.toISOString() };
  }

  async renew(room: string, sessionId: string, participant: CallParticipant): Promise<{ sessionId: string; renewalDueAt: string }> {
    const grant = await this.requireActive(room, sessionId);
    if (participant.identity !== grant.sharerIdentity) {
      throw this.notAllowed('Only the Sharer may renew Remote Control');
    }
    const now = new Date();
    if (this.isGrantExpired(grant, now)) {
      await this.endGrant(grant, 'expired', 'renewal_timeout', now);
      throw new ConflictException(faultBody(FaultCode.REMOTE_CONTROL_RENEWAL_REQUIRED, 'Remote Control consent expired'));
    }

    const authorizationExpiresAt = new Date(grant.authorizationExpiresAt).getTime();
    const renewalDueAt = new Date(Math.min(now.getTime() + REMOTE_CONTROL_RENEWAL_MS, authorizationExpiresAt));
    const renewed = { ...grant, renewalDueAt: renewalDueAt.toISOString() };
    if (!(await this.state.updateActive(renewed))) throw this.notFound('Remote Control session is no longer active');

    let auditUpdated = false;
    try {
      auditUpdated = await this.audit.updateRenewal(sessionId, renewalDueAt);
      if (!auditUpdated) throw this.notFound('Remote Control session is no longer active');
      await this.livekit.setRemoteControlState(room, this.toRoomState(renewed));
      return { sessionId, renewalDueAt: renewed.renewalDueAt };
    } catch (error) {
      await this.state.updateActive(grant);
      if (auditUpdated) await this.audit.updateRenewal(sessionId, new Date(grant.renewalDueAt));
      if (error instanceof NotFoundException) throw error;
      throw this.upstream('Remote Control renewal could not be saved');
    }
  }

  async onParticipantJoined(room: string, identity: string): Promise<void> {
    const grant = await this.state.getActive(room);
    if (!grant || grant.agentIdentity !== identity) return;
    const now = new Date();
    if (this.isGrantExpired(grant, now)) {
      await this.endGrant(grant, 'expired', 'renewal_timeout', now);
      return;
    }

    const connected: ActiveRemoteControlGrant = {
      ...grant,
      status: 'active',
      agentConnected: true,
    };
    if (!(await this.state.updateActive(connected))) return;
    try {
      await this.livekit.setRemoteControlState(room, this.toRoomState(connected));
    } catch {
      await this.endGrant(connected, 'failed', 'agent_metadata_failed', new Date());
    }
  }

  async onParticipantLeft(room: string, identity: string): Promise<void> {
    const grant = await this.state.getActive(room);
    if (!grant) return;
    let reason: string | null = null;
    if (identity === grant.sharerIdentity) reason = 'sharer_disconnected';
    else if (identity === grant.controllerIdentity) reason = 'controller_disconnected';
    else if (identity === grant.agentIdentity) reason = 'agent_disconnected';
    if (reason) await this.endGrant(grant, 'ended', reason, new Date());
  }

  async onRoomFinished(roomSlug: string): Promise<void> {
    const room = await this.rooms.findBySlug(roomSlug);
    if (!room) return;
    const grant = await this.state.getActive(roomSlug);
    if (grant) {
      await this.endGrant(grant, 'ended', 'room_finished', new Date());
      return;
    }
    const active = await this.audit.findActiveByRoom(room.id);
    if (active) await this.endAuditFallback(active, roomSlug, 'ended', 'room_finished', new Date());
  }

  // Public for deterministic unit tests; the timer calls the same path. Querying
  // Postgres makes expiry survive an API restart even if Redis TTL already fired.
  async reconcileExpirations(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    const now = new Date();
    try {
      const [dueActive, expiredRequests] = await Promise.all([
        this.audit.findDueActive(now),
        this.audit.findExpiredRequests(new Date(now.getTime() - REMOTE_CONTROL_REQUEST_TTL_MS)),
      ]);
      for (const row of dueActive) {
        const grant = await this.state.getActive(row.room.slug);
        if (grant && grant.sessionId === row.id) {
          await this.endGrant(grant, 'expired', 'renewal_timeout', now);
        } else {
          await this.endAuditFallback(row, row.room.slug, 'expired', 'renewal_timeout', now);
        }
      }
      for (const row of expiredRequests) {
        await this.state.releasePending(row.room.slug, row.id);
        await this.audit.expireRequest(row.id, now);
      }
    } catch (error) {
      this.logger.error(`Remote Control expiry reconciliation failed: ${String(error)}`);
    } finally {
      this.reconciling = false;
    }
  }

  private async requirePending(room: string, requestId: string): Promise<PendingRemoteControlRequest> {
    const pending = await this.state.getPending(room, requestId);
    if (pending && new Date(pending.expiresAt).getTime() > Date.now()) return pending;
    await this.state.releasePending(room, requestId);
    const audit = await this.audit.findById(requestId);
    if (audit?.status === 'requested') await this.audit.expireRequest(requestId, new Date());
    throw this.notFound('Remote Control request was not found or expired');
  }

  private async requireActive(roomSlug: string, sessionId: string): Promise<ActiveRemoteControlGrant> {
    const grant = await this.state.getActive(roomSlug);
    if (grant?.sessionId === sessionId) return grant;

    // Redis is authoritative. If it disappeared unexpectedly, close any stale
    // audit/metadata projection instead of recreating authority from Postgres.
    const room = await this.rooms.findBySlug(roomSlug);
    if (room) {
      const active = await this.audit.findActiveByRoom(room.id);
      if (active?.id === sessionId) await this.endAuditFallback(active, roomSlug, 'failed', 'grant_missing', new Date());
    }
    throw this.notFound('Remote Control session is not active');
  }

  private async endGrant(grant: ActiveRemoteControlGrant, status: 'ended' | 'expired' | 'failed', reason: string, endedAt: Date): Promise<void> {
    await this.state.revokeBootstrap(grant);
    await this.state.clearActive(grant.room, grant.sessionId);
    await this.clearLivekitState(grant.room, grant.agentIdentity);
    await this.audit.endActive(grant.sessionId, status, reason, endedAt);
  }

  private async endAuditFallback(
    row: RemoteControlSession | RemoteControlSessionWithRoom,
    room: string,
    status: 'ended' | 'expired' | 'failed',
    reason: string,
    endedAt: Date,
  ): Promise<void> {
    await this.state.clearActive(room, row.id);
    await this.clearLivekitState(room, row.agentIdentity);
    await this.audit.endActive(row.id, status, reason, endedAt);
  }

  private async clearLivekitState(room: string, agentIdentity: string | null): Promise<void> {
    const operations: Promise<unknown>[] = [this.livekit.setRemoteControlState(room, null)];
    if (agentIdentity) operations.push(this.livekit.disconnectControlAgent(room, agentIdentity));
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === 'rejected') this.logger.warn(`Remote Control LiveKit cleanup failed for room "${room}": ${String(result.reason)}`);
    }
  }

  private async connectedParticipant(room: string, identity: string): Promise<ConnectedParticipant | null> {
    try {
      return await this.livekit.getConnectedParticipant(room, identity);
    } catch {
      throw this.upstream('LiveKit participant state is unavailable');
    }
  }

  private async presentationActive(room: string): Promise<boolean> {
    try {
      return await this.livekit.hasActiveScreenShare(room);
    } catch {
      throw this.upstream('LiveKit presentation state is unavailable');
    }
  }

  private async requireRoom(slug: string): Promise<Room> {
    const room = await this.rooms.findBySlug(slug);
    if (!room) throw new NotFoundException(faultBody(FaultCode.ROOM_NOT_FOUND, 'No such room'));
    return room;
  }

  private toRequestSummary(request: PendingRemoteControlRequest): RemoteControlRequestSummary {
    const { controllerTokenExpiresAt, ...summary } = request;
    void controllerTokenExpiresAt;
    return summary;
  }

  private toSessionSummary(grant: ActiveRemoteControlGrant): RemoteControlSessionSummary {
    return {
      sessionId: grant.sessionId,
      status: grant.status,
      sharerIdentity: grant.sharerIdentity,
      sharerName: grant.sharerName,
      controllerIdentity: grant.controllerIdentity,
      controllerName: grant.controllerName,
      agentIdentity: grant.agentIdentity,
      agentConnected: grant.agentConnected,
      renewalDueAt: grant.renewalDueAt,
    };
  }

  private toRoomState(grant: ActiveRemoteControlGrant): RemoteControlRoomState {
    return this.toSessionSummary(grant);
  }

  private isGrantExpired(grant: ActiveRemoteControlGrant, now = new Date()): boolean {
    const deadline = Math.min(new Date(grant.renewalDueAt).getTime(), new Date(grant.authorizationExpiresAt).getTime());
    return !Number.isFinite(deadline) || deadline <= now.getTime();
  }

  private inProgress(): ConflictException {
    return new ConflictException(faultBody(FaultCode.REMOTE_CONTROL_IN_PROGRESS, 'A Remote Control request or session is already in progress'));
  }

  private presentActive(): ConflictException {
    return new ConflictException(faultBody(FaultCode.REMOTE_CONTROL_PRESENT_ACTIVE, 'Remote Control cannot start while someone is presenting'));
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException(faultBody(FaultCode.REMOTE_CONTROL_NOT_FOUND, message));
  }

  private notAllowed(message: string): ForbiddenException {
    return new ForbiddenException(faultBody(FaultCode.REMOTE_CONTROL_NOT_ALLOWED, message));
  }

  private bootstrapInvalid(): UnauthorizedException {
    return new UnauthorizedException(faultBody(FaultCode.REMOTE_CONTROL_BOOTSTRAP_INVALID, 'Control Agent bootstrap code is invalid or expired'));
  }

  private upstream(message: string): ServiceUnavailableException {
    return new ServiceUnavailableException(faultBody(FaultCode.UPSTREAM_UNAVAILABLE, message));
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
  }
}
