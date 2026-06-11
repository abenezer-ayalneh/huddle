"use client";

import { type SVGProps } from "react";

export default function LoadingSpinner(props: SVGProps<SVGSVGElement>) {
  const magenta = "#d946a8";
  const cyan = "#5ce0d6";

  const c = 32;
  const r = 28;
  const dur = "2.8s";
  const keyTimes = "0;0.15;0.3;0.35;0.5;0.65;1";
  const keySplines = "0.5 0 0.2 1;0.5 0 0.2 1;0 0 1 1;0.5 0 0.2 1;0.5 0 0.2 1;0 0 1 1";

  const top = { x: c, y: c - r };
  const right = { x: c + r, y: c };
  const bottom = { x: c, y: c + r };
  const left = { x: c - r, y: c };

  const dots = [
    { fill: magenta, path: [top, right, bottom] },
    { fill: cyan, path: [right, bottom, left] },
    { fill: magenta, path: [bottom, left, top] },
    { fill: cyan, path: [left, top, right] },
  ];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-label="Loading" {...props}>
      {dots.map((dot, i) => {
        const [a, b, d] = dot.path;
        const cxVals = `${a.x};${c};${b.x};${b.x};${c};${d.x};${d.x}`;
        const cyVals = `${a.y};${c};${b.y};${b.y};${c};${d.y};${d.y}`;

        return (
          <circle key={i} cx={a.x} cy={a.y} r={8} fill={dot.fill}>
            <animate attributeName="cx" values={cxVals} keyTimes={keyTimes} keySplines={keySplines} calcMode="spline" dur={dur} repeatCount="indefinite" />
            <animate attributeName="cy" values={cyVals} keyTimes={keyTimes} keySplines={keySplines} calcMode="spline" dur={dur} repeatCount="indefinite" />
          </circle>
        );
      })}

      <polygon points="27,24 27,40 41,32" fill="white" opacity={0.92}>
        <animate
          attributeName="opacity"
          values="0.92;0.3;0.92;0.92;0.3;0.92;0.92"
          keyTimes={keyTimes}
          keySplines={keySplines}
          calcMode="spline"
          dur={dur}
          repeatCount="indefinite"
        />
      </polygon>
    </svg>
  );
}
