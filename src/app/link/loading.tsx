export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" aria-busy="true">
      <div className="h-12 w-64 animate-pulse rounded-lg bg-surface" />
      <div className="mt-8 h-48 animate-pulse rounded-xl bg-surface" />
    </div>
  );
}
