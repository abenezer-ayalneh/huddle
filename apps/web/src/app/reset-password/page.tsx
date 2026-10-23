import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export const metadata: Metadata = {
  title: 'Set your password',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#0b1015] p-6 text-white">Loading password form…</main>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
