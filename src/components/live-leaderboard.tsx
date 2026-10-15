"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeTime } from "@/app/leaderboard-actions";
import type { BoardSort, Leaderboard } from "@/lib/leaderboard";
import { LeaderboardTable } from "./leaderboard-table";

/** How often the page asks for new times while it's visible. */
const POLL_MS = 10_000;

/**
 * A leaderboard page that keeps itself current: polls the JSON endpoint while the tab is
 * visible and highlights drivers whose time changed since the last look.
 */
export function LiveLeaderboard({
  routeSlug,
  sort,
  page,
  sectors,
  initial,
  leaderMs,
  moderate,
}: {
  routeSlug: string;
  sort: BoardSort;
  page: number;
  sectors: number;
  initial: Leaderboard;
  leaderMs: number | null;
  moderate: boolean;
}) {
  const [board, setBoard] = useState(initial);
  const [leader, setLeader] = useState(leaderMs);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Map(initial.entries.map((e) => [e.userSlug, e.updatedAt])));
  const [pending, start] = useTransition();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const qs = `sort=${sort}&page=${page}`;
          const [res, top] = await Promise.all([
            fetch(`/api/routes/${routeSlug}/leaderboard?${qs}`),
            page > 1 ? fetch(`/api/routes/${routeSlug}/leaderboard?sort=${sort}&size=1`) : null,
          ]);
          if (res.ok && !cancelled) {
            const next = (await res.json()) as Leaderboard;
            const changed = new Set(
              next.entries.filter((e) => seen.current.get(e.userSlug) !== e.updatedAt).map((e) => e.userSlug),
            );
            seen.current = new Map(next.entries.map((e) => [e.userSlug, e.updatedAt]));
            setBoard(next);
            setFresh(changed);
            const first = page > 1 && top?.ok ? ((await top.json()) as Leaderboard).entries[0] : next.entries[0];
            if (first) setLeader(sort === "theory" ? first.theoreticalMs : first.bestLapMs);
          }
        } catch {
          // Offline for a moment; the next tick tries again.
        }
        setNow(Date.now());
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [routeSlug, sort, page]);

  if (!board.entries.length) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-muted">
        {sort === "theory"
          ? "No theoretical laps yet. They need a time in every sector."
          : "No times yet. Drive it with BeamJoy Live linked and your laps appear here."}
      </p>
    );
  }
  return (
    <div aria-busy={pending}>
      <LeaderboardTable
        entries={board.entries}
        sort={sort}
        sectors={sectors}
        fastestSectors={board.fastestSectors}
        leaderMs={leader}
        now={now}
        fresh={fresh}
        removeSlot={
          moderate
            ? (e) => (
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-xs text-danger hover:text-danger"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove ${e.name}'s time?`)) {
                      start(async () => {
                        await removeTime(routeSlug, e.userSlug);
                        setBoard((b) => ({ ...b, entries: b.entries.filter((x) => x.userSlug !== e.userSlug) }));
                      });
                    }
                  }}
                >
                  Remove
                </button>
              )
            : undefined
        }
      />
    </div>
  );
}
