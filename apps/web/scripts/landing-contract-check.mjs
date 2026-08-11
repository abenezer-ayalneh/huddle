import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function requireText(relativePath, ...needles) {
  const contents = read(relativePath);
  for (const needle of needles) {
    assert.ok(contents.includes(needle), `${relativePath} is missing ${needle}`);
  }
}

function requireFile(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} does not exist`);
  assert.ok(fs.statSync(absolutePath).size > 0, `${relativePath} is empty`);
}

requireText(
  'apps/web/src/app/LandingPageClient.tsx',
  'Meet, then <em>work together.</em>',
  'Remote Control',
  'illustrative portraits',
  'IntersectionObserver',
  'aria-current={isActive ? \'location\' : undefined}',
);
requireText(
  'apps/web/src/components/landing/LandingStory.tsx',
  'data-testid="landing-story"',
  'role="tablist"',
  'prefers-reduced-motion',
  'data-stage',
);
requireText('apps/web/src/app/LandingJoinForm.tsx', 'export function roomFromInput', 'Room code or meeting link');
requireText(
  'apps/web/src/app/globals.css',
  '.landing-shell',
  "html[data-theme='dark'] .landing-shell",
  '.landing-nav-links a.is-active',
  'backdrop-filter: blur(10px) saturate(135%)',
  'prefers-reduced-motion: reduce',
);
assert.doesNotMatch(read('apps/web/src/app/globals.css'), /Exo 2|Rajdhani/);
requireText('apps/web/src/app/layout.tsx', 'huddle-theme', 'Archivo', 'IBM Plex Mono');
requireText('apps/web/src/app/layout.tsx', '/favicon-dark.svg?v=3', 'prefers-color-scheme: dark');
requireText('LICENSE', 'Apache License', 'Version 2.0');
requireText('NOTICE', 'Apache-2.0', 'Archivo', 'IBM Plex Mono');
requireText('docs/OWNERSHIP_AND_DEPENDENCY_AUDIT.md', 'Project ownership', 'Direct dependency review');
requireText('docs/adr/0030-apache-2-license-and-self-hosted-adoption.md', '**Status:** Accepted');

for (const relativePath of [
  'apps/web/public/landing-portraits/maya.png',
  'apps/web/public/landing-portraits/jun.png',
  'apps/web/public/landing-portraits/priya.png',
  'apps/web/public/landing-portraits/andre.png',
  'apps/web/public/social-preview.svg',
  'apps/web/public/opengraph-image.png',
  'apps/web/public/twitter-image.png',
  'apps/web/public/icon-512.png',
  'apps/web/public/icon-maskable-512.png',
  'apps/web/public/favicon-dark.svg',
  'apps/web/public/favicon-dark-16x16.png',
  'apps/web/public/favicon-dark-32x32.png',
  'apps/web/public/favicon-dark.ico',
]) {
  requireFile(relativePath);
}

for (const obsoleteAsset of ['landing-hero.png', 'landing-orbit.png', 'landing-control.png']) {
  assert.equal(fs.existsSync(path.join(repositoryRoot, 'apps/web/public', obsoleteAsset)), false, `${obsoleteAsset} is obsolete`);
}

assert.equal(fs.existsSync(path.join(repositoryRoot, 'apps/web/src/app/favicon.ico')), false, 'The App Router favicon route would override theme-aware favicon metadata.');

console.log('Landing contract checks passed.');
