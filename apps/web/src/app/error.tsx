'use client'; // Error boundaries must be Client Components.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import ErrorSurface from '@/components/errors/ErrorSurface';

// Route-level render-crash fallback (docs/adr/0018). Catches anything that
// escapes the scoped in-call <ErrorBoundary> wrappers for a route segment. The
// root layout (and so FaultLayer) stays mounted above this; a crash in the very
// root is handled by global-error.tsx instead.
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { 'error.boundary': 'route' },
    });
    console.error('[route error]', error);
  }, [error]);

  return <ErrorSurface kind="route" digest={error.digest} onRetry={unstable_retry} />;
}
