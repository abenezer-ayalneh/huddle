import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { RemoteControlSession, Room } from '@prisma/client';
import { LivekitService } from './livekit.service';
import type { CallParticipant } from './participant.guard';
import { RemoteControlRepository } from './remote-control.repo';
import { RemoteControlService } from './remote-control.service';
import { RemoteControlStateService, type ActiveRemoteControlGrant, type PendingRemoteControlRequest } from './remote-control.state';
import { RoomRepository } from './rooms.repo';

const room: Room = {
  id: 'room-db-id',
  slug: 'design-review',
  scheduledStart: null,
  hostKey: 'host-key',
  hostUserId: 'host-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const controller: CallParticipant = {
  identity: 'controller',
  name: 'Bo',
  tokenExpiresAt: Date.now() + 60 * 60_000,
};

const sharer: CallParticipant = {
  identity: 'sharer',
  name: 'Ada',
  tokenExpiresAt: Date.now() + 60 * 60_000,
};

const bystander: CallParticipant = {
  identity: 'bystander',
  name: 'Cy',
  tokenExpiresAt: Date.now() + 60 * 60_000,
};

function pendingRequest(overrides: Partial<PendingRemoteControlRequest> = {}): PendingRemoteControlRequest {
  const now = Date.now();
  return {
    requestId: 'request-id',
    room: room.slug,
    sharerIdentity: sharer.identity,
    sharerName: sharer.name,
    controllerIdentity: controller.identity,
    controllerName: controller.name,
    requestedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30_000).toISOString(),
    controllerTokenExpiresAt: new Date(now + 60 * 60_000).toISOString(),
    ...overrides,
  };
}

function activeGrant(overrides: Partial<ActiveRemoteControlGrant> = {}): ActiveRemoteControlGrant {
  const now = Date.now();
  return {
    sessionId: 'request-id',
    room: room.slug,
    roomId: room.id,
    sharerIdentity: sharer.identity,
    sharerName: sharer.name,
    controllerIdentity: controller.identity,
    controllerName: controller.name,
    agentIdentity: 'control-agent:request-id',
    status: 'active',
    agentConnected: true,
    startedAt: new Date(now).toISOString(),
    renewalDueAt: new Date(now + 30 * 60_000).toISOString(),
    authorizationExpiresAt: new Date(now + 60 * 60_000).toISOString(),
    ...overrides,
  };
}

function auditRow(overrides: Partial<RemoteControlSession> = {}): RemoteControlSession {
  const now = new Date();
  return {
    id: 'request-id',
    roomId: room.id,
    sharerIdentity: sharer.identity,
    sharerName: sharer.name,
    controllerIdentity: controller.identity,
    controllerName: controller.name,
    agentIdentity: null,
    status: 'requested',
    startedAt: null,
    endedAt: null,
    renewalDueAt: null,
    endReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('RemoteControlService', () => {
  let rooms: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let state: Record<string, jest.Mock>;
  let livekit: jest.Mocked<
    Pick<LivekitService, 'getConnectedParticipant' | 'hasActiveScreenShare' | 'setRemoteControlState' | 'disconnectControlAgent' | 'mintControlAgentToken'>
  > & { livekitUrl: string };
  let service: RemoteControlService;

  beforeEach(() => {
    rooms = { findBySlug: jest.fn().mockResolvedValue(room) };
    audit = {
      createRequest: jest.fn().mockResolvedValue(auditRow()),
      failRequest: jest.fn().mockResolvedValue(true),
      findById: jest.fn(),
      activate: jest.fn(),
      deny: jest.fn(),
      updateRenewal: jest.fn().mockResolvedValue(true),
      endActive: jest.fn().mockResolvedValue(true),
      findActiveByRoom: jest.fn(),
      findDueActive: jest.fn().mockResolvedValue([]),
      findExpiredRequests: jest.fn().mockResolvedValue([]),
      expireRequest: jest.fn(),
    };
    state = {
      hasOwner: jest.fn().mockResolvedValue(false),
      createPending: jest.fn().mockResolvedValue(true),
      getPending: jest.fn(),
      getPendingForRoom: jest.fn(),
      consumePending: jest.fn(),
      releasePending: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn(),
      getActive: jest.fn(),
      updateActive: jest.fn().mockResolvedValue(true),
      clearActive: jest.fn().mockResolvedValue(true),
      issueBootstrap: jest.fn(),
      consumeBootstrap: jest.fn(),
      revokeBootstrap: jest.fn().mockResolvedValue(undefined),
    };
    livekit = {
      livekitUrl: 'ws://livekit.test',
      getConnectedParticipant: jest.fn(),
      hasActiveScreenShare: jest.fn().mockResolvedValue(false),
      setRemoteControlState: jest.fn().mockResolvedValue(undefined),
      disconnectControlAgent: jest.fn().mockResolvedValue(undefined),
      mintControlAgentToken: jest.fn(),
    };
    service = new RemoteControlService(
      rooms as unknown as RoomRepository,
      audit as unknown as RemoteControlRepository,
      state as unknown as RemoteControlStateService,
      livekit as unknown as LivekitService,
    );
  });

  it('does not create a request while a participant is presenting', async () => {
    livekit.getConnectedParticipant
      .mockResolvedValueOnce({ identity: controller.identity, name: controller.name })
      .mockResolvedValueOnce({ identity: sharer.identity, name: sharer.name });
    livekit.hasActiveScreenShare.mockResolvedValue(true);

    await expect(service.requestControl(room.slug, controller, sharer.identity)).rejects.toThrow(ConflictException);

    expect(audit.createRequest).not.toHaveBeenCalled();
    expect(state.createPending).not.toHaveBeenCalled();
  });

  it('writes a pending request only after both human participants are connected', async () => {
    livekit.getConnectedParticipant
      .mockResolvedValueOnce({ identity: controller.identity, name: controller.name })
      .mockResolvedValueOnce({ identity: sharer.identity, name: sharer.name });

    const result = await service.requestControl(room.slug, controller, sharer.identity);

    expect(result).toMatchObject({
      requestId: 'request-id',
      room: room.slug,
      sharerIdentity: sharer.identity,
      controllerIdentity: controller.identity,
    });
    expect(state.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-id',
        room: room.slug,
      }),
    );
  });

  it('returns the current pending request only to its exact Sharer', async () => {
    state.getPendingForRoom.mockResolvedValue(pendingRequest());

    await expect(service.getPendingRequest(room.slug, sharer)).resolves.toMatchObject({
      request: {
        requestId: 'request-id',
        sharerIdentity: sharer.identity,
        controllerIdentity: controller.identity,
      },
    });
    expect(state.releasePending).not.toHaveBeenCalled();
  });

  it('hides the current pending request from its Controller and bystanders', async () => {
    state.getPendingForRoom.mockResolvedValue(pendingRequest());

    await expect(service.getPendingRequest(room.slug, controller)).resolves.toEqual({ request: null });
    await expect(service.getPendingRequest(room.slug, bystander)).resolves.toEqual({ request: null });
  });

  it('returns null when no pending request exists', async () => {
    state.getPendingForRoom.mockResolvedValue(undefined);

    await expect(service.getPendingRequest(room.slug, sharer)).resolves.toEqual({ request: null });
  });

  it('expires an overdue pending request instead of returning it to the Sharer', async () => {
    state.getPendingForRoom.mockResolvedValue(pendingRequest({ expiresAt: new Date(Date.now() - 1).toISOString() }));
    audit.findById.mockResolvedValue(auditRow());

    await expect(service.getPendingRequest(room.slug, sharer)).resolves.toEqual({ request: null });
    expect(state.releasePending).toHaveBeenCalledWith(room.slug, 'request-id');
    expect(audit.expireRequest).toHaveBeenCalledWith('request-id', expect.any(Date));
  });

  it('does not let a bystander stop the active grant', async () => {
    state.getActive.mockResolvedValue(activeGrant());

    await expect(service.stop(room.slug, 'request-id', { identity: 'bystander', name: 'Cy' })).rejects.toThrow(ForbiddenException);

    expect(state.clearActive).not.toHaveBeenCalled();
    expect(livekit.disconnectControlAgent).not.toHaveBeenCalled();
  });

  it('ends an authorized controller stop by revoking state, metadata, and the agent', async () => {
    const grant = activeGrant();
    state.getActive.mockResolvedValue(grant);

    await expect(service.stop(room.slug, grant.sessionId, controller)).resolves.toMatchObject({ status: 'ended' });

    expect(state.revokeBootstrap).toHaveBeenCalledWith(grant);
    expect(state.clearActive).toHaveBeenCalledWith(room.slug, grant.sessionId);
    expect(livekit.setRemoteControlState).toHaveBeenCalledWith(room.slug, null);
    expect(livekit.disconnectControlAgent).toHaveBeenCalledWith(room.slug, grant.agentIdentity);
    expect(audit.endActive).toHaveBeenCalledWith(grant.sessionId, 'ended', 'controller_stopped', expect.any(Date));
  });

  it('expires a grant instead of renewing it after the Sharer consent deadline', async () => {
    const expired = activeGrant({
      renewalDueAt: new Date(Date.now() - 1).toISOString(),
    });
    state.getActive.mockResolvedValue(expired);

    await expect(service.renew(room.slug, expired.sessionId, sharer)).rejects.toThrow(ConflictException);

    expect(state.clearActive).toHaveBeenCalledWith(room.slug, expired.sessionId);
    expect(livekit.disconnectControlAgent).toHaveBeenCalledWith(room.slug, expired.agentIdentity);
    expect(audit.endActive).toHaveBeenCalledWith(expired.sessionId, 'expired', 'renewal_timeout', expect.any(Date));
  });

  it('lets only the waiting Sharer rotate the Control Agent bootstrap', async () => {
    const grant = activeGrant({ agentConnected: false });
    state.getActive.mockResolvedValue(grant);
    state.issueBootstrap.mockResolvedValue({ bootstrapCode: 'fresh-code', expiresAt: new Date(Date.now() + 120_000).toISOString() });

    await expect(service.reissueBootstrap(room.slug, grant.sessionId, sharer)).resolves.toEqual(expect.objectContaining({ bootstrapCode: 'fresh-code' }));
    expect(state.issueBootstrap).toHaveBeenCalledWith(grant);

    await expect(service.reissueBootstrap(room.slug, grant.sessionId, controller)).rejects.toThrow(ForbiddenException);
  });

  it('rejects bootstrap rotation after the agent connects', async () => {
    const grant = activeGrant({ agentConnected: true });
    state.getActive.mockResolvedValue(grant);

    await expect(service.reissueBootstrap(room.slug, grant.sessionId, sharer)).rejects.toThrow(ConflictException);
    expect(state.issueBootstrap).not.toHaveBeenCalled();
  });
});
