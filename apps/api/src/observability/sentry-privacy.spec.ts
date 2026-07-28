import type { ErrorEvent } from '@sentry/nestjs';
import { scrubSentryBreadcrumb, scrubSentryEvent } from './sentry-privacy';

describe('Sentry privacy scrubbing', () => {
  it('removes request PII and parameterizes room-scoped URLs', () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { email: 'person@example.com' },
      request: {
        url: 'https://api.example.com/rooms/private-room/recordings/egress-123?token=secret',
        query_string: 'token=secret',
        cookies: { session: 'secret' },
        headers: { authorization: 'Bearer secret' },
        data: { displayName: 'Private person' },
      },
    };

    expect(scrubSentryEvent(event)).toMatchObject({
      user: undefined,
      request: {
        url: 'https://api.example.com/rooms/[room]/recordings/[recording]',
        query_string: undefined,
        cookies: undefined,
        headers: undefined,
        data: undefined,
      },
    });
  });

  it('drops console breadcrumbs and redacts sensitive text', () => {
    expect(scrubSentryBreadcrumb({ category: 'console', message: 'person@example.com' })).toBeNull();
    expect(
      scrubSentryBreadcrumb({
        category: 'http',
        message: 'request for person@example.com',
        data: {
          url: 'https://app.example.com/rooms/private-room?hostKey=secret',
          method: 'GET',
          request_body: 'private',
        },
      }),
    ).toEqual({
      category: 'http',
      message: 'request for [redacted-email]',
      data: {
        url: 'https://app.example.com/rooms/[room]',
        method: 'GET',
      },
    });
  });
});
