import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import LoadingSpinner from '@/components/LoadingSpinner';

export type VerificationTone = 'pending' | 'success' | 'error';

type VerificationPageShellProps = {
  tone: VerificationTone;
  title: string;
  body: string;
  children?: ReactNode;
  ariaBusy?: boolean;
};

const panelLabels: Record<VerificationTone, string> = {
  pending: 'Verification in progress',
  success: 'Email confirmed',
  error: 'Verification failed',
};

export default function VerificationPageShell({ tone, title, body, children, ariaBusy = false }: VerificationPageShellProps) {
  const StatusIcon = tone === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <LandingThemeProvider>
      <main className="verify-email-shell" aria-busy={ariaBusy || undefined}>
        <header className="verify-email-header">
          <div className="verify-email-container">
            <HuddleBrandThemeHeader homeHref="/" />
          </div>
        </header>

        <div className="verify-email-route verify-email-route-one" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="verify-email-route verify-email-route-two" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="verify-email-container verify-email-layout">
          <section className="verify-email-intro" aria-labelledby="verify-email-context-title">
            <p className="verify-email-kicker">ACCOUNT HANDOFF</p>
            <h1 id="verify-email-context-title">Confirm the handoff.</h1>
            <p className="verify-email-lede">Your account moves to the Huddle lobby once this email link is confirmed.</p>
            <div className="verify-email-divider" aria-hidden="true" />
            <dl className="verify-email-context-list">
              <div>
                <dt>Current step</dt>
                <dd>Email confirmation</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>Open your lobby</dd>
              </div>
            </dl>
          </section>

          <section
            className={`verify-email-panel verify-email-panel--${tone}`}
            role={tone === 'error' ? 'alert' : 'status'}
            aria-live={tone === 'error' ? undefined : 'polite'}
            aria-labelledby="verify-email-panel-title"
          >
            <div className="verify-email-panel-heading">
              <p id="verify-email-panel-title">{panelLabels[tone]}</p>
              <span className="verify-email-status-dot" aria-hidden="true" />
            </div>

            <div className="verify-email-mark" aria-hidden="true">
              {tone === 'pending' ? <LoadingSpinner className="verify-email-spinner" /> : <StatusIcon strokeWidth={1.7} />}
            </div>

            <h2 className="verify-email-status">{title}</h2>
            <p className="verify-email-message">{body}</p>
            {children ? <div className="verify-email-actions">{children}</div> : null}
          </section>
        </div>
      </main>
    </LandingThemeProvider>
  );
}

export function VerificationLoadingState() {
  return <VerificationPageShell tone="pending" title="Verifying" body="Hang tight while Huddle confirms your email." ariaBusy />;
}
