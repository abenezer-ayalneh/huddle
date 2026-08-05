import { InternalServerErrorException } from '@nestjs/common';
import { StorageConnectionsController } from './storage-connections.controller';

describe('StorageConnectionsController Google Drive callback', () => {
  const connections = { completeGoogleDrive: jest.fn() };
  const delivery = { resumeActionRequired: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
  const response = { redirect: jest.fn() };
  const controller = new StorageConnectionsController(connections as never, delivery as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects after a completed connection', async () => {
    connections.completeGoogleDrive.mockResolvedValue('host-1');

    await controller.callback('state', 'code', response as never);

    expect(delivery.resumeActionRequired).toHaveBeenCalledWith('host-1');
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:3000/recordings?drive=connected');
  });

  it('logs a safe callback failure before returning the generic error outcome', async () => {
    connections.completeGoogleDrive.mockRejectedValue(new InternalServerErrorException('Cloud credential encryption is not configured'));
    const warn = jest.spyOn((controller as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn').mockImplementation(() => undefined);

    await controller.callback('state', 'code', response as never);

    expect(warn).toHaveBeenCalledWith('Google Drive OAuth callback failed (HTTP 500): Cloud credential encryption is not configured');
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:3000/recordings?drive=error');
  });
});
