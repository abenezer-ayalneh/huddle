'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { ACCESSIBLE_LABEL, MARK_PATH, MARK_STROKE_WIDTH, MARK_VIEW_BOX, PORTFOLIO_URL } from '../shared/identity';
import { attachMakerTooltip } from '../web/tooltip';
import '../web/signature.css';

export type MakerSignatureProps = {
  /** Omit to inherit a readable host foreground. Overrides must contrast with the surface. */
  color?: CSSProperties['color'];
  className?: string;
  style?: CSSProperties;
};

export function MakerSignature({ color, className, style }: MakerSignatureProps) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (link.current) return attachMakerTooltip(link.current);
  }, []);

  return (
    <span className={['aa-maker', className].filter(Boolean).join(' ')} style={{ ...style, ...(color ? { color } : {}) }}>
      <a
        ref={link}
        className="aa-maker__link"
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${ACCESSIBLE_LABEL} (opens in a new tab)`}
      >
        <span>Made by</span>
        <svg className="aa-maker__mark" width="32" height="24" viewBox={MARK_VIEW_BOX} fill="none" aria-hidden="true" focusable="false">
          <path d={MARK_PATH} stroke="currentColor" strokeWidth={MARK_STROKE_WIDTH} strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      </a>
    </span>
  );
}
