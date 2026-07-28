import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { LivekitService } from './livekit.service';
import { RecordingsService } from './recordings.service';
import { RemoteControlService } from './remote-control.service';
import { RoomsService } from './rooms.service';
import { WebhookController } from './webhook.controller';

describe('WebhookController Direct Rejoin validation', () => {
  const directMetadata = JSON.stringify({
    role: 'guest',
    directRejoinGrantId: 'grant-1',
    directRejoinRoomSid: 'RM_current',
  });

  let livekit: {
    receiveWebhook: jest.Mock;
    directRejoinMetadata: jest.Mock;
    removeParticipant: jest.Mock;
    stampStartedAt: jest.Mock;
    clearStartedAt: jest.Mock;
  };
  let rooms: {
    isDirectRejoinParticipantValid: jest.Mock;
    onRoomFinished: jest.Mock;
  };
  let recordings: { handleEgressEvent: jest.Mock };
  let remoteControl: {
    onParticipantJoined: jest.Mock;
    onParticipantLeft: jest.Mock;
    onRoomFinished: jest.Mock;
  };
  let controller: WebhookController;

  beforeEach(() => {
    livekit = {
      receiveWebhook: jest.fn(),
      directRejoinMetadata: jest.fn().mockReturnValue({
        grantId: 'grant-1',
        roomSid: 'RM_current',
      }),
      removeParticipant: jest.fn().mockResolvedValue(undefined),
      stampStartedAt: jest.fn().mockResolvedValue(undefined),
      clearStartedAt: jest.fn().mockResolvedValue(undefined),
    };
    rooms = {
      isDirectRejoinParticipantValid: jest.fn().mockResolvedValue(true),
      onRoomFinished: jest.fn().mockResolvedValue(undefined),
    };
    recordings = { handleEgressEvent: jest.fn().mockResolvedValue(undefined) };
    remoteControl = {
      onParticipantJoined: jest.fn().mockResolvedValue(undefined),
      onParticipantLeft: jest.fn().mockResolvedValue(undefined),
      onRoomFinished: jest.fn().mockResolvedValue(undefined),
    };
    controller = new WebhookController(
      livekit as unknown as LivekitService,
      rooms as unknown as RoomsService,
      recordings as unknown as RecordingsService,
      remoteControl as unknown as RemoteControlService,
    );
  });

  function request(): RawBodyRequest<Request> {
    return {
      rawBody: Buffer.from('{}'),
      headers: { authorization: 'Bearer signature' },
    } as RawBodyRequest<Request>;
  }

  it('accepts a participant whose token matches the active Direct Rejoin Grant', async () => {
    livekit.receiveWebhook.mockResolvedValue({
      event: 'participant_joined',
      room: { name: 'standup', sid: 'RM_current' },
      participant: { identity: 'bo-stable', metadata: directMetadata },
    });

    await controller.receive(request());

    expect(rooms.isDirectRejoinParticipantValid).toHaveBeenCalledWith('standup', 'RM_current', 'bo-stable', { grantId: 'grant-1', roomSid: 'RM_current' });
    expect(livekit.removeParticipant).not.toHaveBeenCalled();
    expect(remoteControl.onParticipantJoined).toHaveBeenCalledWith('standup', 'bo-stable');
  });

  it('removes a participant whose Direct Rejoin Grant was revoked or belongs to another call', async () => {
    rooms.isDirectRejoinParticipantValid.mockResolvedValue(false);
    livekit.receiveWebhook.mockResolvedValue({
      event: 'participant_joined',
      room: { name: 'standup', sid: 'RM_new' },
      participant: { identity: 'bo-stable', metadata: directMetadata },
    });

    await controller.receive(request());

    expect(livekit.removeParticipant).toHaveBeenCalledWith('standup', 'bo-stable');
    expect(livekit.stampStartedAt).not.toHaveBeenCalled();
    expect(remoteControl.onParticipantJoined).not.toHaveBeenCalled();
  });

  it('passes the finished room SID to grant cleanup', async () => {
    livekit.directRejoinMetadata.mockReturnValue(null);
    livekit.receiveWebhook.mockResolvedValue({
      event: 'room_finished',
      room: { name: 'standup', sid: 'RM_finished' },
    });

    await controller.receive(request());

    expect(rooms.onRoomFinished).toHaveBeenCalledWith('standup', 'RM_finished');
    expect(remoteControl.onRoomFinished).toHaveBeenCalledWith('standup');
  });
});
