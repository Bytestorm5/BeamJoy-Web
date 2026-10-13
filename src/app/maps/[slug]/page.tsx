import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Catalog, CatalogSkeleton } from "@/components/catalog";
import Link from "@/components/link";
import { mapPath } from "@/lib/maps";
import { getMap } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/maps/[slug]">): Promise<Metadata> {
  const map = await getMap((await params).slug);
  if (!map) return { title: "Map not found" };
  return {
    title: `${map.name} routes`,
    description: `BeamJoy race routes on ${map.name}.`,
    alternates: { canonical: mapPath(map.slug) },
  };
}

export default async function MapPage({ params, searchParams }: PageProps<"/maps/[slug]">) {
  const map = await getMap((await params).slug);
  if (!map) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="flex flex-wrap items-end justify-between gap-4 py-8 sm:py-10">
        <div>
          <nav className="mb-2 text-sm text-muted" aria-label="Breadcrumb">
            <Link href="/maps" className="hover:text-text">
              Maps
            </Link>
          </nav>
          <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">{map.name}</h1>
          <p className="mt-1 text-text-2">
            {map.kind === "vanilla" ? "Base game" : "Mod map"}
          </p>
        </div>
        {map.downloadUrl && (
          <a href={map.downloadUrl} target="_blank" rel="noreferrer nofollow" className="btn-secondary">
            Download map ↗
          </a>
        )}
      </section>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} basePath={mapPath(map.slug)} lockedMap={map.slug} />
      </Suspense>
    </div>
  );
}
