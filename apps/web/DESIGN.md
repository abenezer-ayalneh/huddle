---
name: Huddle Web
description: Signal Handoff operating surfaces around a deliberately dark LiveKit media stage.
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
  signal-background: '#f6eedb'
  signal-background-deep: '#eadfc8'
  signal-surface: '#fffaf0'
  signal-surface-strong: '#f0e4cd'
  signal-ink: '#141414'
  signal-muted: '#62594f'
  signal-faint: '#82776b'
  signal-border: '#d5c7b0'
  signal-border-strong: '#bca88a'
  signal-border-dark: '#624a3e'
  signal-purple: '#8d2676'
  signal-purple-dark: '#6f195e'
  signal-yellow: '#f3b01c'
  signal-red: '#ee342f'
  signal-red-dark: '#ff6b5e'
  signal-media: '#1a0f0f'
  signal-media-dark: '#140b0b'
  signal-warm-white: '#faf4e9'
typography:
  display:
    fontFamily: 'var(--font-archivo-black), Arial Black, sans-serif'
    fontSize: 'clamp(3.25rem, 6vw, 5.75rem)'
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: '-0.055em'
  headline:
    fontFamily: 'var(--font-archivo-black), Arial Black, sans-serif'
    fontSize: 'clamp(2.25rem, 4vw, 4rem)'
    fontWeight: 400
    lineHeight: 0.96
    letterSpacing: '-0.045em'
  title:
    fontFamily: 'var(--font-archivo-black), Arial Black, sans-serif'
    fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)'
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: '-0.035em'
  body:
    fontFamily: 'var(--font-archivo), Arial, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 'normal'
  action:
    fontFamily: 'var(--font-archivo), Arial, sans-serif'
    fontSize: '0.9rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 'normal'
  label:
    fontFamily: 'var(--font-plex-mono), ui-monospace, monospace'
    fontSize: '0.625rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.13em'
  mono:
    fontFamily: 'var(--font-plex-mono), ui-monospace, monospace'
    fontSize: '0.6875rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.08em'
  outcome-display:
    fontFamily: 'var(--font-archivo-black), Arial Black, sans-serif'
    fontSize: 'clamp(3.2rem, 7vw, 6rem)'
    fontWeight: 900
    lineHeight: 0.91
    letterSpacing: '-0.065em'
  outcome-body:
    fontFamily: 'var(--font-archivo), Arial, sans-serif'
    fontSize: 'clamp(1rem, 1.5vw, 1.15rem)'
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 'normal'
  outcome-title:
    fontFamily: 'var(--font-archivo-black), Arial Black, sans-serif'
    fontSize: 'clamp(1.35rem, 2.5vw, 1.8rem)'
    fontWeight: 900
    lineHeight: 1.03
    letterSpacing: '-0.045em'
rounded:
  sm: '8px'
  md: '9px'
  lg: '10px'
  xl: '16px'
  pill: '999px'
  full: '9999px'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '20px'
  6: '24px'
  8: '32px'
  10: '40px'
components:
  button-primary:
    backgroundColor: '{colors.signal-purple}'
    textColor: '{colors.signal-warm-white}'
    typography: '{typography.action}'
    rounded: '{rounded.md}'
    padding: '11px 15px'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.signal-purple}'
    typography: '{typography.action}'
    rounded: '{rounded.md}'
    padding: '11px 15px'
  text-field:
    backgroundColor: '{colors.signal-background}'
    textColor: '{colors.signal-ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
  signal-panel:
    backgroundColor: '{colors.signal-surface}'
    textColor: '{colors.signal-ink}'
    rounded: '{rounded.xl}'
    padding: '24px'
  call-control-active:
    backgroundColor: 'color-mix(in srgb, #f3b01c 16%, transparent)'
    textColor: '{colors.signal-purple}'
    rounded: '{rounded.full}'
    size: '44px'
  status-rail:
    backgroundColor: '{colors.signal-surface}'
    textColor: '{colors.signal-ink}'
    rounded: '{rounded.xl}'
    padding: '8px 12px'
  video-tile:
    backgroundColor: '{colors.signal-media}'
    textColor: '{colors.signal-warm-white}'
    width: '100%'
    height: '100%'
  navigation:
    backgroundColor: 'color-mix(in srgb, #f6eedb 88%, transparent)'
    textColor: '{colors.signal-ink}'
    height: '60px'
    padding: '8px 10px 8px 18px'
---

# Design System: Huddle Web

## Overview

**Creative North Star: “Signal Handoff”**

Huddle is a meeting product about moving a conversation into shared work. Its
public and operational surfaces use warm editorial fields, framed handoff
states, route-like signal lines, and a compact technical readout. The system is
not a collection of interchangeable cards: panels contain a task, frames mark a
boundary, and color explains authority or recovery.

The current system is applied as scoped shells. Signal Handoff covers the
landing page, Lobby, Device Check, legal dossiers, Downloads, Recordings,
email verification, room-entry outcomes, route and global error surfaces, the
custom 404, and global system notices. The active call extends the same grammar
into an Operate surface: warm workspace chrome surrounds a deliberately dark,
media-first field. The unscoped root `bg-dotgrid` remains a dark fallback for
future routes; it is not the visual contract of the audited route shells.

**Key Characteristics:**

- Warm cream/chocolate themes with a saved light/dark preference and scoped tokens.
- Purple marks authority and committed action; yellow marks focus, active, or recoverable state; red marks recording, Stop, and true failure.
- Archivo Black gives decisions and headings weight; Archivo keeps interface copy readable; IBM Plex Mono is reserved for machine state.
- Flat frames, hairlines, and offset structural shadows establish hierarchy before blur or glow.
- Media owns the active-call stage, while consent, Host authority, and Remote Control state remain visible without obscuring shared content.
- Keyboard focus, responsive layouts, and reduced-motion fallbacks are part of the system rather than afterthoughts.

## Colors

Signal Handoff uses a warm cream/chocolate foundation with three restrained
semantic signals. The older operator tokens remain available to low-level
legacy primitives and the dark media field, but new route shells use the warm
tokens below.

### Primary

- **Signal Purple** (`#8D2676` light / `#C15A9E` dark): authority, primary actions, committed handoffs, and the Huddle mark.

### Secondary

- **Signal Yellow** (`#F3B01C`): keyboard focus, active state, recoverable attention, and the live status dot.

### Tertiary

- **Signal Red** (`#EE342F` light / `#FF6B5E` dark): recording, Stop/Leave, destructive action, and true route or transport failure.

### Neutral

- **Signal Background** (`#F6EEDB` light / `#1A0F0F` dark): the warm route canvas.
- **Signal Background Deep** (`#EADFC8` light / `#241514` dark): route lines, recessed fields, and quiet context rows.
- **Signal Surface** (`#FFFAF0` light / `#2A1B19` dark): task panels and framed content.
- **Signal Surface Strong** (`#F0E4CD` light / `#33221D` dark): filled secondary regions and active navigation.
- **Signal Ink** (`#141414` light / `#FAF4E9` dark): primary copy and icons.
- **Signal Muted / Faint** (`#62594F` / `#82776B` light; `#D1C1AD` / `#A99986` dark): supporting copy and low-emphasis metadata.
- **Signal Border** (`#D5C7B0` light / `#624A3E` dark): hairlines and quiet boundaries.
- **Signal Border Strong** (`#BCA88A` light / `#866957` dark): task-panel frames and meaningful state boundaries.
- **Signal Media** (`#1A0F0F` light / `#140B0B` dark): the intentional dark field behind live camera and screen media.

### Named Rules

**The One Signal per Moment Rule.** Purple answers “who has authority?” Yellow
answers “what is active or recoverable?” Red answers “what stops, records, or
failed?” Do not make multiple signals compete for one action.

**The Scoped World Rule.** Route shells own their visual world explicitly. Keep
the root dark baseline as a fallback, not as a reason to reintroduce dark glass
into a warm Signal Handoff surface.

**The Dark Media Rule.** The media well stays dark in both themes so faces,
shared displays, consent prompts, and authority controls remain legible.

## Typography

**Display Font:** Archivo Black (with Arial Black and sans-serif fallbacks)

**Body Font:** Archivo (with Arial and sans-serif fallbacks)

**Label/Mono Font:** IBM Plex Mono (with system monospace fallbacks)

**Character:** Archivo Black supplies editorial authority without decorative
distortion. Archivo keeps dense operational copy open, while IBM Plex Mono
signals only identifiers, timers, routes, and transport state.

### Hierarchy

- **Display** (400, `clamp(3.25rem, 6vw, 5.75rem)`, 0.95): landing, Lobby, and major handoff statements; keep the measure short and balanced.
- **Headline** (400, `clamp(2.25rem, 4vw, 4rem)`, 0.96): major public sections and empty/outcome headings.
- **Title** (400, `clamp(1.4rem, 2.5vw, 1.85rem)`, 1.05): task-panel status and contained decisions.
- **Body** (400, 1rem, 1.65): explanatory and consent copy, usually constrained to approximately 31–56ch.
- **Action** (700, 0.9rem, 1.2): buttons and explicit recovery actions.
- **Label** (500, 0.625rem, 0.13em): compact uppercase route and state labels.
- **Mono** (500, 0.6875rem, 0.08em): Room Codes, timers, route names, and technical readouts only.

### Named Rules

**The Display Carries Authority Rule.** Use Archivo Black for the decision or
the section owner, never for long explanatory paragraphs.

**The Mono Means Machine Rule.** Monospace is data or state, not decoration.

## Layout

Public and dossier surfaces use centered containers between 1120px and 1280px,
with 20px gutters on wider mobile layouts and 14px gutters at the narrowest
breakpoint. Headers sit in a compact 60px pill or a 72px route rail. The brand
always occupies the left side; theme, navigation, and route actions occupy the
right side.

Landing, Lobby, legal, verification, 404, and room-entry outcomes use a
left-context/right-task composition at desktop widths. The task panel stays
roughly 360–430px wide, while the copy owns the remaining measure. At mobile
widths the composition becomes a single column, with the context first and the
task or preview immediately after it. Primary actions stack or stretch to the
available width.

Device Check keeps preview and device controls as distinct regions. Its preview
is responsive and may use a tall portrait stage on narrow screens. Joined call
media uses `object-contain`, reserves space for controls and consent, and keeps
the floating Self-view separate from the Device Check preview.

The active call owns `100dvh`. Media takes precedence over chrome; Host and
Chat dock at the edges, consent occupies a measured top tray, controls live in
the bottom dock, and Remote Control status sits below focused content. Portrait
Equal Grid is orientation-based, keeps four rows visible before vertical
overflow, and retains its floating local Self-view.

Primary breakpoints are 640px for compact-to-roomy app layout, 768px for
navigation visibility, and 1024px for large marketing composition. All audited
route shells use `overflow-x: clip` or an equivalent bounded layout so routed
signal lines cannot create horizontal scrolling.

### Named Rules

**The Brand-left Rule.** Huddle branding stays left and actions stay right at
every breakpoint; the action group may compress or disclose, but it does not
swap sides.

**The Media Owns the Stage Rule.** Status, Host controls, consent, and
self-view protect the important shared content rather than covering it.

**The Orientation Is the Contract Rule.** Portrait grid behavior responds to
orientation, not user-agent or assumed device class.

## Elevation & Depth

Signal Handoff is flat at rest and uses structure before shadow: a warm surface,
a one-pixel boundary, and deliberate placement do most of the work. Primary
panels and drawers use offset purple shadows; the shared header and legal
navigation may use restrained translucency and blur. Neon glow belongs only to
active legacy call states or explicitly earned signal moments.

### Shadow Vocabulary

- **Task Lift** (`14px 18px 0 color-mix(in srgb, var(--verify-email-purple) 14%, transparent)`): primary outcome, verification, and error panels; each shell uses its own purple token.
- **Compact Task Lift** (`8px 10px 0 color-mix(in srgb, var(--verify-email-purple) 14%, transparent)`): mobile panels and compact entry surfaces; each shell uses its own purple token.
- **Archive / Release Lift** (`12px 16px 0 color-mix(in srgb, var(--recordings-purple) 18%, transparent)`): Downloads and Recordings workspaces; each archive shell uses its own purple token.
- **Status Lift** (`9px 11px 0 color-mix(in srgb, var(--system-notice-purple) 17%, transparent)`): global system notices that must stay distinct from route content.
- **Call Chrome Lift** (`6px 7px 0 var(--call-shadow)`): framed controls and drawers around the dark media field.

### Named Rules

**The Structural First Rule.** Use tone, border, and placement before adding
shadow.

**The Directional Lift Rule.** Offset shadows explain a panel’s relationship to
the page; they are not ambient decoration.

## Shapes

Ordinary controls use 8–10px corners. Primary panels, dialogs, preview frames,
and workspaces use 16px corners. Pills are reserved for compact navigation,
state chips, and status markers. Hairlines are one pixel and usually warm-toned.

Live media uses the established cut-corner silhouette with a thin purple-to-
yellow/cyan bezel; active-speaker treatment may animate the frame and scanline
overlay. Forms, settings rows, and legal content do not use cut corners.

The Huddle mark is the supplied four-signal ring around a contrast-backed
two-layer play glyph. Route-level marks link home. Do not replace it with a
generic camera icon or redraw it in a way that loses its light/dark contrast.

## Components

### Buttons

Buttons are compact, explicit, and tactile. Purple is the primary authority
action; transparent or surface-toned buttons are secondary; yellow is a focus
or active signal, not a competing primary action. Buttons move down 1px on
press, use a visible 2px yellow focus outline, and preserve a disabled state
with reduced opacity and a not-allowed cursor.

### Chips

State chips use a pill silhouette with a low-opacity semantic fill and matching
border. Yellow marks active/recoverable attention, purple marks authority or
participant context, and red marks recording or destructive state.

### Cards / Containers

Panels are task containers, not a repeated page grid. They use a warm surface,
one strong boundary, 24–38px padding on desktop and 20–24px on mobile, with an
offset structural shadow only when the panel needs elevation. Archive and
release stations may use a 6px yellow edge as a meaningful handoff marker.

### Inputs / Fields

Inputs use a warm background, one-pixel border, 9px radius, 10px vertical and
12px horizontal padding, and a readable 16px text size. Focus shifts the border
to purple and adds a low-opacity purple ring. Errors use red for the true
failure state; validation and helper text remain readable and descriptive.

### Navigation

`HuddleBrandThemeHeader` is the shared interactive header for Landing, Legal,
Lobby, Device Check, Downloads, Recordings, verification, and outcome shells.
It owns the home-linked brand island and the standalone theme toggle. Route
owners provide only their semantic navigation or trailing action. On mobile,
links may disappear or disclose, but the Huddle mark remains left and actions
remain right.

### Entry and Outcome Surfaces

`MeetingEntryShell` composes room resolution, waiting, denied, and connection
error states. `VerificationPageShell`, `ErrorSurface`, and `NotFoundSurface`
reuse the same two-part grammar: a left explanation and a right framed status
panel. Copy names the current state and the next recovery path; technical
labels stay in IBM Plex Mono.

### Live Media and Status Rails

Joined camera and screen media use `object-contain` inside dark framed tiles.
The participant name sits in a compact lower-left label; active state is a
small technical HUD, not a screen-filling glow. Remote Control state is a
persistent below-stage rail with relationship, renewal, and Stop affordances.
Do not turn it into a passive toast or weaken its consent and room scope.

## Do's and Don'ts

### Do:

- **Do** use the scoped warm Signal Handoff tokens on every audited route shell.
- **Do** keep the unscoped `bg-dotgrid` root class as a fallback until future routes are checked; do not claim it is the active visual contract everywhere.
- **Do** keep the Huddle brand on the left and navigation/theme/actions on the right at every breakpoint.
- **Do** reserve purple for authority, yellow for focus/active/recoverable state, and red for recording, Stop/Leave, or true failure.
- **Do** preserve `object-contain`, protected media geometry, consent, admission, Direct Rejoin, Recording, Google Drive, and attended Remote Control behavior.
- **Do** provide visible keyboard focus and reduced-motion fallbacks on authored motion.
- **Do** use the supplied Huddle mark and link route-level marks home.

### Don't:

- **Don't** describe the current application as dark-only or treat the warm route shells as a future migration; the audited surfaces already use Signal Handoff.
- **Don't** migrate the dark media field into a light video surface or crop camera faces and shared screens.
- **Don't** turn every section into a repeated rounded-card grid or use blur/glow as decoration.
- **Don't** put cut corners on ordinary forms, settings rows, or legal reading surfaces.
- **Don't** use monospace as a costume or compress consent, recovery, and error language into cryptic HUD copy.
- **Don't** change LiveKit, admission, Direct Rejoin, Recording, Google Drive, or attended Remote Control behavior as part of visual work.
