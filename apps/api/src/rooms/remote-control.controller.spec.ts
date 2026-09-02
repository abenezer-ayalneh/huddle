import { HEADERS_METADATA } from '@nestjs/common/constants';
import { RemoteControlController } from './remote-control.controller';

describe('RemoteControlController cache policy', () => {
  it.each(['getPendingRequest', 'getRequest'] as const)('marks %s responses private and non-storable', (method) => {
    expect(Reflect.getMetadata(HEADERS_METADATA, RemoteControlController.prototype[method])).toContainEqual({
      name: 'Cache-Control',
      value: 'private, no-store',
    });
  });
});
