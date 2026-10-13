import Link from "next/link";
import { Suspense } from "react";
import { FilterDrawer } from "@/components/filter-drawer";
import { FilterPanel, SortSelect } from "@/components/filter-panel";
import { Pagination } from "@/components/pagination";
import { RouteCard } from "@/components/route-card";
import { SURFACE_LABEL } from "@/lib/constants";
import { activeFilterCount, filtersToQuery, parseFilters, type Filters } from "@/lib/filters";
import { pluralize } from "@/lib/format";
import { getUser, mapFacets, searchRoutes } from "@/lib/queries";

export default function CatalogPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-8 sm:py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">
          Race routes for BeamJoy servers
        </h1>
        <p className="mt-2 max-w-2xl text-text-2">
          Browse routes other players built, copy a share code, and import it in-game from the
          BeamJoy race editor. Built one yourself?{" "}
          <Link href="/submit" className="font-medium text-accent hover:underline">
            Share it
          </Link>
          .
        </p>
      </section>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const [result, maps, author] = await Promise.all([
    searchRoutes(filters),
    mapFacets(),
    filters.author ? getUser(filters.author) : null,
  ]);
  const active = activeFilterCount(filters);
  const query = filtersToQuery(filters, { page: 1 }).slice(1);

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <FilterDrawer activeCount={active}>
          <FilterPanel key={query} filters={filters} maps={maps} activeCount={active} />
        </FilterDrawer>
      </aside>

      <section aria-label="Routes" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {pluralize(result.total, "route")}
            {active > 0 ? (result.total === 1 ? " matches your filters" : " match your filters") : ""}
          </p>
          <SortSelect value={filters.sort} query={query} />
        </div>

        <ActiveChips filters={filters} maps={maps} authorName={author?.name} />

        {result.items.length === 0 ? (
          <EmptyState filtered={active > 0} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </div>
        )}

        <div className="mt-10">
          <Pagination
            page={Math.min(filters.page, result.pages)}
            pages={result.pages}
            href={(page) => `/${filtersToQuery(filters, { page })}`}
          />
        </div>
      </section>
    </div>
  );
}

function ActiveChips({
  filters,
  maps,
  authorName,
}: {
  filters: Filters;
  maps: { key: string; name: string }[];
  authorName?: string;
}) {
  const chips: { label: string; patch: Partial<Filters> }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, patch: { q: "" } });
  if (filters.author) chips.push({ label: `By ${authorName ?? "author"}`, patch: { author: null } });
  if (filters.tag) chips.push({ label: `#${filters.tag}`, patch: { tag: null } });
  for (const m of filters.maps) {
    chips.push({
      label: maps.find((x) => x.key === m)?.name ?? m,
      patch: { maps: filters.maps.filter((x) => x !== m) },
    });
  }
  if (filters.layout) chips.push({ label: filters.layout === "circuit" ? "Circuits" : "Sprints", patch: { layout: null } });
  for (const s of filters.surfaces) {
    chips.push({ label: SURFACE_LABEL[s], patch: { surfaces: filters.surfaces.filter((x) => x !== s) } });
  }
  const range = (lo: number | null, hi: number | null, unit: string) =>
    lo != null && hi != null ? `${lo}–${hi} ${unit}` : lo != null ? `≥ ${lo} ${unit}` : `≤ ${hi} ${unit}`;
  if (filters.dmin != null || filters.dmax != null)
    chips.push({ label: range(filters.dmin, filters.dmax, "km"), patch: { dmin: null, dmax: null } });
  if (filters.cpmin != null || filters.cpmax != null)
    chips.push({ label: range(filters.cpmin, filters.cpmax, "gates"), patch: { cpmin: null, cpmax: null } });
  if (filters.cmin != null || filters.cmax != null)
    chips.push({ label: range(filters.cmin, filters.cmax, "corners"), patch: { cmin: null, cmax: null } });
  if (filters.grid != null) chips.push({ label: `${filters.grid}+ grid slots`, patch: { grid: null } });
  if (filters.branching) chips.push({ label: "Branching", patch: { branching: false } });
  if (!chips.length) return null;

  return (
    <ul className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label}>
          <Link
            href={`/${filtersToQuery(filters, { ...c.patch, page: 1 })}`}
            scroll={false}
            className="chip py-1 hover:border-border-strong hover:text-text"
            aria-label={`Remove filter ${c.label}`}
          >
            {c.label} <span aria-hidden>×</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
      <p className="font-display text-2xl font-semibold uppercase">
        {filtered ? "No routes match" : "No routes yet"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {filtered
          ? "Try widening the length or corner range, or clear a few filters."
          : "Be the first: export a race from the in-game BeamJoy race editor and share its code."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {filtered && (
          <Link href="/" className="btn-secondary">
            Clear filters
          </Link>
        )}
        <Link href="/submit" className="btn-primary">
          Share a route
        </Link>
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]" aria-hidden>
      <div className="hidden h-[32rem] animate-pulse rounded-xl bg-surface lg:block" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
