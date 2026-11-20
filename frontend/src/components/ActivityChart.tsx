import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { HourlyActivity, TaskLogStatus } from '../api/types';

/*
 * Stacked columns, one per hour (dataviz marks spec): columns <= 24px, 2px surface gap between
 * segments, 4px rounded top on the last segment and square at the baseline, hairline solid grid.
 * Status colors (good / warning / critical) because the series mean outcome, not identity.
 * Every value is also in the table view; hover and keyboard focus show the same tooltip.
 */

const SERIES: Array<{ key: TaskLogStatus; label: string; color: string }> = [
  { key: 'success', label: 'Delivered', color: 'var(--status-good)' },
  { key: 'retrying', label: 'Retried', color: 'var(--status-warning)' },
  { key: 'failed', label: 'Failed', color: 'var(--status-critical)' },
];

const HEIGHT = 220;
const MARGIN = { top: 12, right: 8, bottom: 26, left: 36 };
const GAP = 2;
const RADIUS = 4;
const MAX_BAR = 24;

const hourLabel = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10].map((s) => s * magnitude);
  return steps.find((s) => s >= value) ?? 10 * magnitude;
}

/** Path of a column segment; only the top segment gets rounded corners. */
function segmentPath(x: number, y: number, w: number, h: number, roundTop: boolean): string {
  const r = roundTop ? Math.min(RADIUS, h, w / 2) : 0;
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    r ? `Q${x},${y} ${x + r},${y}` : '',
    `H${x + w - r}`,
    r ? `Q${x + w},${y} ${x + w},${y + r}` : '',
    `V${y + h}`,
    'Z',
  ].join(' ');
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function ActivityChart({ data, title }: { data: HourlyActivity[]; title: string }) {
  const { ref, width: measured } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const titleId = useId();
  // Draw at the container's real width so text never scales; 640 until the first measurement.
  const width = measured > 0 ? measured : 640;

  const totals = data.map((d) => d.success + d.retrying + d.failed);
  const yMax = niceMax(Math.max(...totals, 0));
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(MAX_BAR, Math.max(4, band * 0.62));
  const y = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH;
  const ticks = [0, yMax / 2, yMax];
  const labelEvery = width < 520 ? 6 : 3;
  const total = totals.reduce((a, b) => a + b, 0);

  const describe = (i: number) => {
    const d = data[i]!;
    return `${hourLabel.format(new Date(d.hour))}: ${SERIES.map((s) => `${d[s.key]} ${s.label.toLowerCase()}`).join(', ')}`;
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = data.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      Home: 0,
      End: last,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = keys[event.key]!;
    setActive(next);
    setAnnouncement(describe(next));
  }

  const activeDatum = active === null ? null : data[active];
  const tooltipLeft = active === null ? 0 : MARGIN.left + band * active + band / 2;

  return (
    <figure className="m-0" aria-labelledby={titleId}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption id={titleId} className="font-medium">
          {title}
        </figcaption>
        <ul className="flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={ref}
        className="relative outline-offset-4"
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${title}. ${total} attempts. Use left and right arrow keys to read each hour, or open the table below.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <svg width={width} height={HEIGHT} className="block" aria-hidden="true" focusable="false">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--grid)'} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = MARGIN.left + band * i + (band - barW) / 2;
            let base = 0;
            const visible = SERIES.filter((s) => d[s.key] > 0);
            return (
              <g key={d.hour} opacity={active === null || active === i ? 1 : 0.45}>
                {visible.map((s, index) => {
                  const top = base + d[s.key];
                  const y0 = y(base);
                  const y1 = y(top);
                  base = top;
                  const isTop = index === visible.length - 1;
                  // Leave a 2px surface gap above every segment that has another one on top of it.
                  const h = Math.max(1, y0 - y1 - (isTop ? 0 : GAP));
                  return <path key={s.key} d={segmentPath(x, y0 - h, barW, h, isTop)} fill={s.color} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={MARGIN.left + band * i + band / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {hourLabel.format(new Date(d.hour))}
                  </text>
                )}
                {/* Hit target: the whole hour band, not just the painted pixels. */}
                <rect
                  x={MARGIN.left + band * i}
                  y={MARGIN.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                />
              </g>
            );
          })}
        </svg>

        {activeDatum && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(tooltipLeft, 80), width - 80) }}
          >
            <p className="mb-1.5 text-muted">{hourLabel.format(new Date(activeDatum.hour))}</p>
            <ul className="space-y-1">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{activeDatum[s.key]}</span>
                  <span className="text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">View as table</summary>
        <div className="table-region mt-2 max-h-72" role="region" aria-label={`${title} table`} tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Hour</th>
                {SERIES.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.hour}>
                  <th scope="row" className="font-mono">
                    {hourLabel.format(new Date(d.hour))}
                  </th>
                  {SERIES.map((s) => (
                    <td key={s.key} data-label={s.label} className="tabular-nums">
                      {d[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
