import { type SVGProps } from "react";

export default function HuddleIcon(props: SVGProps<SVGSVGElement>) {
  const magenta = "#d946a8";
  const cyan = "#5ce0d6";

  // 4 dots on a ring, radius 28 from center (64×64 viewBox)
  const r = 28;
  const cx = 32;
  const cy = 32;
  const dotR = 8;
  const dots = [
    { x: cx, y: cy - r, fill: magenta }, // top
    { x: cx + r, y: cy, fill: cyan }, // right
    { x: cx, y: cy + r, fill: magenta }, // bottom
    { x: cx - r, y: cy, fill: cyan }, // left
  ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-label="Huddle"
      {...props}
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dotR} fill={d.fill} />
      ))}
      {/* Play triangle in center */}
      <polygon points="27,24 27,40 41,32" fill="white" opacity={0.92} />
    </svg>
  );
}
