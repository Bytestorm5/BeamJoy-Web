"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveSession } from "@/lib/live";
import { cropRoads, loadRoads } from "@/lib/road-layer";
import type { RoadLayer } from "./route-map";

const POLL_MS = 3_000;
const SIZE = 600;
/** Never zoom in closer than this many metres across. */
const MIN_SPAN = 400;

type Box = [number, number, number, number];

function fit(players: LiveSession["players"]): Box | null {
  const pts = players.filter((p) => !p.spectating);
  if (!pts.length) return null;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    minX = Math.min(minX, p.pos[0]);
    maxX = Math.max(maxX, p.pos[0]);
    minY = Math.min(minY, p.pos[1]);
    maxY = Math.max(maxY, p.pos[1]);
  }
  const span = Math.max(maxX - minX, maxY - minY, MIN_SPAN) * 1.3;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [cx - span / 2, cy - span / 2, cx + span / 2, cy + span / 2];
}

const contains = (b: Box, x: number, y: number) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/** The current view, unless someone left it or everyone bunched up far inside it. */
function reframe(v: Box | null, players: LiveSession["players"]): Box | null {
  const target = fit(players);
  if (!target || !v) return target ?? v;
  const out = players.some((p) => !p.spectating && !contains(v, p.pos[0], p.pos[1]));
  const tooWide = v[2] - v[0] > (target[2] - target[0]) * 4;
  return out || tooWide ? target : v;
}

/**
 * A live server: who's where, in what, how fast. Polls every few seconds while visible. The view
 * only re-frames when someone drives out of it (or everyone bunches up), so it doesn't jitter.
 */
export function LiveMap({ initial }: { initial: LiveSession }) {
  const [session, setSession] = useState(initial);
  const [view, setView] = useState<Box | null>(() => fit(initial.players));
  const [roads, setRoads] = useState<RoadLayer | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/live/${initial.slug}`);
          if (res.ok && !cancelled) {
            const next = (await res.json()) as LiveSession;
            setSession(next);
            setView((v) => reframe(v, next.players));
          }
        } catch {}
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initial.slug]);

  useEffect(() => {
    let live = true;
    loadRoads(session.level).then((m) => {
      if (live && m && view) setRoads(cropRoads(m, view, 100));
    });
    return () => {
      live = false;
    };
  }, [session.level, view]);

  const scale = view ? SIZE / (view[2] - view[0]) : 1;
  const p = useMemo(
    () => (x: number, y: number) => (view ? [(x - view[0]) * scale, (view[3] - y) * scale] : [0, 0]) as [number, number],
    [view, scale],
  );

  const driving = session.players.filter((pl) => !pl.spectating);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {view ? (
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={`Live map of ${session.serverName}`}>
            {roads ? (
              <g fill="none" stroke="var(--road)" strokeLinecap="round" strokeLinejoin="round">
                {roads.map((g, i) => (
                  <path
                    key={i}
                    strokeWidth={Math.max(1.2, g.width * scale)}
                    d={g.d.map((l) => `M${l.map(([x, y]) => p(x, y).map((n) => n.toFixed(1)).join(" ")).join("L")}`).join("")}
                  />
                ))}
              </g>
            ) : (
              <g stroke="var(--chart-grid)">
                {[1, 2, 3, 4, 5].map((k) => (
                  <g key={k}>
                    <line x1={(SIZE / 6) * k} y1="0" x2={(SIZE / 6) * k} y2={SIZE} />
                    <line x1="0" y1={(SIZE / 6) * k} x2={SIZE} y2={(SIZE / 6) * k} />
                  </g>
                ))}
              </g>
            )}
            {driving.map((pl) => {
              const [x, y] = p(pl.pos[0], pl.pos[1]);
              const on = selected === pl.name;
              return (
                <g
                  key={pl.name}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                  className="cursor-pointer transition-transform duration-[2900ms] ease-linear motion-reduce:transition-none"
                  onClick={() => setSelected(on ? null : pl.name)}
                >
                  <g transform={`rotate(${pl.heading}) scale(1.4)`}>
                    <path d="M0 -11 L6 6 L0 3 L-6 6 Z" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
                  </g>
                  <text
                    y="-18"
                    textAnchor="middle"
                    className="fill-text text-[12px] font-semibold"
                    stroke="var(--surface)"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {pl.name}
                  </text>
                  {on && (
                    <text y="22" textAnchor="middle" className="fill-text-2 text-[11px]" stroke="var(--surface)" strokeWidth="3" paintOrder="stroke">
                      {Math.round(pl.speed * 3.6)} km/h
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <p className="grid aspect-square place-items-center text-muted">Nobody is driving right now.</p>
        )}
      </div>

      <section aria-labelledby="players-h">
        <h2 id="players-h" className="mb-2 text-sm font-semibold text-text-2">
          Players <span className="text-muted">({session.players.length})</span>
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {session.players.map((pl) => (
            <li key={pl.name}>
              <button
                type="button"
                onClick={() => setSelected(selected === pl.name ? null : pl.name)}
                aria-pressed={selected === pl.name}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2 ${selected === pl.name ? "bg-surface-2" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{pl.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {pl.spectating ? "Spectating" : pl.vehicle || "On foot"}
                    {pl.activity ? ` · ${pl.activity}` : ""}
                  </span>
                </span>
                {!pl.spectating && (
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {Math.round(pl.speed * 3.6)}
                    <span className="text-xs text-muted"> km/h</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {!session.online && <p className="mt-3 text-sm text-muted">This server stopped sharing. Showing the last update.</p>}
      </section>
    </div>
  );
}
