'use client';

import type { ReactNode } from 'react';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';

export type MeetingEntryTone = 'pending' | 'denied';

type MeetingEntryShellProps = {
  room: string;
  kicker: string;
  title: string;
  lede: string;
  panelLabel: string;
  tone?: MeetingEntryTone;
  headingId: string;
  panelLabelId: string;
  panelRole?: 'status' | 'alert';
  ariaBusy?: boolean;
  panelClassName?: string;
  children: ReactNode;
};

export default function MeetingEntryShell({
  room,
  kicker,
  title,
  lede,
  panelLabel,
  tone = 'pending',
  headingId,
  panelLabelId,
  panelRole = 'status',
  ariaBusy = false,
  panelClassName = '',
  children,
}: MeetingEntryShellProps) {
  return (
    <LandingThemeProvider>
      <main className="meeting-loading-shell" aria-busy={ariaBusy || undefined}>
        <header className="meeting-loading-header">
          <div className="meeting-loading-container">
            <HuddleBrandThemeHeader homeHref="/" />
          </div>
        </header>

        <div className="meeting-loading-route meeting-loading-route-one" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="meeting-loading-route meeting-loading-route-two" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="meeting-loading-container meeting-loading-layout">
          <section className="meeting-loading-intro" aria-labelledby={headingId}>
            <p className="meeting-loading-kicker">{kicker}</p>
            <h1 id={headingId}>{title}</h1>
            <p className="meeting-loading-lede">{lede}</p>
            <div className="meeting-loading-divider" aria-hidden="true" />
          </section>

          <section
            className={`meeting-loading-panel ${panelClassName}`.trim()}
            role={panelRole}
            aria-labelledby={panelLabelId}
            aria-live={panelRole === 'status' ? 'polite' : undefined}
          >
            <div className="meeting-loading-panel-heading">
              <p id={panelLabelId}>{panelLabel}</p>
              <span className={`meeting-loading-status-dot meeting-loading-status-dot--${tone}`} aria-hidden="true" />
            </div>

            {children}

            <div className="meeting-loading-room">
              <span>Room code</span>
              <code>{room}</code>
            </div>
          </section>
        </div>
      </main>
    </LandingThemeProvider>
  );
}
