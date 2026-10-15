import Link from "@/components/link";
import { formatAgo, formatLap } from "@/lib/format";
import type { BoardEntry, BoardSort } from "@/lib/leaderboard";
import { userPath } from "@/lib/paths";

/**
 * Leaderboard rows. Shared by the route page's top ten (server) and the live leaderboard page
 * (client, re-rendered on every poll), so it has no hooks of its own.
 */
export function LeaderboardTable({
  entries,
  sort,
  sectors,
  fastestSectors,
  leaderMs,
  now,
  fresh,
  removeSlot,
}: {
  entries: BoardEntry[];
  sort: BoardSort;
  sectors: number;
  fastestSectors: (number | null)[];
  /** The page's reference time for gaps: P1's time on this board. */
  leaderMs: number | null;
  now: number;
  /** Slugs of drivers whose time just changed, highlighted for a moment. */
  fresh?: Set<string>;
  removeSlot?: (entry: BoardEntry) => React.ReactNode;
}) {
  const showSectors = sectors >= 2;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted uppercase">
            <th scope="col" className="w-10 py-2 pr-2 font-semibold">#</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Driver</th>
            <th scope="col" className={`py-2 pr-3 text-right font-semibold ${sort === "lap" ? "text-text-2" : ""}`}>Best lap</th>
            {showSectors && (
              <th scope="col" className="hidden py-2 pr-3 text-right font-semibold md:table-cell">
                {sort === "theory" ? "Best sectors" : "Sectors"}
              </th>
            )}
            {showSectors && (
              <th scope="col" className={`py-2 pr-3 text-right font-semibold ${sort === "theory" ? "text-text-2" : ""}`}>
                Theoretical
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Gap</th>
            <th scope="col" className="hidden py-2 pr-3 font-semibold lg:table-cell">Car</th>
            <th scope="col" className="hidden py-2 text-right font-semibold sm:table-cell">Set</th>
            {removeSlot && <th scope="col" className="w-0"><span className="sr-only">Remove</span></th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const time = sort === "theory" ? e.theoreticalMs : e.bestLapMs;
            const gap = leaderMs != null && time != null && e.rank > 1 ? time - leaderMs : null;
            // Ranked by theoretical: show the sectors it's made of. Else the best lap's own splits.
            const splits = sort === "theory" ? e.bestSectors : e.sectors;
            return (
              <tr
                key={e.userSlug}
                className={`border-b border-border last:border-0 transition-colors duration-700 ${fresh?.has(e.userSlug) ? "bg-accent-soft" : ""}`}
              >
                <td className="py-2.5 pr-2 font-display text-lg font-semibold">{e.rank}</td>
                <td className="max-w-48 py-2.5 pr-3">
                  <Link href={userPath(e.userSlug)} className="flex min-w-0 items-center gap-2 hover:underline">
                    {e.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.image} alt="" className="size-6 shrink-0 rounded-full" />
                    ) : (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">
                        {e.name[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 truncate font-medium">{e.name}</span>
                  </Link>
                  {e.playerName && e.playerName !== e.name && (
                    <span className="block truncate pl-8 text-xs text-muted">{e.playerName}</span>
                  )}
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono ${sort === "lap" ? "font-semibold" : "text-text-2"}`}>
                  {formatLap(e.bestLapMs)}
                </td>
                {showSectors && (
                  <td className="hidden py-2.5 pr-3 text-right font-mono text-xs md:table-cell">
                    {splits ? (
                      <span className="inline-flex gap-1.5">
                        {splits.map((s, i) => (
                          <span
                            key={i}
                            title={s === fastestSectors[i] ? "Fastest anyone has done this sector" : undefined}
                            className={s === fastestSectors[i] ? "font-semibold text-sprint" : "text-text-2"}
                          >
                            {s != null ? formatLap(s) : "–"}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                )}
                {showSectors && (
                  <td className={`py-2.5 pr-3 text-right font-mono ${sort === "theory" ? "font-semibold" : "text-text-2"}`}>
                    {e.theoreticalMs != null ? formatLap(e.theoreticalMs) : <span className="text-muted">–</span>}
                  </td>
                )}
                <td className="py-2.5 pr-3 text-right font-mono text-text-2">{gap != null ? `+${formatLap(gap)}` : ""}</td>
                <td className="hidden max-w-40 truncate py-2.5 pr-3 text-text-2 lg:table-cell">{e.vehicle}</td>
                <td className="hidden py-2.5 text-right whitespace-nowrap text-muted sm:table-cell">{formatAgo(e.updatedAt, now)}</td>
                {removeSlot && <td className="py-2.5 pl-2">{removeSlot(e)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
