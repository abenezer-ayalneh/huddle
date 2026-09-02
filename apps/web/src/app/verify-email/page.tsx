import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';
import { VerificationLoadingState } from './VerificationPageShell';

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
  return <VerificationLoadingState />;
}
