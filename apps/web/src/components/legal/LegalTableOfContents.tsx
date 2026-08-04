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

  return (
    <aside className="lg:sticky lg:top-0 lg:z-10 lg:max-h-dvh lg:self-start lg:overflow-y-auto lg:pr-2" aria-label={`${title} contents`}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/45">On this page</p>
      <ol className="mt-5 grid gap-1 border-l border-white/10">
        {toc.map((item, index) => {
          const isActive = item.id === activeId;

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => setActiveId(item.id)}
                className={`group -ml-px flex gap-3 border-l px-4 py-2 text-sm leading-5 transition-colors ${
                  isActive
                    ? 'border-cyan bg-cyan/10 font-medium text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]'
                    : 'border-transparent text-white/50 hover:border-cyan/40 hover:bg-white/[0.035] hover:text-cyan'
                }`}
              >
                <span className={`font-mono text-[0.68rem] transition-colors ${isActive ? 'text-cyan' : 'text-white/25 group-hover:text-cyan/60'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
