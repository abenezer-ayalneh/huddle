---
name: Huddle Web
description: A scoped Signal Handoff landing surface beside the legacy Neon Switchboard application routes.
colors:
  command-magenta: 'oklch(0.66 0.27 350)'
  consent-cyan: 'oklch(0.82 0.15 200)'
  operator-background: 'oklch(0.15 0.02 280)'
  high-signal: 'oklch(0.97 0.01 250)'
  on-command: 'oklch(0.99 0 0)'
  on-consent: 'oklch(0.18 0.03 240)'
  glass-card: 'oklch(0.2 0.025 285)'
  deep-popover: 'oklch(0.19 0.025 285)'
  secondary-surface: 'oklch(0.26 0.03 285)'
  muted-surface: 'oklch(0.24 0.02 285)'
  quiet-copy: 'oklch(0.72 0.03 270)'
  destructive-red: 'oklch(0.62 0.24 18)'
  hairline-static: 'oklch(0.92 0.05 320 / 14%)'
typography:
  display:
    fontFamily: '"Exo 2", "Exo 2 Fallback", sans-serif'
    fontSize: '3rem'
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: 'normal'
  headline:
    fontFamily: '"Exo 2", "Exo 2 Fallback", sans-serif'
    fontSize: '2.25rem'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-0.01em'
  title:
    fontFamily: '"Exo 2", "Exo 2 Fallback", sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Rajdhani, "Rajdhani Fallback", sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  action:
    fontFamily: '"Exo 2", "Exo 2 Fallback", sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Rajdhani, "Rajdhani Fallback", sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 'normal'
  mono:
    fontFamily: 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, monospace'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: '0.16em'
rounded:
  sm: '7.2px'
  md: '9.6px'
  lg: '12px'
  xl: '16.8px'
  2xl: '21.6px'
  full: '9999px'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '20px'
  6: '24px'
  8: '32px'
components:
  button-primary:
    backgroundColor: '{colors.command-magenta}'
    textColor: '{colors.operator-background}'
    typography: '{typography.action}'
    rounded: '{rounded.md}'
    padding: '12px 20px'
  button-secondary:
    backgroundColor: 'oklch(1 0 0 / 8%)'
    textColor: '{colors.high-signal}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '12px 20px'
  text-field:
    backgroundColor: 'oklch(1 0 0 / 5%)'
    textColor: '{colors.high-signal}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
  glass-panel:
    backgroundColor: 'oklch(0.2 0.025 285 / 62%)'
    textColor: '{colors.high-signal}'
    rounded: '{rounded.lg}'
    padding: '24px'
  call-control-active:
    backgroundColor: 'oklch(0.82 0.15 200 / 15%)'
    textColor: '{colors.consent-cyan}'
    rounded: '{rounded.full}'
    size: '44px'
  status-rail:
    backgroundColor: 'oklch(0.17 0.025 285 / 82%)'
    textColor: '{colors.high-signal}'
    rounded: '{rounded.xl}'
    padding: '8px 16px'
  video-tile:
    backgroundColor: 'oklch(0.12 0.02 280)'
    textColor: '{colors.high-signal}'
    width: '100%'
    height: '100%'
  navigation:
    backgroundColor: 'transparent'
    textColor: '{colors.high-signal}'
    height: '72px'
    padding: '0 32px'
---

# Design System: Huddle Web

## Overview

**Creative North Star: "The Neon Switchboard"**

Huddle's application routes remain a dark operator surface for real-time work. The public landing and legal-document surfaces use a separate Signal Handoff world: warm editorial fields explain how a meeting becomes shared work, while dossier-like policy pages make responsibility and data boundaries readable. The public surfaces are expressive, but never so decorative that product truth or deployment boundaries become harder to read.

Marketing surfaces may open the visual world with orbital imagery, dot lattices, and spacious type. Operative surfaces compress that same world into glass panels, concise status rails, clipped media tiles, and compact controls. Depth is layered and structural; neon is reserved for priority, focus, active state, and acknowledgement.

The legacy application system is intentionally dark-only. Signal Handoff is the approved public-surface exception: the landing and legal dossiers support light cream and dark chocolate themes through scoped tokens so they can follow a visitor's preference without migrating the call UI.

**Key Characteristics:**

- Dark violet-black canvases with restrained magenta and cyan signal color.
- Exo 2 gives headings and decisive actions geometric authority; Rajdhani keeps dense UI open and legible.
- Frosted glass, hairline borders, and directional shadows organize layers without turning every panel into a floating card.
- Cut-corner media frames and room-wide state rails make live content and authority visibly distinct.
- Strong keyboard focus, visible system status, responsive call layouts, and reduced-motion fallbacks are part of the visual language.

## Colors

The palette is a near-black operating environment punctuated by two rare, high-chroma signals.

### Primary

- **Command Magenta:** Decisive actions, Host authority, submit and leave actions, brand emphasis, and urgent attention. Its rarity gives it force.

### Secondary

- **Consent Cyan:** Focus rings, approved or active state, participant-scoped control, system links, live indicators, and recovery actions.

### Tertiary

- **Recording Red:** Destructive actions and Recording state only. Do not substitute Command Magenta when the interface must communicate a true destructive or recording-specific state.

### Neutral

- **Operator Background:** The dark violet-black canvas behind every route and call stage.
- **Glass Card:** The main translucent panel family for forms, cards, rails, and side panels.
- **Deep Popover:** A denser modal and overlay surface.
- **Secondary Surface:** Filled secondary controls and strong tonal separation.
- **Muted Surface:** Quiet rows, disabled regions, and low-emphasis control backgrounds.
- **High Signal:** Near-white primary text and icons.
- **Quiet Copy:** Supporting text, helper text, timestamps, and inactive labels.
- **Hairline Static:** Low-contrast borders that clarify structure without reading as boxes.

### Named Rules

**The One Signal per Moment Rule.** Command Magenta tells the user where authority or decisive action lives; Consent Cyan tells them what is active, approved, focused, or recoverable. Do not make both accents compete for the same action.

**The Dark Room Rule.** Huddle is dark-only. New surfaces inherit the Operator Background and create separation through tone, glass, hairlines, and light—not through white canvases.

**The Neon Budget Rule.** High-chroma accents occupy a small portion of a screen. Large fields stay neutral so video, text, and active system state remain readable.

## Typography

**Display Font:** Exo 2 (with its generated fallback and sans-serif)

**Body Font:** Rajdhani (with its generated fallback and sans-serif)

**Label/Mono Font:** System monospace for Room Codes, timers, machine state, and HUD readouts

**Character:** Exo 2 is geometric and futuristic without becoming ornamental; it gives brand marks, headings, and decisive actions a controlled technical voice. Rajdhani is narrower and more open, allowing operational copy and compact controls to remain legible at meeting density.

### Hierarchy

- **Display** (700, 3rem mobile / 3.75rem small desktop / 4.5rem large desktop, 0.96): Landing and Downloads hero statements. Keep the measure short, usually near 11 characters per line in the lead hero.
- **Headline** (700, 2.25rem rising to 3rem, approximately 1): Major marketing or empty-state section headings.
- **Title** (600, 1.5rem, 1.33): Dialogs, form panels, dashboards, and primary in-app sections.
- **Body** (400, 1rem, 1.5): Default interface copy. Marketing introductions may rise to 1.125–1.25rem with a 1.75–2rem line height.
- **Action** (600, 1rem, 1.5): Major calls to action and submit controls in Exo 2.
- **Label** (600, 0.875rem, 1.25): Form labels, compact buttons, metadata, and section controls.
- **Mono** (500, 0.75rem, 0.16em): Room Codes, timers, connection state, uppercase HUD copy, and technical readouts.

### Named Rules

**The Display Carries Authority Rule.** Exo 2 leads brand statements, decisions, and section ownership. Do not use it for long explanatory paragraphs.

**The Dense UI Stays Human Rule.** Rajdhani is the default for controls and supporting copy; do not compress important consent or error language into decorative uppercase labels.

**The Mono Means Machine Rule.** Monospace indicates identifiers, time, transport, or system state. It is not a general stylistic accent.

## Layout

Marketing pages use a centered 80rem container with 20px mobile gutters and 32px gutters from the small breakpoint. The main navigation is 72px high. Hero sections occupy approximately 88dvh on mobile and 92dvh from the small breakpoint, with content weighted left and imagery or atmospheric light providing the opposing mass. Primary calls to action stack on narrow screens and align in a row from 640px.

App entry surfaces use the full viewport and the dot-grid background. A two-column composition may place brand context beside a compact glass task panel; it collapses to one column when width cannot protect the form. Panels should normally stay between 28rem and 42rem rather than stretching across the viewport.

The call stage owns 100dvh. Equal Grid reserves 12px stage gutters and 96px beneath the media for mobile controls; from 640px it uses 24px gutters and 112px control clearance. Landscape grids use one column for one tile, two columns through four tiles, three through nine, and four beyond nine.

Portrait Equal Grid applies by orientation rather than device detection. One to three remote tiles divide the usable stage into equal rows; four or more keep four rows visible and scroll vertically. Tiles retain the existing gutters, fill the row, and preserve the complete media frame with `object-contain`. The local camera remains a draggable 112px-wide Self-view, rising to 176px from 640px.

Focused presentation and Pin layouts keep one main stage plus a filmstrip. The strip is a horizontal 88px-high row on mobile and a scrollable 224px-wide right column from 640px. Persistent Remote Control state occupies a rail below the focused content instead of obscuring the shared display.

Primary responsive thresholds are 640px for compact-to-roomy app layout, 768px for marketing navigation visibility, and 1024px for large marketing composition and hero type.

### Named Rules

**The Media Owns the Stage Rule.** Controls, Host panels, status, and self-view must protect media rather than cover its most important regions.

**The Orientation Is the Contract Rule.** Portrait Equal Grid responds to viewport orientation, not user-agent, touch, or assumed device class.

**The Four Visible Rule.** In portrait Equal Grid, participant overflow scrolls after four visible rows; do not keep shrinking faces to avoid scrolling.

## Elevation & Depth

Huddle uses a hybrid of translucent layering and structural shadow. Standard glass uses a violet surface at 62% opacity with 16px blur and 140% saturation; strong glass uses a deeper surface at 82% opacity with 22px blur and 150% saturation. Hairline borders establish most boundaries. Directional shadows establish overlays and side panels, while neon glows are reserved for active or decisive states.

### Shadow Vocabulary

- **Command Glow** (`0 0 0 1px oklch(0.66 0.27 350 / 0.5), 0 0 18px oklch(0.66 0.27 350 / 0.45), 0 0 42px oklch(0.66 0.27 350 / 0.25)`): Selected Command Magenta controls, waiting attention, and rare decisive state.
- **Consent Glow** (`0 0 0 1px oklch(0.82 0.15 200 / 0.5), 0 0 18px oklch(0.82 0.15 200 / 0.45), 0 0 42px oklch(0.82 0.15 200 / 0.25)`): Active Consent Cyan controls and status—not decoration.
- **Dialog Lift** (`0 8px 60px oklch(0 0 0 / 0.6)`): Centered task panels and blocking dialogs.
- **Status Lift** (`0 12px 36px oklch(0 0 0 / 0.35)`): Persistent rails that must remain distinct from media.
- **Side Panel Cast** (`±8px 0 50px oklch(0 0 0 / 0.5)`): Docked Chat and Host panels, directed inward from the viewport edge.
- **CTA Bloom** (`0 16px 45px oklch(0.66 0.27 350 / 0.24–0.28)`): Major marketing CTA only.

### Named Rules

**The Structural First Rule.** Establish hierarchy with tone, border, and placement before adding shadow.

**The Neon Must Be Earned Rule.** Glow appears because something is active, urgent, selected, or decisively actionable. A resting decorative card does not glow.

**The Overlay Casts Direction Rule.** Side panels cast inward; centered dialogs cast down and outward; status rails lift evenly. Shadow direction explains where the layer came from.

## Shapes

Standard controls use gently curved 7.2–12px corners. Panels and dialogs use 16.8–21.6px corners when they need to read as contained tasks. Compact call controls, status chips, avatars, and indicators are circular.

Live media uses a distinct cut-corner silhouette: 16px diagonal cuts at the top-left and bottom-right. The outer frame paints a magenta-to-cyan bezel around the same clipped inner surface. Active speakers receive a rotating conic border and a restrained scanline layer.

The Huddle mark is a four-signal ring around a single two-layer play glyph. Every signal stays inside the canvas safety margin, and the opposing foreground/backing treatment keeps the play glyph visible on both light and dark surfaces without a cluttering center disc. Use the supplied asset; do not redraw, recolor, or replace it with a generic video-camera glyph when it serves as the brand mark.

### Named Rules

**The Cut Means Live Rule.** Cut-corner geometry belongs to video, screen-share, and Remote Control capture surfaces. Forms and ordinary cards stay gently rounded.

**The Round Means Immediate Rule.** Circular controls are for compact, direct in-call actions. Multi-step actions and text-heavy decisions use rounded rectangles or dialogs.

## Components

### Buttons

Buttons are tactile and decisive: compact silhouettes, visible pressed movement, and unmistakable state color.

- **Shape:** Rounded rectangles use the medium or large radius; in-call icon controls are circular and normally 32px on mobile and 44px from 640px.
- **Primary:** Command Magenta with dark text for lead marketing and form actions; some app-library actions use the high-signal foreground where contrast and local convention require it.
- **Consent / Active:** Consent Cyan with dark text for affirmative Host actions, or a 15% cyan fill with cyan text and a thin cyan ring for active call state.
- **Danger / Stop:** A 15% Command Magenta fill with magenta text for attended Stop or disabled-media state; true recording/destructive actions use Recording Red.
- **Secondary / Ghost:** An 8% white fill or transparent surface with a hairline border and High Signal text.
- **Hover / Focus:** Hover brightens a filled action or increases translucent fill. Active controls move down 1px. Keyboard focus uses a two-pixel cyan ring; a magenta ring is acceptable only when the control itself is a magenta Stop action.

### Chips

- **Style:** Rounded-full with an 8–15% tinted fill, a low-opacity matching border or ring, and compact 12–14px copy.
- **State:** Cyan communicates active, approved, connected, or recoverable state. Magenta communicates attention or a participant badge. Recording uses red. Amber is reserved for temporary warning state.

### Cards / Containers

- **Corner Style:** 12px for compact cards, 16.8–21.6px for primary panels and dialogs.
- **Background:** Neutral translucent violet or low-opacity white over Operator Background.
- **Shadow Strategy:** Flat at rest unless the surface is a task panel, overlay, or docked layer.
- **Border:** One-pixel Hairline Static or a low-opacity accent border when state is meaningful.
- **Internal Padding:** 16px for compact rows, 24px for standard panels, and 32px for large task panels.

### Inputs / Fields

- **Style:** A 5% white fill, 15% white border, medium radius, and 10px vertical / 12px horizontal padding.
- **Focus:** Border shifts to Consent Cyan and gains a two-pixel low-opacity cyan ring.
- **Error / Disabled:** Error copy uses Command Magenta for validation and Recording Red for destructive system failures. Disabled fields retain structure at reduced opacity rather than disappearing.

### Navigation

Marketing navigation is quiet until action is required: Rajdhani labels, High Signal at reduced opacity, and no default underline. Hover raises text toward full white. The rightmost task action uses a translucent bordered button. Route-level Huddle marks and wordmarks always link home and retain visible cyan keyboard focus.

### Video Tiles

Video tiles are the signature live component. They use the cut-corner gradient frame, dark letterboxing, and `object-contain` for both camera and screen media so faces and shared frames are never cropped. The participant name sits in a compact black glass pill at bottom-left; active state appears as the animated bezel plus a small cyan monospace `LIVE` HUD at top-right. Pin sits top-left and Request Control sits bottom-right so controls do not collide.

### Status Rails and Side Panels

Remote Control status is a full-width strong-glass rail beneath the stage, with a cyan state icon, relationship copy, renewal or Stop controls, and an amber Recording disclosure when needed. Chat docks left and Host controls dock right; each uses strong glass, a 320px width capped at 85vw, a hairline inner edge, and an inward-cast shadow.

### Dialogs and Faults

Blocking decisions use a centered Deep Popover panel over a 60% black backdrop with subtle blur. Faults use compact strong-glass toasts with a destructive icon and a cyan recovery action. Passive server reachability uses a quiet top-center status pill rather than a disruptive toast.

## Do's and Don'ts

## Scoped public direction: Signal Handoff

The public `/` route uses the Signal Handoff direction from
`docs/LANDING_PAGE_REDESIGN_PLAN.md`. It is a Persuade surface for agencies and
small teams collaborating with clients. The `/privacy` and `/terms` routes use
the same direction as Read surfaces: long-form legal dossiers for people who
need to find, understand, and compare the deployment's boundaries.

- **Palette:** light `#F6EEDB` / `#141414` with purple `#8D2676`, yellow
  `#F3B01C`, and red `#EE342F`; dark `#1A0F0F` / `#FAF4E9` with the same signal
  roles. Tokens are scoped under `.landing-shell` and `data-theme`.
- **Typography:** Archivo Black for display, Archivo for body/UI, and IBM Plex
  Mono for Room Codes, routes, timers, and technical labels. Font files are
  vendored under `src/app/fonts/` with the OFL notice.
- **Composition:** 8–12px frames, selective pills, flat fields, large
  sentence-case headlines, a floating top-center navigation, and three routed
  signal lines. The landing's chosen first viewport is left promise +
  action/Room Code entry + right code-native meeting scene. Legal dossiers use
  a compact floating Huddle/Privacy/Terms navigator, an asymmetric document
  masthead, a sticky numbered contents rail, and a long reading column.
- **Proof:** fictional portraits are labeled illustrative; meeting scenes are
  built with React markup. Do not replace product proof with fabricated
  screenshots or customer claims.
- **Motion:** the four-stage Meet → Present → Approve → Collaborate story
  auto-advances only until a visitor interacts and stops under reduced motion.
- **Boundaries:** the landing may describe Apache-2.0 self-hosted software and
  the official capacity-limited evaluation demo. It must not imply a hosted
  subscription service, customer adoption, compliance certification, or
  production availability guarantee.

The remaining application surfaces keep the legacy dark Neon Switchboard rules
above. The shared Huddle mark and native Control Agent app icon use the approved
cross-product brand geometry without migrating the rest of those surfaces.

### Do:

- **Do** preserve the dark-only Operator Background across every route and transient state.
- **Do** use Command Magenta for decisive authority and Consent Cyan for focus, active state, approval, and recovery.
- **Do** keep media unobscured, letterboxed with `object-contain`, and framed with the cut-corner live silhouette.
- **Do** retain the Portrait Equal Grid contract: orientation-based, four visible rows, vertical overflow, existing gutters, and a floating local Self-view.
- **Do** place Remote Control state below focused content and keep participant-scoped Request Control at the tile's bottom-right.
- **Do** provide visible keyboard focus and remove nonessential animation under `prefers-reduced-motion`.
- **Do** use the supplied Huddle mark and link every route-level logo or wordmark home.

### Don't:

- **Don't** introduce a light theme, pastel SaaS palette, or pale neutral dashboard surface.
- **Don't** turn the product into a generic grid of interchangeable rounded cards; keep the dot-grid, glass hierarchy, signal color, and live-media geometry purposeful.
- **Don't** spread neon across resting surfaces or let Command Magenta and Consent Cyan compete on the same action.
- **Don't** crop camera faces or screen shares to fill a tile.
- **Don't** overlay Host controls, Remote Control status, or self-view on critical shared-display content when layout space can hold them.
- **Don't** use cut corners on ordinary forms, settings rows, or marketing cards.
- **Don't** use monospace as decoration or compress consent, recovery, and error language into cryptic HUD copy.
