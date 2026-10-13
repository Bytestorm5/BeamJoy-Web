/** Route page skeleton; also the boundary that keeps prefetches of route pages off D1. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading route">
      <div className="h-4 w-40 animate-pulse rounded bg-surface" />
      <div className="mt-6 h-12 w-2/3 max-w-xl animate-pulse rounded-lg bg-surface" />
      <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-surface" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-xl bg-surface" />
          <div className="aspect-square animate-pulse rounded-xl bg-surface" />
        </div>
        <div className="order-first h-72 animate-pulse rounded-xl bg-surface lg:order-none" />
      </div>
    </div>
  );
}
