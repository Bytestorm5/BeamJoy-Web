/** Leaderboard skeleton; keeps prefetches of the page off D1. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading leaderboard">
      <div className="h-4 w-48 animate-pulse rounded bg-surface" />
      <div className="mt-6 h-12 w-72 animate-pulse rounded-lg bg-surface" />
      <div className="mt-8 h-96 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}
