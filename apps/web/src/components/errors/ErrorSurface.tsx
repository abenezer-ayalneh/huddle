'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import HuddleIcon from '@/components/HuddleIcon';

type ErrorSurfaceProps = {
  kind: 'route' | 'global';
  digest?: string;
  onRetry: () => void;
};

const colors = {
  background: '#f6eedb',
  backgroundDeep: '#eadfc8',
  surface: '#fffaf0',
  ink: '#141414',
  muted: '#62594f',
  faint: '#82776b',
  border: '#d5c7b0',
  borderStrong: '#bca88a',
  purple: '#8d2676',
  purpleDark: '#6f195e',
  yellow: '#f3b01c',
  red: '#ee342f',
  warmWhite: '#faf4e9',
};

const darkColors = {
  background: '#1a0f0f',
  backgroundDeep: '#241514',
  surface: '#2a1b19',
  ink: '#faf4e9',
  muted: '#d1c1ad',
  faint: '#a99986',
  border: '#624a3e',
  borderStrong: '#866957',
  purple: '#c15a9e',
  purpleDark: '#e182bc',
  yellow: '#f3b01c',
  red: '#ff6b5e',
  warmWhite: '#fff8ee',
};

const fontSans = 'var(--font-archivo, Arial, Helvetica, sans-serif)';
const fontDisplay = 'var(--font-archivo-black, Arial Black, Arial, Helvetica, sans-serif)';
const fontMono = 'var(--font-plex-mono, ui-monospace, SFMono-Regular, Menlo, monospace)';

function SignalRoute({ className, style }: { className?: string; style: CSSProperties }) {
  return (
    <div className={className} aria-hidden="true" style={{ position: 'absolute', display: 'grid', gap: 8, width: 'min(40vw, 480px)', pointerEvents: 'none', ...style }}>
      <i style={{ display: 'block', height: 1, background: 'color-mix(in srgb, var(--error-purple) 65%, transparent)' }} />
      <i style={{ display: 'block', width: '82%', height: 1, marginLeft: '9%', background: 'color-mix(in srgb, var(--error-yellow) 75%, transparent)' }} />
      <i style={{ display: 'block', width: '64%', height: 1, marginLeft: '22%', background: 'color-mix(in srgb, var(--error-red) 55%, transparent)' }} />
    </div>
  );
}

export default function ErrorSurface({ kind, digest, onRetry }: ErrorSurfaceProps) {
  const isGlobal = kind === 'global';
  const copy = isGlobal
    ? {
        kicker: 'Signal Handoff / Root',
        title: 'Huddle needs a reset.',
        lede: 'The application shell could not complete its handoff. Your meeting data is not shown here; reload the route to try the connection again.',
        panelLabel: 'System signal',
        panelStatus: 'Root surface interrupted',
        actionLabel: 'Reload Huddle',
      }
    : {
        kicker: 'Signal Handoff / Route',
        title: 'The handoff paused.',
        lede: 'This route could not finish loading. Try the handoff again, or return to Huddle and choose another path.',
        panelLabel: 'Route signal',
        panelStatus: 'Route surface interrupted',
        actionLabel: 'Try again',
      };

  const shellStyle = {
    colorScheme: 'light',
  } satisfies CSSProperties;

  const darkModeStyle = `
    .huddle-error-surface { --error-background: ${colors.background}; --error-background-deep: ${colors.backgroundDeep}; --error-surface: ${colors.surface}; --error-ink: ${colors.ink}; --error-muted: ${colors.muted}; --error-faint: ${colors.faint}; --error-border: ${colors.border}; --error-border-strong: ${colors.borderStrong}; --error-purple: ${colors.purple}; --error-purple-dark: ${colors.purpleDark}; --error-yellow: ${colors.yellow}; --error-red: ${colors.red}; --error-warm-white: ${colors.warmWhite}; }
    @media (prefers-color-scheme: dark) {
      .huddle-error-surface { --error-background: ${darkColors.background}; --error-background-deep: ${darkColors.backgroundDeep}; --error-surface: ${darkColors.surface}; --error-ink: ${darkColors.ink}; --error-muted: ${darkColors.muted}; --error-faint: ${darkColors.faint}; --error-border: ${darkColors.border}; --error-border-strong: ${darkColors.borderStrong}; --error-purple: ${darkColors.purple}; --error-purple-dark: ${darkColors.purpleDark}; --error-yellow: ${darkColors.yellow}; --error-red: ${darkColors.red}; --error-warm-white: ${darkColors.warmWhite}; color-scheme: dark; }
    }
    html[data-theme='dark'] .huddle-error-surface { --error-background: ${darkColors.background}; --error-background-deep: ${darkColors.backgroundDeep}; --error-surface: ${darkColors.surface}; --error-ink: ${darkColors.ink}; --error-muted: ${darkColors.muted}; --error-faint: ${darkColors.faint}; --error-border: ${darkColors.border}; --error-border-strong: ${darkColors.borderStrong}; --error-purple: ${darkColors.purple}; --error-purple-dark: ${darkColors.purpleDark}; --error-yellow: ${darkColors.yellow}; --error-red: ${darkColors.red}; --error-warm-white: ${darkColors.warmWhite}; color-scheme: dark; }
    html[data-theme='light'] .huddle-error-surface { color-scheme: light; }
    .huddle-error-surface a, .huddle-error-surface button { transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease; }
    .huddle-error-surface a:hover { border-color: var(--error-purple) !important; background: color-mix(in srgb, var(--error-purple) 8%, var(--error-surface)) !important; }
    .huddle-error-surface button:hover { background: var(--error-purple-dark) !important; }
    .huddle-error-surface button:active, .huddle-error-surface a:active { transform: translateY(1px); }
    .huddle-error-surface a:focus-visible, .huddle-error-surface button:focus-visible { outline: 2px solid var(--error-yellow); outline-offset: 3px; }
    @media (max-width: 760px) {
      .huddle-error-container { width: min(calc(100% - 28px), 1180px) !important; }
      .huddle-error-layout { grid-template-columns: 1fr !important; gap: 38px !important; padding-top: 32px !important; padding-bottom: 44px !important; }
      .huddle-error-panel { width: 100% !important; justify-self: stretch !important; padding: 24px 20px !important; }
      .huddle-error-actions { flex-direction: column !important; }
      .huddle-error-actions > * { width: 100% !important; flex: 0 0 auto !important; }
      .huddle-error-route { width: 80vw !important; }
      .huddle-error-route--top { top: 46% !important; right: -35% !important; }
      .huddle-error-route--bottom { bottom: 12% !important; left: -44% !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .huddle-error-surface *, .huddle-error-surface *::before, .huddle-error-surface *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: darkModeStyle }} />
      <main className="huddle-error-surface" style={{ ...shellStyle, position: 'relative', isolation: 'isolate', display: 'flex', minHeight: '100dvh', overflow: 'hidden', background: 'var(--error-background)', color: 'var(--error-ink)', fontFamily: fontSans }}>
        <SignalRoute className="huddle-error-route huddle-error-route--top" style={{ top: '27%', right: '-10%', transform: 'rotate(18deg)' }} />
        <SignalRoute className="huddle-error-route huddle-error-route--bottom" style={{ bottom: '15%', left: '-15%', transform: 'rotate(-10deg)' }} />

        <div className="huddle-error-container" style={{ position: 'relative', zIndex: 1, display: 'flex', width: 'min(100% - 40px, 1180px)', flexDirection: 'column', margin: '0 auto' }}>
          <header className="huddle-error-header" style={{ display: 'flex', minHeight: 82, alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <Link href="/" aria-label="Huddle home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--error-ink)', fontFamily: fontDisplay, fontSize: 20, letterSpacing: '-0.04em', textDecoration: 'none' }}>
              <HuddleIcon aria-hidden="true" style={{ width: 32, height: 32, '--huddle-logo-primary': 'var(--error-purple)', '--huddle-logo-accent': 'var(--error-yellow)', '--huddle-logo-play': 'var(--error-ink)', '--huddle-logo-play-stroke': 'var(--error-surface)' } as CSSProperties} />
              Huddle
            </Link>
            <span style={{ color: 'var(--error-faint)', fontFamily: fontMono, fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase' }}>{isGlobal ? 'Root boundary' : 'Route boundary'}</span>
          </header>

          <div className="huddle-error-layout" style={{ display: 'grid', flex: 1, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.72fr)', alignItems: 'center', gap: 'clamp(48px, 9vw, 132px)', padding: '52px 0 72px' }}>
            <section className="huddle-error-intro" aria-labelledby="error-surface-title" style={{ maxWidth: 560 }}>
              <p style={{ margin: 0, color: 'var(--error-purple)', fontFamily: fontMono, fontSize: 10, letterSpacing: '0.13em', lineHeight: 1.4, textTransform: 'uppercase' }}>{copy.kicker}</p>
              <h1 id="error-surface-title" style={{ maxWidth: '10ch', margin: '18px 0 0', fontFamily: fontDisplay, fontSize: 'clamp(3.2rem, 7vw, 6rem)', fontWeight: 900, letterSpacing: '-0.065em', lineHeight: 0.91, textWrap: 'balance' }}>{copy.title}</h1>
              <p style={{ maxWidth: 500, margin: '26px 0 0', color: 'var(--error-muted)', fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', lineHeight: 1.65 }}>{copy.lede}</p>
              <div aria-hidden="true" style={{ maxWidth: 510, marginTop: 38, borderTop: '1px solid var(--error-border-strong)' }} />
            </section>

            <section className="huddle-error-panel" role="alert" aria-labelledby="error-panel-title" style={{ width: 'min(100%, 430px)', justifySelf: 'end', padding: 'clamp(24px, 4vw, 38px)', border: '1px solid var(--error-border-strong)', borderRadius: 16, background: 'var(--error-surface)', boxShadow: '14px 18px 0 color-mix(in srgb, var(--error-purple) 14%, transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--error-border)' }}>
                <p id="error-panel-title" style={{ margin: 0, color: 'var(--error-purple)', fontFamily: fontMono, fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase' }}>{copy.panelLabel}</p>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error-red)', boxShadow: '0 3px 10px color-mix(in srgb, var(--error-red) 42%, transparent)' }} />
              </div>

              <div style={{ display: 'grid', width: 104, height: 104, placeItems: 'center', margin: '38px auto 24px', border: '1px solid color-mix(in srgb, var(--error-red) 45%, var(--error-border))', borderRadius: 16, background: 'var(--error-background-deep)', boxShadow: '8px 10px 0 color-mix(in srgb, var(--error-red) 12%, transparent)' }}>
                <HuddleIcon aria-hidden="true" style={{ width: 68, height: 68, '--huddle-logo-primary': 'var(--error-purple)', '--huddle-logo-accent': 'var(--error-red)', '--huddle-logo-play': 'var(--error-ink)', '--huddle-logo-play-stroke': 'var(--error-surface)' } as CSSProperties} />
              </div>

              <p style={{ margin: 0, color: 'var(--error-ink)', fontFamily: fontDisplay, fontSize: 'clamp(1.35rem, 2.5vw, 1.8rem)', fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1.03 }}>{copy.panelStatus}</p>
              <p style={{ margin: '12px 0 0', color: 'var(--error-muted)', fontSize: 14, lineHeight: 1.55 }}>No action was completed on this surface. The next handoff can start cleanly.</p>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 24, padding: '9px 12px', border: '1px solid var(--error-border)', borderRadius: 9, background: 'var(--error-background-deep)' }}>
                <span style={{ color: 'var(--error-purple)', fontFamily: fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Signal state</span>
                <code style={{ overflow: 'hidden', color: 'var(--error-ink)', fontFamily: fontMono, fontSize: 11, letterSpacing: '0.04em', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{digest ? `DIGEST ${digest}` : 'RETRY AVAILABLE'}</code>
              </div>

              <div className="huddle-error-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
                <button type="button" onClick={onRetry} style={{ minHeight: 46, flex: '1 1 160px', padding: '11px 15px', border: '1px solid var(--error-purple)', borderRadius: 9, color: 'var(--error-warm-white)', background: 'var(--error-purple)', fontFamily: fontSans, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {copy.actionLabel}
                </button>
                <Link href="/" style={{ display: 'inline-flex', minHeight: 46, flex: '1 1 130px', alignItems: 'center', justifyContent: 'center', padding: '11px 15px', border: '1px solid var(--error-border-strong)', borderRadius: 9, color: 'var(--error-ink)', background: 'transparent', fontFamily: fontSans, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  Back to Huddle
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
