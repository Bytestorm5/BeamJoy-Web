import type { Metadata } from "next";
import Link from "@/components/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { VANILLA_MAPS } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import { mapPath } from "@/lib/paths";
import { listModMaps, vanillaMapCounts } from "@/lib/queries";

export const metadata: Metadata = { title: "Maps" };

export default function MapsPage({ searchParams }: PageProps<"/maps">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">Maps</h1>
      <div className="mb-8" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
        <MapsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MapsContent({ searchParams }: { searchParams: PageProps<"/maps">["searchParams"] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const [counts, mods] = await Promise.all([vanillaMapCounts(), listModMaps(q, page)]);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">Base game</h2>
        {/* Fixed list (the base game's own levels), so it can't grow without bound. */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VANILLA_MAPS.map((m) => {
            const n = counts[m.slug] ?? 0;
            return (
              <li key={m.level}>
                <Link
                  href={mapPath(m.slug)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-border-strong"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className={`text-sm tabular-nums ${n ? "text-text-2" : "text-muted"}`}>
                    {pluralize(n, "route")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold uppercase">
            Mod maps <span className="text-muted">({mods.total})</span>
          </h2>
          <form action="/maps" className="flex gap-2">
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search mod maps"
              aria-label="Search mod maps"
              className="field w-56"
            />
            <button className="btn-secondary">Search</button>
          </form>
        </div>
        {mods.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted">
            {q ? `No matches for “${q}”.` : "No mod maps yet."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mods.items.map((m) => (
              <li
                key={m.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <Link href={mapPath(m.key)} className="block truncate font-medium hover:underline">
                    {m.name}
                  </Link>
                  <p className="text-sm text-muted">{pluralize(m.routes, "route")}</p>
                </div>
                {m.downloadUrl && (
                  <a href={m.downloadUrl} target="_blank" rel="noreferrer nofollow" className="btn-secondary shrink-0 px-3 py-1.5">
                    Download ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <Pagination
            page={Math.min(page, mods.pages)}
            pages={mods.pages}
            href={(p) => `/maps?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`}
          />
        </div>
      </section>
    </div>
  );
}
