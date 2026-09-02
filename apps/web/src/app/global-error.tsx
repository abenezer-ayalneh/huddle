'use client'; // Error boundaries must be Client Components.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import ErrorSurface from '@/components/errors/ErrorSurface';

// Last-resort boundary for a crash in the root layout itself (docs/adr/0018).
// It replaces the root layout, so it owns the document shell and uses a
// self-contained Signal Handoff surface instead of app providers or CSS.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { 'error.boundary': 'global' },
    });
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ErrorSurface kind="global" digest={error.digest} onRetry={unstable_retry} />
      </body>
    </html>
  );
}
