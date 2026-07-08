import type { Metadata } from 'next';
import { Suspense } from 'react';
import HuddleIcon from '@/components/HuddleIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import VerifyEmailClient from './VerifyEmailClient';

export const metadata: Metadata = {
  title: 'Verifying email',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyingFallback />}>
      <VerifyEmailClient />
    </Suspense>
  );
}

function VerifyingFallback() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="glass-strong w-full max-w-sm rounded-2xl p-8 text-center shadow-[0_8px_60px_oklch(0_0_0/0.5)]">
        <HuddleIcon className="mx-auto size-12" />
        <LoadingSpinner className="mx-auto mt-6 size-8" />
        <h1 className="mt-5 font-display text-2xl font-semibold text-white">Verifying</h1>
        <p className="mt-2 text-sm text-white/55">Hang tight while Huddle confirms your email.</p>
      </div>
    </main>
  );
}
