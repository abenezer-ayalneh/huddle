import { NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { FakeRedis } from '../redis/fake-redis';
import { ControlAgentService } from './control-agent.service';
import type { LivekitService } from './livekit.service';

describe('ControlAgentService', () => {
  let service: ControlAgentService;
  let livekit: { mintAgentToken: jest.Mock; livekitUrl: string };

  beforeEach(() => {
    livekit = {
      mintAgentToken: jest.fn().mockResolvedValue('agent-jwt'),
      livekitUrl: 'ws://livekit:7880',
    };
    service = new ControlAgentService(new FakeRedis() as unknown as Redis, livekit as unknown as LivekitService);
  });

  it('mints a code that redeems into a scoped agent token', async () => {
    const link = await service.createLink('abz-mnpq-rfk', {
      identity: 'ada-1234',
      name: 'Ada',
    });
    expect(link.code).toBeTruthy();
    expect(link.expiresInSeconds).toBe(60);

    const redeemed = await service.redeem(link.code);
    expect(livekit.mintAgentToken).toHaveBeenCalledWith({
      room: 'abz-mnpq-rfk',
      presenterIdentity: 'ada-1234',
      presenterName: 'Ada',
    });
    expect(redeemed).toEqual({
      token: 'agent-jwt',
      livekitUrl: 'ws://livekit:7880',
      room: 'abz-mnpq-rfk',
      presenterIdentity: 'ada-1234',
      presenterName: 'Ada',
    });
  });

  it('codes are single-use — the second redeem fails', async () => {
    const link = await service.createLink('abz-mnpq-rfk', {
      identity: 'ada-1234',
      name: 'Ada',
    });
    await service.redeem(link.code);
    await expect(service.redeem(link.code)).rejects.toThrow(NotFoundException);
    expect(livekit.mintAgentToken).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown codes without minting anything', async () => {
    await expect(service.redeem('nope')).rejects.toThrow(NotFoundException);
    expect(livekit.mintAgentToken).not.toHaveBeenCalled();
  });

  it('issues a distinct code per link', async () => {
    const a = await service.createLink('room-a', { identity: 'x', name: 'X' });
    const b = await service.createLink('room-a', { identity: 'x', name: 'X' });
    expect(a.code).not.toBe(b.code);
  });
});
