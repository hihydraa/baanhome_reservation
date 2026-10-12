"use client";

import { useState } from "react";

export type DailyOccPoint = { date: string; label: string; value: number; detail: string };

const W = 720;
const H = 180;
const PAD = { top: 10, right: 8, bottom: 22, left: 34 };

/** Daily occupancy as thin bars (one series, one axis) with a hover tooltip and a table fallback. */
export function DailyOccChart({
  title,
  points,
  color,
  weekendDates,
}: {
  title: string;
  points: DailyOccPoint[];
  color: string;
  weekendDates: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(18, slot - 2));
  const y = (v: number) => PAD.top + plotH - (Math.min(100, v) / 100) * plotH;
  const weekend = new Set(weekendDates);
  // Thin the x labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(points.length / 15));
  const active = hover != null ? points[hover] : null;
  const avg = points.length > 0 ? points.reduce((s, p) => s + p.value, 0) / points.length : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-forest-800">{title}</p>
        <p className="text-xs text-ink-400">เฉลี่ย {avg.toFixed(1)}% · แท่งสีจาง = เสาร์-อาทิตย์</p>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-cream-200" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-400" fontSize={10}>
                {t}%
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const h = Math.max(p.value > 0 ? 2 : 0, plotH - (y(p.value) - PAD.top));
            return (
              <g key={p.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                {/* full-height hit target, wider than the mark */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
                {hover === i && <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} className="fill-cream-200/60" />}
                <rect
                  x={x}
                  y={PAD.top + plotH - h}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2)}
                  fill={color}
                  opacity={weekend.has(p.date) ? 0.55 : 1}
                />
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-ink-400" fontSize={10}>
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-cream-200 bg-white px-2 py-1 text-xs shadow-sm"
            style={{ left: `${((PAD.left + (hover! + 0.5) * slot) / W) * 100}%` }}
          >
            <p className="font-medium text-forest-800">{active.date}</p>
            <p className="text-ink-600">
              {active.value.toFixed(1)}% · {active.detail}
            </p>
          </div>
        )}
      </div>
      <details className="text-xs text-ink-600">
        <summary className="cursor-pointer text-forest-700">ดูเป็นตาราง</summary>
        <div className="mt-1 max-h-48 overflow-y-auto">
          <table className="w-full">
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-cream-200">
                  <td className="py-0.5 pr-2">{p.date}</td>
                  <td className="py-0.5 pr-2 text-right">{p.value.toFixed(1)}%</td>
                  <td className="py-0.5 text-ink-400">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
