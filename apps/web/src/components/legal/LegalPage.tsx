import type { ReactNode } from 'react';
import Link from 'next/link';
import { Scale, ShieldCheck } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';
import LegalNavigation from '@/components/legal/LegalNavigation';
import LegalTableOfContents from '@/components/legal/LegalTableOfContents';
import { publicConfig } from '@/lib/public-config';

/*
 * SIGNAL HANDOFF LEGAL DOSSIER
 * THESIS: Legal pages make Huddle's data and responsibility boundaries scannable, refusing generic marketing chrome.
 * OWN-WORLD: Warm paper or chocolate fields, purple authority, yellow signal routes, flat frames, and dossier-like metadata.
 * STORY: A reader identifies the document, moves between Privacy and Terms, finds a section, and reads without losing context.
 * FIRST VIEWPORT: Floating legal navigation above a left metadata masthead and a right document entrance, with the contents rail beginning below.
 * FORM: Asymmetric dossier masthead with a long reading column and numbered index; generated composition probe option 1.
 */

export type LegalTocItem = {
  id: string;
  label: string;
};

type LegalPageProps = {
  kind: 'privacy' | 'terms';
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  toc: LegalTocItem[];
  children: ReactNode;
};

export default function LegalPage({ kind, eyebrow, title, description, updatedAt, toc, children }: LegalPageProps) {
  const Icon = kind === 'privacy' ? ShieldCheck : Scale;
  const documentLabel = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  return (
    <main className="legal-shell" id="top">
      <LegalNavigation kind={kind} />

      <div className="legal-document-frame">
        <header className="legal-masthead">
          <div className="legal-masthead-intro">
            <span className="legal-mono-label">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          <aside className="legal-document-stamp" aria-label={`${documentLabel} document details`}>
            <span className="legal-document-icon">
              <Icon aria-hidden="true" strokeWidth={1.8} />
            </span>
            <p>Huddle legal dossier</p>
            <strong>{documentLabel}</strong>
            <dl>
              <div>
                <dt>Last updated</dt>
                <dd>{updatedAt}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>Web policy</dd>
              </div>
            </dl>
          </aside>

          <div className="legal-signal-route legal-signal-route-one" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </header>

        <div className="legal-document-layout">
          <LegalTableOfContents title={title} toc={toc} />
          <article className="legal-document-content">{children}</article>
        </div>
      </div>

      <footer className="legal-footer">
        <div className="legal-container legal-footer-inner">
          <div className="legal-footer-brand">
            <HuddleIcon className="size-7" />
            <span>Huddle · self-hosted meeting software</span>
          </div>
          <nav className="legal-footer-links" aria-label="Legal links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={publicConfig.operatorContactUrl}>Contact</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="legal-section">
      <h2>{title}</h2>
      <div className="legal-section-copy">{children}</div>
    </section>
  );
}

export function LegalCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-callout">
      <p>{title}</p>
      <div>{children}</div>
    </div>
  );
}
