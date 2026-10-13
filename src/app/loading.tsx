/**
 * Route-level loading state. Besides showing instantly on navigation, this boundary is what keeps
 * link prefetches cheap: an auto prefetch renders only down to here, so no page's D1 queries run
 * until the user actually navigates.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 max-w-xl animate-pulse rounded-lg bg-surface" />
      <div className="mt-3 h-5 w-1/2 max-w-md animate-pulse rounded bg-surface" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
