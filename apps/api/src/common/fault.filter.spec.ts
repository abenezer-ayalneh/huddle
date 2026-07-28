import { ArgumentsHost, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { FaultFilter } from './fault.filter';
import { FaultCode, faultBody } from './faults';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

// Capture what the filter writes back: the HTTP status and the JSON body.
function mockHost(): { host: ArgumentsHost; sent: () => { status: number; body: unknown } } {
  let status = 0;
  let body: unknown;
  const res = {
    status: (s: number) => {
      status = s;
      return res;
    },
    json: (b: unknown) => {
      body = b;
      return res;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  return { host, sent: () => ({ status, body }) };
}

describe('FaultFilter', () => {
  const filter = new FaultFilter();
  // Silence the deliberate error/debug logging during the test run.
  beforeAll(() => {
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'debug').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.mocked(Sentry.captureException).mockClear();
  });

  it('shapes an exception carrying a faultBody into the envelope', () => {
    const { host, sent } = mockHost();
    filter.catch(new ForbiddenException(faultBody(FaultCode.NOT_HOST, 'You are not the host')), host);
    expect(sent()).toEqual({ status: 403, body: { code: 'NOT_HOST', message: 'You are not the host', statusCode: 403 } });
  });

  it('maps a ValidationPipe-style 400 (message array) to VALIDATION', () => {
    const { host, sent } = mockHost();
    filter.catch(new BadRequestException({ message: ['name should not be empty'], error: 'Bad Request', statusCode: 400 }), host);
    expect(sent()).toEqual({ status: 400, body: { code: 'VALIDATION', message: 'name should not be empty', statusCode: 400 } });
  });

  it('passes through a custom error body that documents its own shape (/ready)', () => {
    const { host, sent } = mockHost();
    const checks = { postgres: 'ok', redis: 'down' };
    filter.catch(new ServiceUnavailableException({ status: 'unavailable', checks }), host);
    expect(sent()).toEqual({ status: 503, body: { status: 'unavailable', checks } });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(ServiceUnavailableException),
      expect.objectContaining({
        tags: { 'fault.code': 'INTERNAL', 'http.status_code': '503' },
      }),
    );
  });

  it('turns an unknown (non-HTTP) error into an opaque 500 INTERNAL', () => {
    const { host, sent } = mockHost();
    filter.catch(new Error('boom: secret connection string'), host);
    expect(sent()).toEqual({ status: 500, body: { code: 'INTERNAL', message: 'Internal server error', statusCode: 500 } });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { 'fault.code': 'INTERNAL', 'http.status_code': '500' },
      }),
    );
  });

  it('does not report expected 4xx domain outcomes to Sentry', () => {
    const { host } = mockHost();
    filter.catch(new ForbiddenException(faultBody(FaultCode.NOT_HOST, 'You are not the host')), host);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
