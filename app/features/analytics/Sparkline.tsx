/**
 * Tiny dependency-free sparkline — an SVG polyline scaled to its container.
 * Good enough for a dashboard at-a-glance; swap for a real charting lib only
 * if the analytics page gets a full-fat view.
 */
export function Sparkline({
  values,
  width = 240,
  height = 60,
  stroke = "#008060",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length === 0) {
    return <span style={{ color: "#888" }}>No data</span>;
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values
    .map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`)
    .join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label="sparkline">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}
