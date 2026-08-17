'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import HuddleIcon from '@/components/HuddleIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import { publicConfig } from '@/lib/public-config';

const AUTH_URL = publicConfig.authUrl;
const MIN_LOADING_MS = 700;

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setError('This verification link is missing its token.');
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
          return;
        }

        router.replace('/lobby');
      } catch {
        if (!cancelled) setError("We couldn't reach Huddle to verify your email. Check your connection and try again.");
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (error) {
    return (
      <VerificationShell
        icon={<TriangleAlert className="size-7 text-magenta" />}
        title="Verification failed"
        body={error}
        footer={
          <Link
            href="/lobby"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-magenta px-4 font-display font-semibold text-black transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
          >
            Back to lobby
          </Link>
        }
      />
    );
  }

  return (
    <VerificationShell
      icon={<CheckCircle2 className="size-7 text-cyan" />}
      title="Verifying"
      body="Hang tight while Huddle confirms your email."
      footer={<LoadingSpinner className="mx-auto size-8" />}
    />
  );
}

function VerificationShell({ icon, title, body, footer }: { icon: ReactNode; title: string; body: string; footer: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-drift absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-magenta/20 blur-[120px]" />
        <div className="animate-drift absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan/15 blur-[120px] [animation-delay:5s]" />
      </div>

      <div className="glass-strong w-full max-w-sm rounded-2xl p-8 text-center shadow-[0_8px_60px_oklch(0_0_0/0.5)]">
        <Link href="/" aria-label="Huddle home" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60">
          <HuddleIcon className="size-12" />
        </Link>
        <div className="mx-auto mt-6 flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">{icon}</div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/55">{body}</p>
        <div className="mt-6">{footer}</div>
      </div>
    </main>
  );
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
