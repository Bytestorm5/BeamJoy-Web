import type { Metadata } from "next";
import Link from "@/components/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { getViewer, requireReadLive } from "@/lib/access";
import { formatAgo, pluralize } from "@/lib/format";
import { listLive } from "@/lib/live";
import { livePath } from "@/lib/paths";

export const metadata: Metadata = { title: "Live" };

export default function LivePage({ searchParams }: PageProps<"/live">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">Live</h1>
      <p className="mt-2 mb-8 text-text-2">Servers sharing where their players are right now.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>
        <Sessions searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sessions({ searchParams }: { searchParams: PageProps<"/live">["searchParams"] }) {
  await requireReadLive(await getViewer());
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(typeof sp.page === "string" ? sp.page : 1) || 1));
  const { items, pages, asOf: now } = await listLive(page);
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-muted">
        No servers are live. Hosts turn it on in BeamJoy Live&apos;s server config.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {items.map((s) => (
          <li key={s.slug}>
            <Link href={livePath(s.slug)} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.serverName}</span>
                <span className="block truncate text-sm text-muted">{s.mapName}</span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-medium tabular-nums">{pluralize(s.playerCount, "player")}</span>
                <span className="block text-xs text-muted">{formatAgo(s.updatedAt.getTime(), now)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Pagination page={Math.min(page, pages)} pages={pages} href={(p) => (p > 1 ? `/live?page=${p}` : "/live")} />
      </div>
    </>
  );
}
