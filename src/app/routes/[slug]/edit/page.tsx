import type { Metadata } from "next";
import Link from "@/components/link";
import { notFound } from "next/navigation";
import { updateRoute } from "@/app/actions";
import { getViewer, isAccessDenied, requireUpdateRoute } from "@/lib/access";
import { RouteForm } from "@/components/route-form";
import { routePath } from "@/lib/paths";
import { getRoute } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit route" };

export default async function EditRoutePage({ params }: PageProps<"/routes/[slug]/edit">) {
  const { slug } = await params;
  const [route, viewer] = await Promise.all([getRoute(slug), getViewer()]);
  if (!route) notFound();
  let allowed = true;
  try {
    await requireUpdateRoute(viewer, route);
  } catch (e) {
    if (!isAccessDenied(e)) throw e;
    allowed = false;
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Editor slug={slug} route={route} allowed={allowed} />
    </div>
  );
}

function Editor({
  slug,
  route,
  allowed,
}: {
  slug: string;
  route: NonNullable<Awaited<ReturnType<typeof getRoute>>>;
  allowed: boolean;
}) {
  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-display text-2xl font-semibold uppercase">Not your route</p>
        <p className="mt-2 text-sm text-muted">You can only edit your own routes.</p>
        <Link href={routePath(slug)} className="btn-secondary mt-6">
          Back
        </Link>
      </div>
    );
  }
  return (
    <>
      <Link href={routePath(slug)} className="text-sm text-muted hover:text-text">
        ← {route.title}
      </Link>
      <h1 className="mt-2 mb-8 font-display text-4xl font-bold tracking-tight uppercase">Edit route</h1>
      <RouteForm
        action={updateRoute.bind(null, slug)}
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
          vanillaMap: route.mapKind === "vanilla" ? route.mapKey : "",
          customMapName: route.mapKind === "custom" ? route.mapName : "",
          customMapUrl: route.mapDownloadUrl ?? "",
          images: route.images.map((i) => ({ id: i.id, url: i.url })),
        }}
      />
    </>
  );
}
