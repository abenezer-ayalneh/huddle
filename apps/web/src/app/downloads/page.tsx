import type { Metadata } from 'next';
import DownloadsPageClient from './DownloadsPageClient';
import { publicConfig } from '@/lib/public-config';
import { getWindowsControlAgentPublicBeta } from '@/lib/windowsControlAgentPublicBeta';

/**
 * THESIS: make selecting a native companion feel deliberate, not incidental.
 * OWN-WORLD: warm release dossier, purple structural shadows, yellow live signal.
 * STORY: a Sharer finds the right build and understands the attended boundary.
 * FIRST VIEWPORT: safety promise left; architecture-specific release station right.
 * FORM: Signal Handoff public release dossier, staged from approved composition A.
 */
export const metadata: Metadata = {
  title: 'Control Agent downloads',
  description: 'Download the Huddle Control Agent public beta for attended macOS or Windows Remote Control.',
  alternates: { canonical: '/downloads' },
};

// GitHub's release list is the source for the current Windows installer.
export const revalidate = 60;

export default async function DownloadsPage() {
  const windowsPublicBeta = await getWindowsControlAgentPublicBeta(publicConfig.projectRepositoryUrl);

  return (
    <DownloadsPageClient
      windowsPublicBeta={windowsPublicBeta}
      repositoryUrl={publicConfig.projectRepositoryUrl}
      operatorContactUrl={publicConfig.operatorContactUrl}
    />
  );
}
