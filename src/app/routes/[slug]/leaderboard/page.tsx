import type { Metadata } from "next";
import Link from "@/components/link";
import { notFound } from "next/navigation";
import { LiveLeaderboard } from "@/components/live-leaderboard";
import { Pagination } from "@/components/pagination";
import { getViewer, leaderboardControls, requireReadRoutes } from "@/lib/access";
import { pluralize } from "@/lib/format";
import { leaderboard, parseSort } from "@/lib/leaderboard";
import { leaderboardPath, mapPath, routePath } from "@/lib/paths";
import { getRoute } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/routes/[slug]/leaderboard">): Promise<Metadata> {
  const route = await getRoute((await params).slug);
  if (!route) return { title: "Route not found" };
  return { title: `${route.title} leaderboard`, alternates: { canonical: leaderboardPath(route.slug) } };
}

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/routes/[slug]/leaderboard">) {
  const [route, viewer, sp] = await Promise.all([getRoute((await params).slug), getViewer(), searchParams]);
  if (!route) notFound();
  await requireReadRoutes(viewer);

  const sort = parseSort(sp.sort);
  const page = Math.max(1, Math.floor(Number(typeof sp.page === "string" ? sp.page : 1) || 1));
  const [board, top, can] = await Promise.all([
    leaderboard(route.id, sort, page),
    page > 1 ? leaderboard(route.id, sort, 1, 1) : null,
    leaderboardControls(viewer, route),
  ]);
  const first = (top ?? board).entries[0];
  const leaderMs = first ? (sort === "theory" ? first.theoreticalMs : first.bestLapMs) : null;
  const base = leaderboardPath(route.slug);
  const href = (s: string, p: number) => {
    const q = new URLSearchParams();
    if (s !== "lap") q.set("sort", s);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href={mapPath(route.mapKey)} className="hover:text-text">
          {route.mapName}
        </Link>
        <span aria-hidden> / </span>
        <Link href={routePath(route.slug)} className="hover:text-text">
          {route.title}
        </Link>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">Leaderboard</h1>
          <p className="mt-1 flex items-center gap-2 text-text-2">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-circuit opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-circuit" />
            </span>
            Live · {pluralize(board.total, "driver")}
          </p>
        </div>
        {route.sectors >= 2 && (
          <div className="inline-flex rounded-md border border-border p-0.5 text-sm" role="group" aria-label="Rank by">
            {(
              [
                ["lap", "Best lap"],
                ["theory", "Theoretical"],
              ] as const
            ).map(([s, label]) => (
              <Link
                key={s}
                href={href(s, 1)}
                aria-current={sort === s ? "page" : undefined}
                className={`rounded px-3 py-1.5 font-medium ${sort === s ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <section className="rounded-xl border border-border bg-surface px-4 py-2">
        <LiveLeaderboard
          key={`${sort}-${page}`}
          routeSlug={route.slug}
          sort={sort}
          page={page}
          sectors={route.sectors}
          initial={board}
          leaderMs={leaderMs}
          moderate={can.moderate}
        />
      </section>
      {route.sectors >= 2 && (
        <p className="mt-3 text-xs text-muted">
          Theoretical: the sum of a driver&apos;s best time in each sector. <span className="text-sprint">Purple</span>: fastest
          anyone has done that sector.
        </p>
      )}
      <div className="mt-8">
        <Pagination page={Math.min(page, board.pages)} pages={board.pages} href={(p) => href(sort, p)} />
      </div>
    </div>
  );
}
