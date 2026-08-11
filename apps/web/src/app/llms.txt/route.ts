import { publicConfig } from '@/lib/public-config';

export const dynamic = 'force-static';

export function GET() {
  const release = publicConfig.controlAgentRelease;
  const body = `# Huddle

Huddle is self-hosted, browser-based video conferencing built on LiveKit.

## Deployment

- **Operator:** ${publicConfig.operatorName}
- **Operator contact:** ${publicConfig.operatorContactUrl}
- **Repository:** ${publicConfig.projectRepositoryUrl}
- **Deployment:** ${publicConfig.siteUrl}
- **Control Agent downloads:** ${release ? 'Configured signed release channel' : 'Unavailable until the operator configures a signed release'}

## Product boundaries

- Hosts create and manage rooms; Guests join from Room Code links and require admission.
- Media stays in the deployment's self-hosted LiveKit infrastructure.
- Recording storage, retention, Drive delivery, and observability are operator-configured.
- Remote Control is attended, room-scoped, macOS-only, consent-based, and never unattended.
- Operators must review and adopt their own privacy notice and terms before public use.
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
