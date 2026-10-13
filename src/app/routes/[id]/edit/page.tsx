import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateRoute } from "@/app/actions";
import { currentUser, isAdmin } from "@/auth";
import { RouteForm } from "@/components/route-form";
import { getRoute } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit route" };

export default function EditRoutePage({ params }: PageProps<"/routes/[id]/edit">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: PageProps<"/routes/[id]/edit">["params"] }) {
  const { id } = await params;
  const [route, user] = await Promise.all([getRoute(id), currentUser()]);
  if (!route) notFound();
  if (!user || (user.id !== route.authorId && !isAdmin(user.id))) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-display text-2xl font-semibold uppercase">Not your route</p>
        <p className="mt-2 text-sm text-muted">Only the person who shared a route can edit it.</p>
        <Link href={`/routes/${id}`} className="btn-secondary mt-6">
          Back to the route
        </Link>
      </div>
    );
  }
  return (
    <>
      <Link href={`/routes/${id}`} className="text-sm text-muted hover:text-text">
        ← {route.title}
      </Link>
      <h1 className="mt-2 mb-8 font-display text-4xl font-bold tracking-tight uppercase">Edit route</h1>
      <RouteForm
        action={updateRoute.bind(null, id)}
        submitLabel="Save changes"
        initial={{
          shareCode: route.shareCode,
          title: route.title,
          description: route.description,
          surface: route.surface,
          tags: route.tags,
          videoUrl: route.videoUrl ?? "",
          cornersOverride: route.corners !== route.cornersAuto ? route.corners : null,
          mapKind: route.mapKind === "custom" ? "custom" : "vanilla",
          vanillaLevel: route.mapKind === "vanilla" ? route.mapKey : "",
          customMapName: route.mapKind === "custom" ? route.mapName : "",
          customMapUrl: route.mapDownloadUrl ?? "",
          images: route.images.map((i) => ({ id: i.id, url: i.url })),
        }}
      />
    </>
  );
}
