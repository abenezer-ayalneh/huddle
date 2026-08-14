'use client';

import { type SVGProps } from 'react';

export default function LoadingSpinner(props: SVGProps<SVGSVGElement>) {
  const c = 32;
  // Match HuddleIcon's safe logo geometry: each dot remains 3px inside the
  // 64px viewBox at every point in the animation.
  const r = 22;
  const dotR = 7;
  const dur = '2.8s';
  const keyTimes = '0;0.15;0.3;0.35;0.5;0.65;1';
  const keySplines = '0.5 0 0.2 1;0.5 0 0.2 1;0 0 1 1;0.5 0 0.2 1;0.5 0 0.2 1;0 0 1 1';

  const top = { x: c, y: c - r };
  const right = { x: c + r, y: c };
  const bottom = { x: c, y: c + r };
  const left = { x: c - r, y: c };

  const dots = [
    { fill: 'var(--huddle-logo-primary, #8d2676)', path: [top, right, bottom] },
    { fill: 'var(--huddle-logo-accent, #f3b01c)', path: [right, bottom, left] },
    { fill: 'var(--huddle-logo-primary, #8d2676)', path: [bottom, left, top] },
    { fill: 'var(--huddle-logo-accent, #f3b01c)', path: [left, top, right] },
  ];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-label="Loading" {...props}>
      {dots.map((dot, i) => {
        const [a, b, d] = dot.path;
        const cxVals = `${a.x};${c};${b.x};${b.x};${c};${d.x};${d.x}`;
        const cyVals = `${a.y};${c};${b.y};${b.y};${c};${d.y};${d.y}`;

        return (
          <circle key={i} cx={a.x} cy={a.y} r={dotR} fill={dot.fill}>
            <animate
              className="loading-spinner__motion"
              attributeName="cx"
              values={cxVals}
              keyTimes={keyTimes}
              keySplines={keySplines}
              calcMode="spline"
              dur={dur}
              repeatCount="indefinite"
            />
            <animate
              className="loading-spinner__motion"
              attributeName="cy"
              values={cyVals}
              keyTimes={keyTimes}
              keySplines={keySplines}
              calcMode="spline"
              dur={dur}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}

      <polygon points="27,23 27,41 43,32" fill="var(--huddle-logo-play-stroke, #faf4e9)" />
      <polygon points="30,26 30,38 40,32" fill="var(--huddle-logo-play, #141414)" />
    </svg>
  );
}
