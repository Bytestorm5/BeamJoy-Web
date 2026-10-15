"use client";

import Link from "@/components/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { SORTS, SURFACES } from "@/lib/constants";
import type { Filters } from "@/lib/filters";

export type MapFacet = { key: string; name: string; kind: string; routes: number };

function formToQuery(form: HTMLFormElement, basePath: string) {
  const fd = new FormData(form);
  const p = new URLSearchParams();
  for (const [k, v] of fd.entries()) {
    const s = String(v).trim();
    if (s && !(k === "sort" && s === "new")) p.append(k, s);
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Catalog filters. A plain GET form (so it works before hydration and every view is a shareable
 * URL); with JS it applies on every change instead of waiting for the button.
 */
export function FilterPanel({
  filters,
  maps,
  showMaps = true,
  basePath = "/",
  activeCount,
}: {
  filters: Filters;
  maps: MapFacet[];
  showMaps?: boolean;
  basePath?: string;
  activeCount: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [mapQuery, setMapQuery] = useState("");

  const apply = () => {
    if (!formRef.current) return;
    const url = formToQuery(formRef.current, basePath);
    startTransition(() => router.push(url, { scroll: false }));
  };

  const visibleMaps = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    const list = q ? maps.filter((m) => m.name.toLowerCase().includes(q)) : maps;
    // Keep selected maps visible even when they don't match the search.
    const selected = maps.filter((m) => filters.maps.includes(m.key) && !list.includes(m));
    return [...selected, ...list];
  }, [maps, mapQuery, filters.maps]);

  return (
    <form
      ref={formRef}
      action={basePath}
      method="get"
      onChange={(e) => {
        // Text/number fields apply on blur/Enter so typing doesn't spam navigations.
        const t = e.target as unknown as HTMLInputElement;
        if (t.dataset.local) return;
        if (t.type === "text" || t.type === "number" || t.type === "search") return;
        apply();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="sort" value={filters.sort} />
      {filters.author && <input type="hidden" name="author" value={filters.author} />}
      {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}

      <div>
        <label htmlFor="f-q" className="label">
          Search
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Search routes"
          className="field"
          onBlur={(e) => e.target.value !== filters.q && apply()}
        />
      </div>

      <fieldset>
        <legend className="label">Layout</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {[
            { v: "", l: "Any" },
            { v: "circuit", l: "Circuit" },
            { v: "sprint", l: "Sprint" },
          ].map((o) => (
            <label key={o.v} className="relative">
              <input
                type="radio"
                name="layout"
                value={o.v}
                defaultChecked={(filters.layout ?? "") === o.v}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-md py-1.5 text-center text-sm text-text-2 peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {o.l}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {showMaps && (
      <fieldset>
        <legend className="label">Map</legend>
        {maps.length > 8 && (
          <input
            type="search"
            data-local="1"
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            placeholder="Find a map…"
            aria-label="Find a map"
            className="field mb-2 py-1.5"
          />
        )}
        {/* Bounded and scrollable: the map list grows with every new mod map. */}
        <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-surface">
          {visibleMaps.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">{maps.length ? "No matches" : "No maps yet"}</p>
          )}
          {visibleMaps.map((m) => (
            <label
              key={m.key}
              className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-surface-2"
            >
              <input
                type="checkbox"
                name="map"
                value={m.key}
                defaultChecked={filters.maps.includes(m.key)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              {m.kind === "custom" && <span className="text-[10px] text-muted uppercase">mod</span>}
              <span className="text-xs text-muted tabular-nums">{m.routes}</span>
            </label>
          ))}
        </div>
      </fieldset>
      )}

      <fieldset>
        <legend className="label">Surface</legend>
        <div className="flex flex-wrap gap-1.5">
          {SURFACES.map((s) => (
            <label key={s.value} className="cursor-pointer">
              <input
                type="checkbox"
                name="surface"
                value={s.value}
                defaultChecked={filters.surfaces.includes(s.value)}
                className="peer sr-only"
              />
              <span className="chip py-1 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-text peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Range label="Length (km)" min="dmin" max="dmax" step="0.1" filters={filters} onCommit={apply} />
      <Range label="Gates" min="cpmin" max="cpmax" step="1" filters={filters} onCommit={apply} />
      <Range label="Corners" min="cmin" max="cmax" step="1" filters={filters} onCommit={apply} />

      <div>
        <label htmlFor="f-grid" className="label">
          Grid slots
        </label>
        <select id="f-grid" name="grid" defaultValue={filters.grid ?? ""} className="field">
          <option value="">Any size</option>
          {[2, 4, 8, 12, 16, 24].map((n) => (
            <option key={n} value={n}>
              {n}+ cars
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-props" className="label">
          Props
        </label>
        <select id="f-props" name="props" defaultValue={filters.props ?? ""} className="field">
          <option value="">Any</option>
          <option value="with">With props</option>
          <option value="none">No props</option>
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="branching"
          value="1"
          defaultChecked={filters.branching}
          className="size-4 accent-[var(--accent)]"
        />
        Has branches
      </label>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">
          {pending ? "Updating…" : "Apply"}
        </button>
        {activeCount > 0 && (
          <Link href={basePath} className="btn-secondary">
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}

function Range({
  label,
  min,
  max,
  step,
  filters,
  onCommit,
}: {
  label: string;
  min: "dmin" | "cpmin" | "cmin";
  max: "dmax" | "cpmax" | "cmax";
  step: string;
  filters: Filters;
  onCommit: () => void;
}) {
  const commit = (e: React.FocusEvent<HTMLInputElement>, initial: number | null) => {
    if (e.target.value !== (initial == null ? "" : String(initial))) onCommit();
  };
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex items-center gap-2">
        <input
          type="number"
          name={min}
          min="0"
          step={step}
          inputMode="decimal"
          placeholder="Min"
          aria-label={`${label} minimum`}
          defaultValue={filters[min] ?? ""}
          onBlur={(e) => commit(e, filters[min])}
          className="field"
        />
        <span className="text-muted" aria-hidden>
          –
        </span>
        <input
          type="number"
          name={max}
          min="0"
          step={step}
          inputMode="decimal"
          placeholder="Max"
          aria-label={`${label} maximum`}
          defaultValue={filters[max] ?? ""}
          onBlur={(e) => commit(e, filters[max])}
          className="field"
        />
      </div>
    </fieldset>
  );
}

export function SortSelect({ value, query, basePath = "/" }: { value: string; query: string; basePath?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(query);
          p.delete("page");
          if (e.target.value === "new") p.delete("sort");
          else p.set("sort", e.target.value);
          const qs = p.toString();
          router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
        }}
        className="field w-auto py-1.5"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
