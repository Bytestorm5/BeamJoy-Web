"use client";

import { useState } from "react";

/** Below `lg` the filter sidebar collapses behind a toggle; on desktop it's always shown. */
export function FilterDrawer({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="catalog-filters"
        className="btn-secondary w-full lg:hidden"
      >
        {open ? "Hide filters" : "Filters"}
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-xs text-accent-ink tabular-nums">{activeCount}</span>
        )}
      </button>
      <div id="catalog-filters" className={`${open ? "mt-4 block" : "hidden"} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
