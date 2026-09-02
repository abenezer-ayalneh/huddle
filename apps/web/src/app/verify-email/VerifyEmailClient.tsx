'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { publicConfig } from '@/lib/public-config';
import VerificationPageShell, { type VerificationTone } from './VerificationPageShell';

const AUTH_URL = publicConfig.authUrl;
const MIN_LOADING_MS = 700;

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [tone, setTone] = useState<VerificationTone>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setError('This verification link is missing its token.');
        setTone('error');
        return;
      }

      const startedAt = Date.now();

      try {
        const url = new URL('/api/auth/verify-email', AUTH_URL);
        url.searchParams.set('token', token);

        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_LOADING_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
        }

        if (cancelled) return;

        if (!response.ok) {
          setError(await verificationError(response));
          setTone('error');
          return;
        }

        setTone('success');
        window.setTimeout(() => {
          if (!cancelled) router.replace('/lobby');
        }, 900);
      } catch {
        if (!cancelled) {
          setError("We couldn't reach Huddle to verify your email. Check your connection and try again.");
          setTone('error');
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (error) {
    return (
      <VerificationPageShell
        tone="error"
        title="Verification failed"
        body={error}
      >
        <Link href="/lobby" className="verify-email-primary-action">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to lobby
        </Link>
      </VerificationPageShell>
    );
  }

  if (tone === 'success') {
    return (
      <VerificationPageShell tone="success" title="Email verified" body="Your Huddle account is confirmed. Taking you to the lobby now.">
        <p className="verify-email-next-step" role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Opening lobby
        </p>
      </VerificationPageShell>
    );
  }

  return <VerificationPageShell tone="pending" title="Verifying" body="Hang tight while Huddle confirms your email." ariaBusy />;
}

async function verificationError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
  const detail = `${body?.code ?? ''} ${body?.message ?? ''}`;

  if (/expired/i.test(detail)) {
    return 'This verification link has expired. Return to the lobby and sign in to request a fresh email.';
  }
  if (/invalid|token|not found/i.test(detail)) {
    return 'This verification link is invalid or has already been used.';
  }
  return 'Huddle could not verify this email link. Return to the lobby and try signing in again.';
}
