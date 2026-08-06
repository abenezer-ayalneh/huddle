# Signal Handoff Landing-Page Redesign

Status: Approved design plan  
Date: 2026-08-06

## Summary

Redesign only Huddle's public landing experience as a long-form, team-first
showcase for agencies collaborating with clients. Position Huddle as
Apache-2.0 self-hosted software, with the official deployment described as a
capacity-limited evaluation demo.

The page leads with "Meet, then work together." and demonstrates an agency
website review through Meet -> Present -> Approve -> Collaborate. Existing
application layouts/colors and the macOS Control Agent remain unchanged until a
later approval phase.

## Visual System and Experience

- Create scoped light and dark landing palettes from
  [Convex's documented colors](https://www.convex.dev/brand):
  - Light: cream `#F6EEDB`, ink `#141414`, purple `#8D2676` primary,
    yellow `#F3B01C`, and critical red `#EE342F`.
  - Dark: chocolate `#1A0F0F`, warm white `#FAF4E9`, yellow primary,
    purple secondary, and critical red.
  - Derive warm surface, muted-text, border, focus, and hover tokens with
    WCAG 2.2 AA contrast per role.
- Replace Exo 2 and Rajdhani globally with the licensing-safe Convex families
  found on its [current site](https://www.convex.dev/): Archivo Black for
  display, Archivo for body/UI, and IBM Plex Mono for codes and technical
  labels. Vendor local WOFF2 files and licenses, remap existing font variables,
  then remove obsolete font assets only after every route passes layout checks.
- Add reusable theme infrastructure using
  `ThemePreference = 'light' | 'dark'`, `data-theme`, and the `huddle-theme`
  local-storage key. A first visit follows `prefers-color-scheme`; an explicit
  choice persists. Keep the existing `.dark` class for legacy routes so only
  the landing responds visually for now.
- Put an accessible sun/moon icon button inside a top-center sticky, floating,
  translucent pill navigation. Desktop includes section links, GitHub, and
  Deploy; mobile uses a disclosure menu and preserves theme/Deploy access.
- Preserve the four-dot/play Huddle geometry but recolor all web marks,
  favicons, manifest icons, and social previews. Leave the native Control Agent
  icon and UI untouched.
- Use structured 8-12px frames, selective pills, flat color fields, large
  sentence-case headlines, and three routed "signal handoff" lines. Do not use
  grain, scanlines, neon glow, generic card grids, or decorative gradients.

## Landing Narrative and Implementation

1. **Hero:** Use a left-side promise and Deploy/GitHub primary CTA, an
   evaluation-demo secondary CTA, and a visible Room Code/link field. Place a
   future-styled Huddle product scene on the right.
2. **Interactive product story:** Provide four keyboard-operable stages: Meet,
   Present, Approve, and Collaborate. Auto-advance once at a controlled
   interval, stop permanently after user interaction, and disable animation
   under reduced motion.
3. **Client entry:** Demonstrate shared link -> Device Check -> Knock -> Admit,
   emphasizing that Guests need neither an account nor meeting-app
   installation.
4. **Website review:** Show the real meeting model: camera tiles, presentation
   stage, chat, Host controls, and visible Recording. Build the scene with
   code-native UI rather than fabricated screenshots.
5. **Attended Remote Control:** The agency shares the staging site and runs the
   macOS Agent; the client stays in-browser, requests control, and explores
   after approval. Show 30-minute reconfirmation, either-party Stop, and bounded
   plain-text Clipboard Sharing without weakening file, audio, or unattended
   access exclusions.
6. **Decision delivery:** Explain visible Recording, local retention, optional
   private Google Drive delivery, and participant-controlled sharing without
   inventing compliance or durability claims.
7. **Infrastructure ownership:** Provide compact architecture proof for
   Next.js, NestJS, LiveKit, Redis, Postgres, MinIO, Caddy, and Docker Compose.
   Link to the repository quick start and detailed VPS deployment guide.
8. **Evaluation demo and close:** Clearly distinguish the full evaluation
   deployment from a production hosted service, then repeat Deploy, Try, and
   Join actions.
9. **Visible FAQ/footer:** Cover Guest accounts, deployment requirements,
   Apache licensing, demo limits, Remote Control installation, Recording
   storage, legal pages, GitHub, downloads, and contact.

Generate four coherent fictional warm-editorial agency/client portraits with
the built-in image workflow. Save optimized project assets locally, label the
scenario as illustrative where ambiguity is possible, and keep every interface
label and project screen code-native. Remove obsolete landing raster assets
after confirming no remaining references.

Before implementation, render three composition previews within the locked
Signal Handoff direction. The selected composition must retain the fixed
first-viewport structure and may vary only staging, not product claims, palette,
or scope.

## Interfaces, Product Truth, and Documentation

- Make no backend API, database, authentication, room, Recording, or Remote
  Control protocol changes.
- Add the client-only
  `LandingStoryStage = 'meet' | 'present' | 'approve' | 'collaborate'` and the
  reusable theme preference interface/provider.
- Update metadata and JSON-LD to describe self-hosted software, the evaluation
  demo, Apache-2.0 licensing, the code repository, and infrastructure costs.
  Remove the misleading "official free service" positioning.
- Add the full Apache-2.0 root license, an ownership/dependency audit, accurate
  NOTICE/third-party attribution material, and ADR 0030 explaining why
  permissive adoption was chosen over network copyleft. Follow
  [Apache's application guidance](https://www.apache.org/legal/apply-license.html).
- Reconcile `PRODUCT.md`, Terms, Privacy, README, and landing copy around
  self-hosted software plus an evaluation-only official deployment.
- Update `CONTEXT.md` with precise definitions for Landing Page, Lobby, and Live
  Demo.
- Update `AGENTS.md` and README to remove obsolete no-clipboard wording; keep
  ADR 0026's bounded, ephemeral plain-text contract.
- Replace the incumbent landing rules in `DESIGN.md` and its sidecar with
  scoped Signal Handoff rules while explicitly documenting the legacy dark
  application surfaces as pending migration.

## Test and Acceptance Plan

- Add focused Playwright coverage for:
  - system-theme initialization, saved override, reload persistence, and
    unavailable-storage fallback;
  - theme-button accessible name, keyboard behavior, and selected state;
  - all four hero stages, auto-advance cancellation, and reduced-motion
    behavior;
  - Room Code and full-URL parsing, validation, and navigation;
  - Deploy, demo, GitHub, and legal links;
  - no horizontal overflow at 390x844, 768x1024, 1280x720, and 1440x900.
- Add an automated accessibility scan for landmark structure, headings, labels,
  focus order, contrast-detectable failures, and control names. Treat this as
  regression coverage, not certification.
- Manually inspect both themes at all target viewports, including the sticky
  navigation, generated portraits, long-page rhythm, keyboard-only use,
  reduced motion, and no-flash startup.
- Smoke-test Lobby, Device Check, call, recordings, downloads, Privacy, and
  Terms to confirm the global font and web-mark migration causes no overflow or
  broken fallbacks.
- Run the Impeccable detector once after UI completion, then run formatting,
  `git diff --check`, lint, typecheck, API tests, Playwright tests, and the
  production build.
- Stop after the landing and shared foundation are verified. Redesigning the
  remaining application and native Agent is a separate approval phase;
  deployment, commit, and push are not included unless requested.
