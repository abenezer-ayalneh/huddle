'use client';

/*
 * SIGNAL HANDOFF CONTRACT
 * THESIS: Huddle is the room where a meeting turns into shared work; the page refuses the generic SaaS card wall.
 * OWN-WORLD: Warm cream and chocolate fields, purple authority, yellow signal, red recording, flat 8–12px frames, and three routed handoff lines.
 * STORY: A team enters, presents a real website, asks for consent, collaborates, records the decision, and keeps infrastructure in its own hands.
 * FIRST VIEWPORT: A centered floating pill nav, left promise + Deploy/Try actions + room-code field, and a right code-native meeting scene.
 * FORM: Asymmetric route-map staging, selecting the editorial split with the product scene carrying equal visual weight; comp preview 2.
 */

import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Cloud,
  Code2,
  Container,
  HardDrive,
  Hand,
  KeyRound,
  LockKeyhole,
  Menu,
  MousePointer2,
  Play,
  Radio,
  Server,
  ShieldCheck,
  TimerReset,
  Wifi,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import HuddleIcon from '@/components/HuddleIcon';
import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';
import LandingJoinForm from './LandingJoinForm';
import LandingStory from '@/components/landing/LandingStory';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import { LandingHeroScene, LandingMeetingCanvas } from '@/components/landing/LandingProductScene';
import { publicConfig } from '@/lib/public-config';

const { projectRepositoryUrl: repositoryUrl, operatorContactUrl } = publicConfig;
const deploymentUrl = `${repositoryUrl}/blob/main/docs/DEPLOYMENT.md`;

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-1.02-.014-1.85-2.782.604-3.369-1.183-3.369-1.183-.455-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.004.071 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.337-.012 2.415-.012 2.742 0 .267.18.579.688.481A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

const navigation = [
  ['Story', '#story'],
  ['Entry', '#entry'],
  ['Control', '#control'],
  ['Stack', '#stack'],
] as const;

function LandingNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const sections = navigation.map(([, href]) => document.querySelector<HTMLElement>(href)).filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: '-18% 0px -64% 0px', threshold: [0, 0.2, 0.5] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const setSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setMenuOpen(false);
  };

  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label="Landing page navigation">
        <HuddleBrandThemeHeader
          homeHref="#top"
          navigation={
            <div className="landing-nav-main">
              <div className="landing-nav-links">
                {navigation.map(([label, href]) => {
                  const sectionId = href.slice(1);
                  const isActive = activeSection === sectionId;

                  return (
                    <Link
                      key={href}
                      href={href}
                      className={isActive ? 'is-active' : undefined}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => setSection(sectionId)}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
              <div className="landing-nav-actions">
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="landing-nav-github"
                  aria-label="GitHub repository"
                  title="GitHub repository"
                >
                  <GithubLogo className="size-5" />
                </a>
              </div>
            </div>
          }
          trailing={
            <button
              type="button"
              className="landing-menu-button"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          }
        />
      </nav>
      {menuOpen && (
        <div id="landing-mobile-menu" className="landing-mobile-menu">
          {navigation.map(([label, href]) => {
            const sectionId = href.slice(1);
            const isActive = activeSection === sectionId;

            return (
              <Link
                key={href}
                href={href}
                className={isActive ? 'is-active' : undefined}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => setSection(sectionId)}
              >
                {label}
              </Link>
            );
          })}
          <div className="landing-mobile-menu-actions">
            <a href={repositoryUrl} target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
              <GithubLogo className="size-5" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

export default function LandingPageClient() {
  return (
    <LandingThemeProvider>
      <main className="landing-shell" id="top">
        <LandingNavigation />

        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-kicker">
                <span className="landing-kicker-dot" /> SIGNAL HANDOFF / SELF-HOSTED
              </span>
              <h1 id="landing-hero-title">
                Meet, then <em>work together.</em>
              </h1>
              <p className="landing-hero-lede">Huddle turns a shared meeting link into a place to review, decide, and move the work forward.</p>
              <div className="landing-hero-actions">
                <Link href="/lobby" className="landing-primary-button">
                  <Play className="size-4 fill-current" /> Try the demo
                </Link>
                <a href={deploymentUrl} target="_blank" rel="noreferrer" className="landing-secondary-button">
                  Deploy Huddle <ArrowRight className="size-5" />
                </a>
              </div>
              <LandingJoinForm />
              <p className="landing-hero-note">
                <span>Apache-2.0</span> self-hosted software · operated on infrastructure you control.
              </p>
            </div>
            <LandingHeroScene />
          </div>
          <div className="landing-signal-route landing-signal-route-one" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="landing-signal-route landing-signal-route-two" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="landing-signal-route landing-signal-route-three" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </section>

        <section className="landing-proof-band" aria-label="Huddle deployment facts">
          <div className="landing-container landing-proof-band-inner">
            <span>
              <Circle className="size-2.5 fill-current" /> Browser-first
            </span>
            <span>
              <Circle className="size-2.5 fill-current" /> Guest link, no account
            </span>
            <span>
              <Circle className="size-2.5 fill-current" /> Server-enforced authority
            </span>
            <span>
              <Circle className="size-2.5 fill-current" /> Docker Compose deployment
            </span>
          </div>
        </section>

        <section id="story" className="landing-section landing-story-section" aria-labelledby="story-title">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-wide">
              <span className="landing-mono-label">THE HANDOFF</span>
              <h2 id="story-title">The room is not the destination.</h2>
              <p>Huddle carries the useful part of the meeting into the work itself, with consent and authority visible at every turn.</p>
            </div>
            <LandingStory />
          </div>
        </section>

        <section id="entry" className="landing-section landing-entry-section" aria-labelledby="entry-title">
          <div className="landing-container landing-entry-layout">
            <div className="landing-entry-copy">
              <span className="landing-mono-label">01 / CLIENT ENTRY</span>
              <h2 id="entry-title">One link for the client. Four clear signals for the team.</h2>
              <p>Guests open the shared link, complete a Device Check, Knock, and wait for the Host to Admit. No account. No meeting-app install.</p>
              <a href={repositoryUrl} target="_blank" rel="noreferrer" className="landing-text-link">
                See the room flow in the repository <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="landing-entry-flow" aria-label="Client entry flow">
              {[
                ['01', 'Shared link', LinkKeyIcon],
                ['02', 'Device Check', Wifi],
                ['03', 'Knock', Hand],
                ['04', 'Admit', ShieldCheck],
              ].map(([number, label, Icon]) => (
                <div key={label as string} className="landing-flow-step">
                  <span>{number as string}</span>
                  <Icon className="size-5" />
                  <strong>{label as string}</strong>
                  <ArrowRight className="landing-flow-arrow size-4" />
                </div>
              ))}
              <p className="landing-flow-caption">
                <LockKeyhole className="size-4" /> The Host decides who crosses the threshold.
              </p>
            </div>
          </div>
        </section>

        <section id="review" className="landing-section landing-review-section" aria-labelledby="review-title">
          <div className="landing-container">
            <div className="landing-section-heading">
              <span className="landing-mono-label">02 / WEBSITE REVIEW</span>
              <h2 id="review-title">Show the work. Keep the conversation attached.</h2>
              <p>The meeting model is real software: camera tiles, presentation stage, Chat, Host controls, and a Recording state that everyone can see.</p>
            </div>
            <LandingMeetingCanvas />
          </div>
        </section>

        <section id="control" className="landing-section landing-control-section" aria-labelledby="control-title">
          <div className="landing-container landing-control-layout">
            <div className="landing-control-intro">
              <span className="landing-mono-label">03 / ATTENDED REMOTE CONTROL</span>
              <h2 id="control-title">Let the client drive. Keep the stop button close.</h2>
              <p>The agency shares a staging site and runs the macOS Control Agent. The client stays in-browser and asks before anything moves.</p>
              <div className="landing-control-points">
                <span>
                  <Check /> Sharer approves the request
                </span>
                <span>
                  <Check /> Reconfirm every 30 minutes
                </span>
                <span>
                  <Check /> Either participant can Stop
                </span>
              </div>
            </div>
            <div className="landing-control-proof">
              <div className="landing-control-proof-head">
                <span>
                  <MousePointer2 className="size-4" /> Controlled handoff
                </span>
                <span className="landing-chip landing-chip-purple">
                  <Circle className="size-2 fill-current" /> Attended
                </span>
              </div>
              <div className="landing-control-proof-stage">
                <div className="landing-control-browser landing-control-browser-collab">
                  <span className="landing-site-label">STAGING / NORTH</span>
                  <strong>
                    Try the next
                    <br />
                    interaction.
                  </strong>
                  <span className="landing-control-cursor">
                    <MousePointer2 className="size-4" /> Jun
                  </span>
                  <span className="landing-collab-stamp">
                    <Hand className="size-4" /> Guided edit
                  </span>
                </div>
                <div className="landing-control-proof-sidebar">
                  <span className="landing-mono-label">CONTROL RAIL</span>
                  <strong>Jun is exploring</strong>
                  <p>Mouse, keyboard, trackpad scroll, and bounded plain-text clipboard.</p>
                  <div className="landing-control-timer">
                    <TimerReset className="size-4" />
                    <span>
                      Renews in <b>18:42</b>
                    </span>
                  </div>
                  <button type="button" className="landing-mini-button landing-mini-button-stop">
                    Stop control
                  </button>
                </div>
              </div>
              <div className="landing-control-exclusions">
                <span>
                  <X /> Files stay out
                </span>
                <span>
                  <X /> Audio stays out
                </span>
                <span>
                  <X /> Unattended stays out
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="recording" className="landing-section landing-recording-section" aria-labelledby="recording-title">
          <div className="landing-container landing-recording-layout">
            <div className="landing-recording-visual">
              <div className="landing-recording-window">
                <div className="landing-recording-window-bar">
                  <span />
                  <span />
                  <span />
                  <b>recording / homepage-review.mp4</b>
                </div>
                <div className="landing-recording-timeline">
                  <span className="landing-recording-play">
                    <Play className="size-4 fill-current" />
                  </span>
                  <i />
                  <i />
                  <i />
                  <span className="landing-recording-time">24:18</span>
                </div>
              </div>
              <div className="landing-recording-drive">
                <HardDrive className="size-5" />
                <span>
                  <b>MinIO</b>
                  <small>local retention</small>
                </span>
                <Check className="size-4" />
              </div>
              <div className="landing-recording-drive landing-recording-drive-muted">
                <Cloud className="size-5" />
                <span>
                  <b>Private Google Drive</b>
                  <small>optional delivery</small>
                </span>
                <ChevronDown className="size-4" />
              </div>
            </div>
            <div className="landing-recording-copy">
              <span className="landing-mono-label">04 / DECISION DELIVERY</span>
              <h2 id="recording-title">Leave with a record of the decision.</h2>
              <p>
                Recording is visible while it runs. Huddle keeps the local copy in MinIO for finite retention; a Host can connect a private Google Drive
                destination when the team needs delivery.
              </p>
              <div className="landing-recording-stats">
                <span>
                  <b>Visible</b>
                  <small>Recording indicator for everyone</small>
                </span>
                <span>
                  <b>Private</b>
                  <small>Drive delivery is separately connected</small>
                </span>
                <span>
                  <b>Finite</b>
                  <small>Local copies are not promised forever</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="stack" className="landing-section landing-stack-section" aria-labelledby="stack-title">
          <div className="landing-container">
            <div className="landing-stack-heading">
              <div>
                <span className="landing-mono-label">05 / INFRASTRUCTURE OWNERSHIP</span>
                <h2 id="stack-title">A meeting stack you can point at.</h2>
              </div>
              <a href={deploymentUrl} target="_blank" rel="noreferrer" className="landing-text-link">
                Read the VPS deployment guide <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="landing-architecture">
              <div className="landing-architecture-command">
                <span className="landing-mono-label">RUN IT YOURSELF</span>
                <p>docker compose -f infra/docker-compose.yml up -d</p>
                <span>One Docker host for the official evaluation shape. Your provider and capacity are yours to choose.</span>
              </div>
              <ol className="landing-architecture-list">
                {[
                  ['Next.js', 'Browser workflow', Code2],
                  ['NestJS', 'Authority + tokens', Server],
                  ['LiveKit', 'Real-time media', Radio],
                  ['Redis', 'Room coordination', RedisIcon],
                  ['Postgres', 'Accounts + rooms', HardDrive],
                  ['MinIO', 'Recording storage', HardDrive],
                  ['Caddy', 'TLS + front door', ShieldCheck],
                  ['Docker Compose', 'Deployment shape', Container],
                ].map(([name, role, Icon], index) => (
                  <li key={name as string}>
                    <span className="landing-architecture-number">0{index + 1}</span>
                    <Icon className="size-5" />
                    <div>
                      <strong>{name as string}</strong>
                      <small>{role as string}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="demo" className="landing-section landing-close-section" aria-labelledby="close-title">
          <div className="landing-container landing-close-layout">
            <div>
              <span className="landing-mono-label">DEPLOYMENT</span>
              <h2 id="close-title">Try the full shape. Own what comes next.</h2>
              <p>This deployment is operated independently. Deploy your own Huddle when the room belongs to your team.</p>
            </div>
            <div className="landing-close-actions">
              <Link href="/lobby" className="landing-primary-button">
                Open Huddle <ArrowRight className="size-5" />
              </Link>
              <a href={deploymentUrl} target="_blank" rel="noreferrer" className="landing-secondary-button">
                Deploy your own
              </a>
              <Link href="#join" className="landing-text-link">
                Join a room <ArrowDownRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section landing-faq-section" aria-labelledby="faq-title">
          <div className="landing-container landing-faq-layout">
            <div>
              <span className="landing-mono-label">FAQ / PLAIN TERMS</span>
              <h2 id="faq-title">The short version.</h2>
              <p>Huddle is deliberately specific about who can do what, where data goes, and what the demo is.</p>
            </div>
            <div className="landing-faq-list">
              <details open>
                <summary>Do guests need an account?</summary>
                <p>No. Guests open a shared Room Code link, complete the Device Check, Knock, and wait for a Host to Admit them.</p>
              </details>
              <details>
                <summary>What does self-hosted mean here?</summary>
                <p>
                  You run the web app, API, LiveKit, Redis, Postgres, MinIO, and Caddy on infrastructure you control. The documented target is a single VPS or
                  Docker host for small teams.
                </p>
              </details>
              <details>
                <summary>What is the Huddle license?</summary>
                <p>Huddle is released under the Apache-2.0 license. Third-party components keep their own licenses; see the repository NOTICE material.</p>
              </details>
              <details>
                <summary>What does Remote Control require?</summary>
                <p>
                  The meeting stays in the browser. Only the Sharer installs the macOS Control Agent, and each control session is attended, room-scoped,
                  identity-bound, and renewable every 30 minutes.
                </p>
              </details>
              <details>
                <summary>Where do Recordings go?</summary>
                <p>
                  Room-composite MP4 files are written to MinIO with finite local retention. A Host can separately connect a private Google Drive destination
                  for delivery.
                </p>
              </details>
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="landing-container landing-footer-inner">
            <Link href="#top" className="landing-footer-brand">
              <HuddleIcon className="size-7" />
              <span>Huddle · self-hosted meeting software</span>
            </Link>
            <div className="landing-footer-links">
              <a href={repositoryUrl} target="_blank" rel="noreferrer">
                Repository
              </a>
              <Link href="/downloads">Downloads</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <a href={operatorContactUrl} target="_blank" rel="noreferrer">
                Contact
              </a>
            </div>
            <p>Apache-2.0 · illustrative portraits and product scenes are fictional.</p>
          </div>
        </footer>
      </main>
    </LandingThemeProvider>
  );
}

function LinkKeyIcon(props: ComponentProps<typeof KeyRound>) {
  return <KeyRound {...props} />;
}

function RedisIcon(props: ComponentProps<typeof Radio>) {
  return <Radio {...props} />;
}
