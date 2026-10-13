import Link from "@/components/link";
import { FilterDrawer } from "@/components/filter-drawer";
import { FilterPanel, SortSelect } from "@/components/filter-panel";
import { Pagination } from "@/components/pagination";
import { RouteCard } from "@/components/route-card";
import { SURFACE_LABEL } from "@/lib/constants";
import { activeFilterCount, filtersToQuery, parseFilters, type Filters } from "@/lib/filters";
import { pluralize } from "@/lib/format";
import { getUser, mapFacets, searchRoutes } from "@/lib/queries";

/**
 * The route catalog: filters, sort, results and pages, all driven by the URL. Used by the home
 * page and by each map's page (`lockedMap`), where the map is fixed and its filter hidden.
 */
export async function Catalog({
  searchParams,
  basePath = "/",
  lockedMap,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath?: string;
  lockedMap?: string;
}) {
  const parsed = parseFilters(await searchParams);
  // URLs never carry the locked map; queries always do.
  const filters = lockedMap ? { ...parsed, maps: [] } : parsed;
  const [result, maps, author] = await Promise.all([
    searchRoutes(lockedMap ? { ...filters, maps: [lockedMap] } : filters),
    lockedMap ? [] : mapFacets(),
    filters.author ? getUser(filters.author) : null,
  ]);
  const active = activeFilterCount(filters);
  const query = filtersToQuery(filters, { page: 1 }).slice(1);
  const href = (patch: Partial<Filters>) => basePath + filtersToQuery(filters, patch);

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <FilterDrawer activeCount={active}>
          <FilterPanel
            key={query}
            filters={filters}
            maps={maps}
            showMaps={!lockedMap}
            basePath={basePath}
            activeCount={active}
          />
        </FilterDrawer>
      </aside>

      <section aria-label="Routes" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {pluralize(result.total, "route")}
          </p>
          <SortSelect value={filters.sort} query={query} basePath={basePath} />
        </div>

        <ActiveChips filters={filters} maps={maps} authorName={author?.name} href={href} />

        {result.items.length === 0 ? (
          <EmptyState filtered={active > 0} clearHref={basePath} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((r) => (
              <RouteCard key={r.slug} route={r} />
            ))}
          </div>
        )}

        <div className="mt-10">
          <Pagination
            page={Math.min(filters.page, result.pages)}
            pages={result.pages}
            href={(page) => href({ page })}
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
  href,
}: {
  filters: Filters;
  maps: { key: string; name: string }[];
  authorName?: string;
  href: (patch: Partial<Filters>) => string;
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
            href={href({ ...c.patch, page: 1 })}
            scroll={false}
            className="chip py-1 hover:border-border-strong hover:text-text"
            aria-label={`Remove ${c.label}`}
          >
            {c.label} <span aria-hidden>×</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ filtered, clearHref }: { filtered: boolean; clearHref: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
      <p className="font-display text-2xl font-semibold uppercase">
        {filtered ? "No matches" : "No routes yet"}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {filtered && (
          <Link href={clearHref} className="btn-secondary">
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

export function CatalogSkeleton() {
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
