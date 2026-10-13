import Link from "@/components/link";

/** Numbered pager with a window around the current page, so it stays short at any page count. */
export function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const window = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const nums = [...window].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) items.push("gap");
    items.push(n);
  });

  const cls = "grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm tabular-nums";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${cls} btn-ghost`} rel="prev">
          ← Prev
        </Link>
      ) : (
        <span className={`${cls} text-muted opacity-50`}>← Prev</span>
      )}
      {items.map((it, i) =>
        it === "gap" ? (
          <span key={`g${i}`} className={`${cls} text-muted`}>
            …
          </span>
        ) : it === page ? (
          <span key={it} aria-current="page" className={`${cls} bg-accent font-semibold text-accent-ink`}>
            {it}
          </span>
        ) : (
          <Link key={it} href={href(it)} className={`${cls} btn-ghost`}>
            {it}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={`${cls} btn-ghost`} rel="next">
          Next →
        </Link>
      ) : (
        <span className={`${cls} text-muted opacity-50`}>Next →</span>
      )}
    </nav>
  );
}
