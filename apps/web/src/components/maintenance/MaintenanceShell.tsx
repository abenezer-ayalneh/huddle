'use client';
import type { ReactNode } from 'react';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import styles from './maintenance.module.css';

export default function MaintenanceShell({ children }: { children: ReactNode }) {
  return (
    <LandingThemeProvider>
      <main className={`landing-shell ${styles.shell}`}>
        <header className={styles.header}>
          <HuddleBrandThemeHeader homeHref="/" />
        </header>
        <section className={styles.content}>{children}</section>
      </main>
    </LandingThemeProvider>
  );
}
