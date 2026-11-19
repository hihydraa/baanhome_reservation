import { cn } from "@/lib/utils";

/** Small dependency-free SVG charts for the KPI pages. Colours are Tailwind-free hex so they print and stay legible. */

const AXIS = "#8a948d";
const TARGET = "#1f4d3a";

export type BarItem = { label: string; value: number | null; target?: number | null; color?: string };

/** Bars per month (or day) with a short tick for the target on each, and the value written above the bar. */
export function BarTrend({
  items,
  format,
  height = 190,
  width = 360,
  className,
}: {
  items: BarItem[];
  format: (v: number) => string;
  height?: number;
  /** Drawing width: keep it near the on-screen width so the text stays readable (wider for a daily chart). */
  width?: number;
  className?: string;
}) {
  const slot = Math.max(12, Math.floor(width / Math.max(1, items.length)));
  const W = slot * items.length;
  const top = 18;
  const bottom = 22;
  const H = height;
  const max = Math.max(1, ...items.flatMap((i) => [i.value ?? 0, i.target ?? 0])) * 1.1;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const showValues = items.length <= 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full", className)} role="img">
      <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke={AXIS} strokeWidth={1} />
      {items.map((it, i) => {
        const cx = i * slot + slot / 2;
        const bw = Math.min(30, slot * 0.62);
        return (
          <g key={`${it.label}-${i}`}>
            {it.value != null && <rect x={cx - bw / 2} y={y(it.value)} width={bw} height={Math.max(0, H - bottom - y(it.value))} rx={3} fill={it.color ?? "#2f7d57"} />}
            {it.target != null && <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(it.target)} y2={y(it.target)} stroke={TARGET} strokeWidth={2} strokeDasharray="4 2" />}
            {showValues && it.value != null && (
              <text x={cx} y={y(it.value) - 4} textAnchor="middle" fontSize={11} fill="#22302a">
                {format(it.value)}
              </text>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill={AXIS}>
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type StackItem = { label: string; parts: { value: number; color: string }[]; target?: number | null };

/** Stacked bars (sales by channel) with the target tick per month. */
export function StackedBarTrend({ items, format, height = 190, width = 360 }: { items: StackItem[]; format: (v: number) => string; height?: number; width?: number }) {
  const slot = Math.max(12, Math.floor(width / Math.max(1, items.length)));
  const W = slot * items.length;
  const top = 18;
  const bottom = 22;
  const H = height;
  const totals = items.map((i) => i.parts.reduce((s, p) => s + p.value, 0));
  const max = Math.max(1, ...totals, ...items.map((i) => i.target ?? 0)) * 1.1;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke={AXIS} strokeWidth={1} />
      {items.map((it, i) => {
        const cx = i * slot + slot / 2;
        const bw = Math.min(30, slot * 0.62);
        let acc = 0;
        return (
          <g key={`${it.label}-${i}`}>
            {it.parts.map((p, k) => {
              const y0 = y(acc + p.value);
              const h = Math.max(0, y(acc) - y0);
              acc += p.value;
              return p.value > 0 ? <rect key={k} x={cx - bw / 2} y={y0} width={bw} height={h} fill={p.color} /> : null;
            })}
            {it.target != null && <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(it.target)} y2={y(it.target)} stroke={TARGET} strokeWidth={2} strokeDasharray="4 2" />}
            {totals[i] > 0 && (
              <text x={cx} y={y(totals[i]) - 4} textAnchor="middle" fontSize={11} fill="#22302a">
                {format(totals[i])}
              </text>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill={AXIS}>
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export type LineSeries = { name: string; color: string; values: (number | null)[]; dashed?: boolean };

/** Lines over the same labels, e.g. occupancy per month with its target. A gap (null) breaks the line. */
export function LineTrend({ labels, series, format, height = 190, width = 360 }: { labels: string[]; series: LineSeries[]; format: (v: number) => string; height?: number; width?: number }) {
  const slot = Math.max(12, Math.floor(width / Math.max(1, labels.length)));
  const W = slot * labels.length;
  const top = 18;
  const bottom = 22;
  const H = height;
  const max = Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v != null))) * 1.15;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const x = (i: number) => i * slot + slot / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke={AXIS} strokeWidth={1} />
      {series.map((s) => {
        const segments: string[] = [];
        let cur = "";
        s.values.forEach((v, i) => {
          if (v == null) {
            if (cur) segments.push(cur);
            cur = "";
          } else cur += `${cur ? "L" : "M"}${x(i)},${y(v)}`;
        });
        if (cur) segments.push(cur);
        return (
          <g key={s.name}>
            {segments.map((d, k) => (
              <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
            ))}
            {!s.dashed &&
              s.values.map((v, i) =>
                v == null ? null : (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />
                    <text x={x(i)} y={y(v) - 8} textAnchor="middle" fontSize={11} fill="#22302a">
                      {format(v)}
                    </text>
                  </g>
                )
              )}
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={`${l}-${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill={AXIS}>
          {l}
        </text>
      ))}
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}
