import Link from "@/components/link";
import { Suspense } from "react";
import { Catalog, CatalogSkeleton } from "@/components/catalog";

export default function CatalogPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-8 sm:py-10">
        <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">
          BeamJoy race routes
        </h1>
        <p className="mt-2 text-text-2">
          Copy a share code and import it in-game.{" "}
          <Link href="/submit" className="font-medium text-accent hover:underline">
            Share your own
          </Link>
          .
        </p>
      </section>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
