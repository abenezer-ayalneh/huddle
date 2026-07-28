'use client'; // Error boundaries must be Client Components.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

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

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="glass-strong w-full max-w-md rounded-2xl p-8 text-center shadow-[0_8px_60px_oklch(0_0_0/0.5)]">
        <h1 className="font-display text-2xl font-bold text-white">Something broke</h1>
        <p className="mt-3 text-sm text-white/65">An unexpected error interrupted this page. Trying again often clears it.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 rounded-lg bg-cyan/15 px-4 py-2 text-sm font-medium text-cyan ring-1 ring-cyan/40 transition-all hover:bg-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
