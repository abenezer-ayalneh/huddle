import type { Metadata } from 'next';
import LobbyAuthCard from '../LobbyAuthCard';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import LobbyHeader from './LobbyHeader';

export const metadata: Metadata = {
  title: 'Lobby',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function LobbyPage() {
  return (
    <LandingThemeProvider>
      <main className="lobby-shell">
        <LobbyHeader />
        <div className="lobby-route lobby-route-one" aria-hidden="true"><i /><i /><i /></div>
        <div className="lobby-route lobby-route-two" aria-hidden="true"><i /><i /><i /></div>

        <div className="lobby-container lobby-layout">
          <section className="lobby-intro" aria-labelledby="lobby-title">
            <p className="lobby-kicker">YOUR HUDDLE</p>
            <h1 id="lobby-title">Your room is ready.</h1>
            <p className="lobby-lede">Host a meeting, set a time, and share one link with everyone who needs to be there.</p>
            <div className="lobby-entry-note">
              <span>Guest entry</span>
              <p>Anyone with a meeting link can join without an account.</p>
            </div>
          </section>

          <section className="lobby-task-panel" aria-label="Account and meeting controls">
            <LobbyAuthCard />
          </section>
        </div>
      </main>
    </LandingThemeProvider>
  );
}
