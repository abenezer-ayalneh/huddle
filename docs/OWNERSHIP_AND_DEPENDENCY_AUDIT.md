# Ownership and dependency audit

Date: 2026-08-06

## Project ownership

- Huddle source, landing implementation, documentation, and original product
  assets are authored for Abenezer Ayalneh.
- The repository is licensed under Apache-2.0. The full text is in `LICENSE`.
- Huddle names, marks, visual identity, website copy, and the official
  evaluation deployment are not granted as trademarks by the source license.
- The official deployment at `https://huddle.abenezer-ayalneh.dev` is a
  capacity-limited evaluation demo. Production operators provide their own
  infrastructure, storage, provider accounts, and operational policies.

## Direct dependency review

The root `package.json`, `apps/web/package.json`, `apps/api/package.json`, and
`pnpm-lock.yaml` define the versioned dependency set. The package metadata is the
first source for each dependency's current license; any package-specific license
file or notice shipped under `node_modules` remains authoritative.

| Area | Examples | Review boundary |
| --- | --- | --- |
| Web runtime | Next.js, React, Tailwind, TypeScript | Keep package license and notices with any redistributed build artifacts. |
| Live media | `livekit-client`, `@livekit/components-react`, `livekit-server-sdk` | Preserve LiveKit's Apache-2.0 attribution and its dependency notices. |
| API/runtime | NestJS, Prisma, Better Auth, AWS SDK, Sentry, Redis client | Re-check transitive package notices after upgrades. |
| Icons | `lucide-react` | Preserve ISC attribution. |
| Fonts | Archivo, Archivo Black, IBM Plex Mono | Preserve SIL OFL 1.1 notices; these files are vendored locally. |
| Native agent | LiveKit Swift SDK vendor tree | Keep the vendor-provided LICENSE/NOTICE files; native Agent icon/UI are outside this landing redesign. |

## Review procedure

1. Inspect package manifests and `pnpm-lock.yaml` for every direct dependency.
2. Inspect the installed package metadata and license/notice files for any
   package added or upgraded.
3. Update `NOTICE` and this table when a direct dependency changes its license
   or adds a required attribution.
4. Run `pnpm install --frozen-lockfile` and the repository quality gates before
   distributing a build.

This audit is intentionally evidence-bounded: it does not claim that a package
is permissive merely because its name is familiar, and it does not relicense
third-party code under Apache-2.0.
