import { describe, expect, it } from 'vitest';
import { getNoCostControlAgentBeta } from './controlAgentFreeBeta';

describe('getNoCostControlAgentBeta', () => {
  it('uses only the permanent GitHub prerelease assets for a canonical repository URL', () => {
    expect(getNoCostControlAgentBeta('https://github.com/abenezer-ayalneh/huddle/')).toEqual({
      downloadUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/control-agent-free-beta/Huddle-Control-Agent-macos-arm64.dmg',
      checksumUrl: 'https://github.com/abenezer-ayalneh/huddle/releases/download/control-agent-free-beta/Huddle-Control-Agent-macos-arm64.dmg.sha256',
    });
  });

  it('does not derive a public download URL from non-GitHub or non-repository URLs', () => {
    expect(getNoCostControlAgentBeta('https://downloads.example.com/huddle')).toBeNull();
    expect(getNoCostControlAgentBeta('https://github.com/abenezer-ayalneh')).toBeNull();
  });
});
