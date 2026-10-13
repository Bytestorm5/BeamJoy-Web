"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyPoint } from "@/lib/queries";

const H = 170;
const M = { top: 10, right: 12, bottom: 24, left: 34 };

const SERIES = [
  { key: "views", label: "Views", color: "var(--series-views)" },
  { key: "copies", label: "Downloads", color: "var(--series-downloads)" },
] as const;

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function niceMax(v: number) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag * 4 >= v)! * mag;
  return step * 4;
}

/** Daily views and downloads over the last N days. Two series on one count axis. */
export function ActivityChart({ data, totals }: { data: DailyPoint[]; totals: { views: number; copies: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const yMax = niceMax(Math.max(1, ...data.map((d) => Math.max(d.views, d.copies))));
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => M.top + (1 - v / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];
  const recent = data.reduce((a, d) => ({ views: a.views + d.views, copies: a.copies + d.copies }), { views: 0, copies: 0 });
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-baseline gap-2">
            <span aria-hidden className="inline-block h-0.5 w-4 -translate-y-1 rounded" style={{ background: s.color }} />
            <span className="text-sm text-text-2">{s.label}</span>
            <span className="font-display text-xl font-semibold tabular-nums">{recent[s.key].toLocaleString("en-US")}</span>
            <span className="text-xs text-muted">({totals[s.key].toLocaleString("en-US")} all time)</span>
          </li>
        ))}
      </ul>

      <div ref={ref} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label={`Views and downloads per day, last ${n} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
              <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {[0, Math.floor((n - 1) / 2), n - 1].map((i, k) => (
            <text
              key={k}
              x={x(i)}
              y={H - 6}
              textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {k === 2 ? "Today" : fmtDay(data[i].day)}
            </text>
          ))}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              points={data.map((d, i) => `${x(i).toFixed(1)},${y(d[s.key]).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {h && hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--muted)" />
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(h[s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
              setHover(Math.min(n - 1, Math.max(0, i)));
            }}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && hover != null && (
          <div
            className="pointer-events-none absolute top-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${x(hover) > W / 2 ? "calc(-100% - 8px)" : "8px"})`,
            }}
          >
            <div className="font-semibold text-text">{fmtDay(h.day)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-text-2">
                <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                {s.label}: <span className="font-medium text-text tabular-nums">{h[s.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted hover:text-text-2">Show as table</summary>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Day (UTC)</th>
                <th className="px-3 py-1.5 text-right font-semibold">Views</th>
                <th className="px-3 py-1.5 text-right font-semibold">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="px-3 py-1">{fmtDay(d.day)}</td>
                  <td className="px-3 py-1 text-right">{d.views}</td>
                  <td className="px-3 py-1 text-right">{d.copies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
