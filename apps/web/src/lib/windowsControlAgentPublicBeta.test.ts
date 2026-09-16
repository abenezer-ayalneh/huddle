import { describe, expect, it } from 'vitest';
import { getWindowsControlAgentPublicBeta } from './windowsControlAgentPublicBeta';

describe('getWindowsControlAgentPublicBeta', () => {
  const completeRelease = (tag: string) => ({
    draft: false,
    tag_name: tag,
    assets: [
      'Huddle-Control-Agent-windows-x64.exe',
      'Huddle-Control-Agent-windows-x64.exe.sha256',
      'Huddle-Control-Agent-windows-arm64.exe',
      'Huddle-Control-Agent-windows-arm64.exe.sha256',
    ].map((name) => ({ name })),
  });

  it('uses the newest complete dual-architecture prerelease for a canonical repository URL', async () => {
    const fetchReleaseList = async () => new Response(JSON.stringify([completeRelease('windows-control-agent-v0.1.1')]));

    await expect(getWindowsControlAgentPublicBeta('https://github.com/abenezer-ayalneh/huddle/', fetchReleaseList as typeof fetch)).resolves.toEqual({
      x64: {
        downloadUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-v0.1.1/Huddle-Control-Agent-windows-x64.exe',
        checksumUrl:
          'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-v0.1.1/Huddle-Control-Agent-windows-x64.exe.sha256',
      },
      arm64: {
        downloadUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-v0.1.1/Huddle-Control-Agent-windows-arm64.exe',
        checksumUrl:
          'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-v0.1.1/Huddle-Control-Agent-windows-arm64.exe.sha256',
      },
    });
  });

  it('skips incomplete releases and does not derive public download URLs from non-repository URLs', async () => {
    const fetchReleaseList = async () => new Response(JSON.stringify([{ draft: false, tag_name: 'windows-control-agent-v0.1.2', assets: [] }]));

    await expect(getWindowsControlAgentPublicBeta('https://github.com/abenezer-ayalneh/huddle', fetchReleaseList as typeof fetch)).resolves.toBeNull();
    await expect(getWindowsControlAgentPublicBeta('https://downloads.example.com/huddle')).resolves.toBeNull();
    await expect(getWindowsControlAgentPublicBeta('https://github.com/abenezer-ayalneh')).resolves.toBeNull();
  });
});
