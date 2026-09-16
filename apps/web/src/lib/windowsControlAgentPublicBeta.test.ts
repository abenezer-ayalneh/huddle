import { describe, expect, it } from 'vitest';
import { getWindowsControlAgentPublicBeta } from './windowsControlAgentPublicBeta';

describe('getWindowsControlAgentPublicBeta', () => {
  it('uses the released architecture-specific prerelease assets for a canonical repository URL', () => {
    expect(getWindowsControlAgentPublicBeta('https://github.com/abenezer-ayalneh/huddle/')).toEqual({
      x64: {
        downloadUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-x64-v0.1.0/Huddle-Control-Agent-windows-x64.exe',
        checksumUrl:
          'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-x64-v0.1.0/Huddle-Control-Agent-windows-x64.exe.sha256',
      },
      arm64: {
        downloadUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-arm64-v0.1.0/Huddle-Control-Agent-windows-arm64.exe',
        checksumUrl:
          'https://github.com/abenezer-ayalneh/huddle/releases/download/windows-control-agent-arm64-v0.1.0/Huddle-Control-Agent-windows-arm64.exe.sha256',
      },
    });
  });

  it('does not derive public download URLs from non-GitHub or non-repository URLs', () => {
    expect(getWindowsControlAgentPublicBeta('https://downloads.example.com/huddle')).toBeNull();
    expect(getWindowsControlAgentPublicBeta('https://github.com/abenezer-ayalneh')).toBeNull();
  });
});
