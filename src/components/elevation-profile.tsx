"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RouteGeometry } from "@/lib/sharecode/analyze";
import { formatDistance } from "@/lib/format";

const H = 180;
const M = { top: 12, right: 12, bottom: 26, left: 44 };

/** Elevation along the racing line, gate by gate. Single series, so no legend. */
export function ElevationProfile({ geometry }: { geometry: RouteGeometry }) {
  const clipId = useId();
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real pixel width (not a scaled viewBox) so axis text stays 11px.
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = useMemo(() => {
    const line = geometry.primary.map((i) => geometry.gates[i]);
    if (geometry.loop && line.length > 1) line.push(line[0]);
    const out: { d: number; z: number; gate: number }[] = [];
    for (let i = 0; i < line.length; i++) {
      const g = line[i];
      const a = line[i - 1];
      const d = a ? out[i - 1].d + Math.hypot(g[0] - a[0], g[1] - a[1], g[2] - a[2]) : 0;
      out.push({ d, z: g[2], gate: (geometry.primary[i] ?? geometry.primary[0]) + 1 });
    }
    return out;
  }, [geometry]);

  if (pts.length < 2) return null;
  const total = pts[pts.length - 1].d || 1;
  let zMin = Math.min(...pts.map((p) => p.z));
  let zMax = Math.max(...pts.map((p) => p.z));
  // Never let a flat route fill the plot with noise: show at least 20 m of range.
  if (zMax - zMin < 20) {
    const mid = (zMax + zMin) / 2;
    zMin = mid - 10;
    zMax = mid + 10;
  }
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const x = (d: number) => M.left + (d / total) * iw;
  const y = (z: number) => M.top + (1 - (z - zMin) / (zMax - zMin)) * ih;
  const line = pts.map((p) => `${x(p.d).toFixed(1)},${y(p.z).toFixed(1)}`).join(" ");
  const area = `M${x(0)},${M.top + ih} L${line.replaceAll(" ", " L")} L${x(total)},${M.top + ih}Z`;
  const yTicks = [zMin, (zMin + zMax) / 2, zMax];
  const xTicks = [0, total / 2, total];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const d = ((e.clientX - r.left) / r.width) * total;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.d - d) < Math.abs(pts[best].d - d)) best = i;
    });
    setHover(best);
  };
  const h = hover != null ? pts[hover] : null;

  return (
    <figure ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label="Elevation profile">
        <defs>
          <clipPath id={clipId}>
            <rect x={M.left} y={M.top} width={iw} height={ih} />
          </clipPath>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {Math.round(t)} m
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={x(t)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            className="fill-muted text-[11px]"
          >
            {formatDistance(Math.round(t))}
          </text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          <path d={area} fill="var(--route-line)" fillOpacity="0.1" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--route-line)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
        {h && (
          <g pointerEvents="none">
            <line x1={x(h.d)} x2={x(h.d)} y1={M.top} y2={M.top + ih} stroke="var(--muted)" />
            <circle cx={x(h.d)} cy={y(h.z)} r="4.5" fill="var(--route-line)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(x(h.d) / W) * 100}%`,
            transform: `translateX(${x(h.d) > W / 2 ? "calc(-100% - 8px)" : "8px"})`,
          }}
        >
          <div className="font-semibold text-text">Gate {h.gate}</div>
          <div className="text-muted">
            {formatDistance(Math.round(h.d))} in · {Math.round(h.z)} m elevation
          </div>
        </div>
      )}
    </figure>
  );
}
