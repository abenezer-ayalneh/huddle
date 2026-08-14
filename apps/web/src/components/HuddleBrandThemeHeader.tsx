'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import type { MouseEventHandler, ReactNode } from 'react';
import HuddleIcon from '@/components/HuddleIcon';
import { useLandingTheme } from '@/components/landing/LandingThemeProvider';

type HuddleBrandThemeHeaderProps = {
  homeHref: string;
  onHomeClick?: MouseEventHandler<HTMLAnchorElement>;
  navigation?: ReactNode;
  trailing?: ReactNode;
};

export default function HuddleBrandThemeHeader({ homeHref, onHomeClick, navigation, trailing }: HuddleBrandThemeHeaderProps) {
  const { theme, toggleTheme } = useLandingTheme();
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  return (
    <div className="huddle-brand-theme-header">
      <div className="huddle-brand-theme-header__brand-shell">
        <Link href={homeHref} className="huddle-brand-theme-header__brand" aria-label="Huddle home" onClick={onHomeClick}>
          <HuddleIcon className="huddle-brand-theme-header__brand-icon" aria-hidden="true" />
          <span>Huddle</span>
        </Link>
      </div>
      <div className="huddle-brand-theme-header__navigation">{navigation}</div>
      <button
        type="button"
        className="huddle-brand-theme-header__theme"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        aria-pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        <ThemeIcon className="size-4" aria-hidden="true" />
      </button>
      {trailing ? <div className="huddle-brand-theme-header__trailing">{trailing}</div> : null}
    </div>
  );
}
