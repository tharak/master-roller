import type { CSSProperties, ReactNode } from "react";

// Twelve triangles cover the text exactly before separating at the impact.
const fragments = Array.from({ length: 12 }, (_, index) => {
  const column = Math.floor(index / 2) % 3;
  const row = Math.floor(index / 6);
  const left = (column * 100) / 3;
  const right = ((column + 1) * 100) / 3;
  const top = row * 50;
  const bottom = (row + 1) * 50;
  return {
    clipPath:
      index % 2
        ? `polygon(${right}% ${top}%, ${right}% ${bottom}%, ${left}% ${bottom}%)`
        : `polygon(${left}% ${top}%, ${right}% ${top}%, ${left}% ${bottom}%)`,
    "--shard-x": `${(column - 1) * 55 + (index % 2 ? 18 : -18)}px`,
    "--shard-y": `${(row ? 1 : -1) * (38 + (index % 3) * 18)}px`,
    "--shard-turn": `${(index % 2 ? 1 : -1) * (20 + index * 7)}deg`,
  } as CSSProperties;
});

export default function Shatter({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style: CSSProperties;
}) {
  return (
    <div
      className={`impact-shatter ${className}`}
      style={style}
      aria-hidden="true"
    >
      {fragments.map((fragment, index) => (
        <span className="impact-shard" style={fragment} key={index}>
          {children}
        </span>
      ))}
    </div>
  );
}
