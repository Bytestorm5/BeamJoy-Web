import { SORTS, SURFACES, type Sort } from "./constants";

/** Catalog filters, round-tripped through the URL so every filtered view is linkable. */
export type Filters = {
  q: string;
  maps: string[];
  layout: "circuit" | "sprint" | null;
  surfaces: string[];
  /** km */
  dmin: number | null;
  dmax: number | null;
  cpmin: number | null;
  cpmax: number | null;
  cmin: number | null;
  cmax: number | null;
  grid: number | null;
  branching: boolean;
  /** "with": routes that place props, "none": routes without any. */
  props: "with" | "none" | null;
  tag: string | null;
  author: string | null;
  sort: Sort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(",")).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string | string[] | undefined) => {
  const s = one(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function parseFilters(sp: RawParams): Filters {
  const sort = one(sp.sort);
  const layout = one(sp.layout);
  const props = one(sp.props);
  const validSurfaces = new Set<string>(SURFACES.map((s) => s.value));
  return {
    q: one(sp.q).trim().slice(0, 100),
    maps: list(sp.map).slice(0, 20),
    layout: layout === "circuit" || layout === "sprint" ? layout : null,
    surfaces: list(sp.surface).filter((s) => validSurfaces.has(s)),
    dmin: num(sp.dmin),
    dmax: num(sp.dmax),
    cpmin: num(sp.cpmin),
    cpmax: num(sp.cpmax),
    cmin: num(sp.cmin),
    cmax: num(sp.cmax),
    grid: num(sp.grid),
    branching: one(sp.branching) === "1",
    props: props === "with" || props === "none" ? props : null,
    tag: one(sp.tag).trim().toLowerCase().slice(0, 24) || null,
    author: one(sp.author).trim() || null,
    sort: (SORTS.some((s) => s.value === sort) ? sort : "new") as Sort,
    page: Math.max(1, Math.floor(num(sp.page) ?? 1)),
  };
}

/** Serialize back to a query string, dropping defaults. `patch` overrides individual keys. */
export function filtersToQuery(f: Filters, patch: Partial<Filters> = {}) {
  const v = { ...f, ...patch };
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  v.maps.forEach((m) => p.append("map", m));
  if (v.layout) p.set("layout", v.layout);
  v.surfaces.forEach((s) => p.append("surface", s));
  for (const k of ["dmin", "dmax", "cpmin", "cpmax", "cmin", "cmax", "grid"] as const) {
    if (v[k] != null) p.set(k, String(v[k]));
  }
  if (v.branching) p.set("branching", "1");
  if (v.props) p.set("props", v.props);
  if (v.tag) p.set("tag", v.tag);
  if (v.author) p.set("author", v.author);
  if (v.sort !== "new") p.set("sort", v.sort);
  if (v.page > 1) p.set("page", String(v.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: Filters) {
  return (
    (f.q ? 1 : 0) +
    f.maps.length +
    (f.layout ? 1 : 0) +
    f.surfaces.length +
    (f.dmin != null || f.dmax != null ? 1 : 0) +
    (f.cpmin != null || f.cpmax != null ? 1 : 0) +
    (f.cmin != null || f.cmax != null ? 1 : 0) +
    (f.grid != null ? 1 : 0) +
    (f.branching ? 1 : 0) +
    (f.props ? 1 : 0) +
    (f.tag ? 1 : 0) +
    (f.author ? 1 : 0)
  );
}
