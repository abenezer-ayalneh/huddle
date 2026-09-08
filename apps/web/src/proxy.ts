import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Keep owner authentication and assets available even during maintenance.
  if (path.startsWith('/admin/maintenance') || path.startsWith('/verify-email')) return NextResponse.next();
  const api = process.env.MAINTENANCE_API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${api}/maintenance/status`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return NextResponse.next();
    const state = (await response.json()) as { phase: string };
    if (state.phase !== 'off') {
      const destination = new URL('/maintenance', request.url);
      const result = NextResponse.rewrite(destination, { status: 503 });
      result.headers.set('Cache-Control', 'no-store');
      result.headers.set('Retry-After', '60');
      result.headers.set('X-Robots-Tag', 'noindex');
      return result;
    }
  } catch {
    /* Reachability errors remain the existing fault flow. SSH override covers outages. */
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
