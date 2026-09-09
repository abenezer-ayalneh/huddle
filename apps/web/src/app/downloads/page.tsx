import type { Metadata } from 'next';
import DownloadsPageClient from './DownloadsPageClient';
import { getControlAgentRelease } from '@/lib/controlAgentRelease';
import { CONTROL_AGENT_RELEASE } from '@/lib/controlAgentReleaseShared';
import { publicConfig } from '@/lib/public-config';
import { getWindowsControlAgentRelease } from '@/lib/windowsControlAgentRelease';
import { WINDOWS_CONTROL_AGENT_RELEASE } from '@/lib/windowsControlAgentReleaseShared';

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

export const revalidate = 3600;

export default async function DownloadsPage() {
  const [release, windowsRelease] = await Promise.all([getControlAgentRelease(), getWindowsControlAgentRelease()]);

  return (
    <DownloadsPageClient
      release={release}
      windowsRelease={windowsRelease}
      repositoryUrl={publicConfig.projectRepositoryUrl}
      operatorContactUrl={publicConfig.operatorContactUrl}
      releaseNotesFallbackUrl={CONTROL_AGENT_RELEASE?.releasesUrl ?? null}
      issuesUrl={CONTROL_AGENT_RELEASE?.issuesUrl ?? null}
      windowsReleaseNotesFallbackUrl={WINDOWS_CONTROL_AGENT_RELEASE?.releasesUrl ?? null}
      windowsIssuesUrl={WINDOWS_CONTROL_AGENT_RELEASE?.issuesUrl ?? null}
    />
  );
}
