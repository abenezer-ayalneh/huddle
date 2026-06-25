'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';

// Last-resort boundary for a crash in the root layout itself (docs/adr/0018).
// It replaces the root layout, so it must render its own <html>/<body> and can't
// rely on the app's fonts/providers. Kept deliberately minimal and self-contained.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, padding: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Something broke</h1>
          <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(229,231,235,0.65)' }}>The app hit an unexpected error. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 24,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#22d3ee',
              background: 'rgba(34,211,238,0.15)',
              border: '1px solid rgba(34,211,238,0.4)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
