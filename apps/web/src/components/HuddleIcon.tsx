import { type SVGProps } from 'react';

export default function HuddleIcon(props: SVGProps<SVGSVGElement>) {
  // Keep the complete signal ring inside the viewBox so every raster export,
  // including 16px favicons, retains an antialiased safety margin.
  const r = 22;
  const cx = 32;
  const cy = 32;
  const dotR = 7;
  const dots = [
    { x: cx, y: cy - r, fill: 'var(--huddle-logo-primary, #8d2676)' }, // top
    { x: cx + r, y: cy, fill: 'var(--huddle-logo-accent, #f3b01c)' }, // right
    { x: cx, y: cy + r, fill: 'var(--huddle-logo-primary, #8d2676)' }, // bottom
    { x: cx - r, y: cy, fill: 'var(--huddle-logo-accent, #f3b01c)' }, // left
  ];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-label="Huddle" {...props}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dotR} fill={d.fill} />
      ))}
      {/* Nested triangles keep the play glyph legible without adding a fifth circle. */}
      <polygon
        points="27,23 27,41 43,32"
        fill="var(--huddle-logo-play-stroke, #faf4e9)"
      />
      <polygon points="30,26 30,38 40,32" fill="var(--huddle-logo-play, #141414)" />
    </svg>
  );
}
