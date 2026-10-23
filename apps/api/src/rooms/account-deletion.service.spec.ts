import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  const prisma = {
    accountDeletion: { findFirst: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
    session: { deleteMany: jest.fn() },
    user: { findUnique: jest.fn(), delete: jest.fn() },
    recordingDelivery: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const livekit = {
    listActiveRooms: jest.fn(),
    listConnectedParticipants: jest.fn(),
    matchesAccountBinding: jest.fn(),
    removeAccountParticipants: jest.fn(),
    endRoom: jest.fn(),
  };
  const egress = { stop: jest.fn() };
  const remoteControl = { onRoomFinished: jest.fn(), onParticipantLeft: jest.fn() };
  const storage = { deleteObject: jest.fn() };
  const connections = { disconnectForAccountDeletion: jest.fn() };
  const roomState = { removePendingKnocksForUser: jest.fn() };
  const service = new AccountDeletionService(
    prisma as never,
    livekit as never,
    egress as never,
    remoteControl as never,
    storage as never,
    connections as never,
    roomState as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    livekit.listActiveRooms.mockResolvedValue([]);
    livekit.listConnectedParticipants.mockResolvedValue([]);
    livekit.matchesAccountBinding.mockReturnValue(false);
    livekit.removeAccountParticipants.mockResolvedValue(undefined);
    livekit.endRoom.mockResolvedValue(undefined);
    connections.disconnectForAccountDeletion.mockResolvedValue(undefined);
    storage.deleteObject.mockResolvedValue(undefined);
  });

  it('durably queues deletion and revokes every sign-in session immediately', async () => {
    prisma.accountDeletion.upsert.mockResolvedValue({});
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });

    await expect(service.request('user-1')).resolves.toEqual({ accepted: true });

    expect(prisma.accountDeletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', status: 'pending' },
      }),
    );
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('leaves the account and recordings in place while a Drive upload lease is active', async () => {
    prisma.accountDeletion.findFirst.mockResolvedValue({ userId: 'user-1', status: 'pending' });
    prisma.accountDeletion.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ image: null, rooms: [] });
    prisma.recordingDelivery.findFirst.mockResolvedValue({ id: 'delivery-1' });

    await service.runCycle();

    expect(prisma.accountDeletion.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: 'pending', lastError: 'Waiting for an active Drive delivery to stop' },
      }),
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(connections.disconnectForAccountDeletion).not.toHaveBeenCalled();
  });

  it('removes Huddle state and account rows after owned-room cleanup succeeds', async () => {
    const tx = { session: { deleteMany: jest.fn() }, user: { delete: jest.fn() } };
    prisma.accountDeletion.findFirst.mockResolvedValue({ userId: 'user-1', status: 'pending' });
    prisma.accountDeletion.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ image: null, rooms: [] });
    prisma.recordingDelivery.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => Promise<void>) => callback(tx));

    await service.runCycle();

    expect(connections.disconnectForAccountDeletion).toHaveBeenCalledWith('user-1');
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(prisma.accountDeletion.updateMany).toHaveBeenCalledTimes(1);
  });

  it('ends the deleting account’s remote-control sessions before disconnecting its meeting participants', async () => {
    const tx = { session: { deleteMany: jest.fn() }, user: { delete: jest.fn() } };
    const cleanupOrder: string[] = [];
    remoteControl.onParticipantLeft.mockImplementation(() => {
      cleanupOrder.push('remote-control');
      return Promise.resolve();
    });
    livekit.removeAccountParticipants.mockImplementation(() => {
      cleanupOrder.push('disconnect');
      return Promise.resolve();
    });
    livekit.listActiveRooms.mockResolvedValue([{ name: 'shared-room' }]);
    livekit.listConnectedParticipants.mockResolvedValue([{ identity: 'guest-1', accountBinding: 'bound-user' }]);
    livekit.matchesAccountBinding.mockReturnValue(true);
    prisma.accountDeletion.findFirst.mockResolvedValue({ userId: 'user-1', status: 'pending' });
    prisma.accountDeletion.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ image: null, rooms: [] });
    prisma.recordingDelivery.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => Promise<void>) => callback(tx));

    await service.runCycle();

    expect(remoteControl.onParticipantLeft).toHaveBeenCalledWith('shared-room', 'guest-1');
    expect(cleanupOrder).toEqual(['remote-control', 'disconnect']);
  });
});
