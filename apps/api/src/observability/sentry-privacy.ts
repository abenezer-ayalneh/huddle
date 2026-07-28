import type { Breadcrumb, ErrorEvent } from '@sentry/nestjs';

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\b(Bearer\s+)[^\s,;]+/gi;
const SENSITIVE_QUERY_VALUE = /([?&](?:token|code|hostKey|bootstrap|secret|key)=)[^&#\s]+/gi;
const CONTROL_LINK = /huddle-control:\/\/\S+/gi;

function redactText(value: string): string {
  return value
    .replace(CONTROL_LINK, '[redacted-control-link]')
    .replace(BEARER, '$1[redacted]')
    .replace(SENSITIVE_QUERY_VALUE, '$1[redacted]')
    .replace(EMAIL, '[redacted-email]');
}

function parameterizePath(pathname: string): string {
  return pathname
    .replace(/\/rooms\/[^/]+/g, '/rooms/[room]')
    .replace(/\/recordings\/[^/]+/g, '/recordings/[recording]')
    .replace(/\/remote-control\/[^/]+/g, '/remote-control/[session]');
}

function sanitizeUrl(value: string): string {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
    const parsed = new URL(value, 'https://huddle.invalid');
    const path = parameterizePath(parsed.pathname);
    return absolute ? `${parsed.origin}${path}` : path;
  } catch {
    return redactText(value.split(/[?#]/, 1)[0] ?? '');
  }
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output can contain room names, email addresses, or provider error
  // payloads. The exception and stack remain the useful debugging signal.
  if (breadcrumb.category === 'console') return null;

  const data = breadcrumb.data;
  const safeData: Record<string, unknown> = {};
  if (data) {
    for (const key of ['method', 'status_code', 'from', 'to']) {
      if (data[key] !== undefined) safeData[key] = data[key];
    }
    if (typeof data.url === 'string') safeData.url = sanitizeUrl(data.url);
  }

  return {
    ...breadcrumb,
    message: typeof breadcrumb.message === 'string' ? redactText(breadcrumb.message) : breadcrumb.message,
    data: Object.keys(safeData).length > 0 ? safeData : undefined,
  };
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  event.user = undefined;

  if (event.request) {
    event.request = {
      ...event.request,
      url: typeof event.request.url === 'string' ? sanitizeUrl(event.request.url) : undefined,
      query_string: undefined,
      cookies: undefined,
      headers: undefined,
      data: undefined,
    };
  }

  event.message = typeof event.message === 'string' ? redactText(event.message) : event.message;
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({
      ...value,
      value: typeof value.value === 'string' ? redactText(value.value) : value.value,
    }));
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubSentryBreadcrumb).filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);

  return event;
}
