import Link from "@/components/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-accent">DNF</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase">Page not found</h1>

      <Link href="/" className="btn-primary mt-8">
        All routes
      </Link>
    </div>
  );
}
