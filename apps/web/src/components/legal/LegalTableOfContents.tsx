'use client';

import { useEffect, useState } from 'react';

type LegalTocItem = {
  id: string;
  label: string;
};

type LegalTableOfContentsProps = {
  title: string;
  toc: LegalTocItem[];
};

// The heading nearest the top edge is the reader's current place. A scroll
// listener is a better fit than scroll progress here: legal sections can vary
// substantially in length, but their headings are stable landmarks.
const ACTIVE_HEADING_OFFSET = 48;

export default function LegalTableOfContents({ title, toc }: LegalTableOfContentsProps) {
  const [activeId, setActiveId] = useState(toc[0]?.id ?? '');

  useEffect(() => {
    const sections = toc.map((item) => document.getElementById(item.id)).filter((section): section is HTMLElement => section !== null);

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      let nextId = sections[0]?.id ?? '';

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= ACTIVE_HEADING_OFFSET) nextId = section.id;
        else break;
      }

      setActiveId((currentId) => (currentId === nextId ? currentId : nextId));
    };
    const scheduleUpdate = () => {
      if (frame === 0) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [toc]);

  const activeIndex = Math.max(
    0,
    toc.findIndex((item) => item.id === activeId),
  );
  const activeItem = toc[activeIndex];
  const contents = (mobile = false) => (
    <ol className="legal-contents-list">
      {toc.map((item, index) => {
        const isActive = item.id === activeId;

        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(event) => {
                setActiveId(item.id);
                if (mobile) event.currentTarget.closest('details')?.removeAttribute('open');
              }}
              className={isActive ? 'is-active' : undefined}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{item.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <aside className="legal-contents" aria-label={`${title} contents`}>
      <div className="legal-contents-desktop">
        <p className="legal-mono-label">On this page</p>
        {contents()}
      </div>
      <details className="legal-contents-mobile">
        <summary>
          <span>
            <span className="legal-mono-label">Contents</span>
            <strong>{activeItem?.label ?? 'Sections'}</strong>
          </span>
          <span className="legal-contents-count">
            {String(activeIndex + 1).padStart(2, '0')} / {String(toc.length).padStart(2, '0')}
          </span>
        </summary>
        {contents(true)}
      </details>
    </aside>
  );
}
