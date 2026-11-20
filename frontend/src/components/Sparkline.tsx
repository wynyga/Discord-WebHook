interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/**
 * Trend beside a stat value (dataviz stat-tile contract): a 2px line in the de-emphasis ink, the
 * current point as an accent dot with a surface ring. Decorative: the number next to it is the value.
 */
export function Sparkline({ values, width = 96, height = 28 }: SparklineProps) {
  if (values.length < 2) return null;
  const pad = 5;
  const max = Math.max(...values, 1);
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const last = points.at(-1)!;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" className="shrink-0">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
