import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentUser, isAdmin } from "@/auth";
import { CopyCode } from "@/components/copy-code";
import { DeleteRouteButton } from "@/components/delete-route";
import { ElevationProfile } from "@/components/elevation-profile";
import { Gallery } from "@/components/gallery";
import { LayoutBadge } from "@/components/route-card";
import { RouteMap } from "@/components/route-map";
import { SURFACE_LABEL } from "@/lib/constants";
import { formatDate, formatDistance } from "@/lib/format";
import { getRoute, type RouteDetail } from "@/lib/queries";
import type { RouteGeometry } from "@/lib/sharecode/analyze";

export async function generateMetadata({ params }: PageProps<"/routes/[id]">): Promise<Metadata> {
  const route = await getRoute((await params).id);
  if (!route) return { title: "Route not found" };
  return {
    title: route.title,
    description: `${route.loopable ? "Circuit" : "Sprint"} on ${route.mapName}: ${formatDistance(route.distanceM)}, ${route.checkpoints} gates, ${route.corners} corners.`,
    openGraph: route.coverUrl ? { images: [route.coverUrl] } : undefined,
  };
}

export default function RoutePage({ params }: PageProps<"/routes/[id]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-xl bg-surface" />}>
        <RouteView params={params} />
      </Suspense>
    </div>
  );
}

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
      return u.searchParams.get("v");
    }
  } catch {}
  return null;
}

async function RouteView({ params }: { params: PageProps<"/routes/[id]">["params"] }) {
  const route = await getRoute((await params).id);
  if (!route) notFound();
  const geometry = JSON.parse(route.geometry) as RouteGeometry;
  const yt = route.videoUrl ? youtubeId(route.videoUrl) : null;

  return (
    <article>
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-text">
          Routes
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/?map=${encodeURIComponent(route.mapKey)}`} className="hover:text-text">
          {route.mapName}
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <LayoutBadge loopable={route.loopable} branching={route.branching} />
            <span className="chip">{SURFACE_LABEL[route.surface] ?? route.surface}</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight break-words uppercase sm:text-5xl">
            {route.title}
          </h1>
          <p className="mt-1 text-text-2">
            on <span className="font-medium text-text">{route.mapName}</span> · by{" "}
            <Link href={`/u/${encodeURIComponent(route.author.id)}`} className="font-medium text-text hover:underline">
              {route.author.name}
            </Link>{" "}
            · {formatDate(route.createdAt)}
          </p>
        </div>
        <Suspense>
          <OwnerActions route={route} />
        </Suspense>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {route.images.length > 0 ? (
            <Gallery images={route.images} title={route.title} />
          ) : null}

          <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold text-text-2">Route map</h2>
              <RouteMap geometry={geometry} className="w-full" title={`Map of ${route.title}`} />
              <MapLegend loop={route.loopable} branching={route.branching} />
            </div>
            <div className="flex flex-col gap-4">
              <StatGrid route={route} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-2">Elevation</h2>
              <p className="text-xs text-muted">
                {route.elevationGainM} m climb · {route.elevationRangeM} m range
              </p>
            </div>
            <ElevationProfile geometry={geometry} />
          </section>

          {(route.description || yt || route.videoUrl) && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-2xl font-semibold uppercase">About this route</h2>
              {route.description && (
                <p className="max-w-prose leading-relaxed whitespace-pre-line text-text-2">{route.description}</p>
              )}
              {yt ? (
                <div className="aspect-video overflow-hidden rounded-xl border border-border">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`}
                    title={`${route.title} video`}
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
              ) : route.videoUrl ? (
                <a href={route.videoUrl} target="_blank" rel="noreferrer nofollow" className="text-accent hover:underline">
                  Watch a video of this route ↗
                </a>
              ) : null}
            </section>
          )}
        </div>

        <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none lg:self-start">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text-2">Share code</h2>
            <CopyCode routeId={route.id} code={route.shareCode} />
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-text-2">
              <li>
                Load <span className="font-medium text-text">{route.mapName}</span> on your BeamJoy server.
              </li>
              <li>
                Open <span className="font-medium text-text">Server Configuration → Races</span> and
                click <span className="font-medium text-text">New race</span>.
              </li>
              <li>
                Click <span className="font-medium text-text">Import from Code</span>, paste, then save.
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted">
              Copied {route.copyCount.toLocaleString("en-US")} {route.copyCount === 1 ? "time" : "times"}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-1 text-sm font-semibold text-text-2">Map</h2>
            <p className="font-medium">{route.mapName}</p>
            {route.mapKind === "vanilla" ? (
              <p className="mt-1 text-sm text-muted">Ships with BeamNG.drive — nothing to download.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Mod map. Every player (and the server) needs it installed.
                </p>
                {route.mapDownloadUrl && (
                  <a
                    href={route.mapDownloadUrl}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="btn-secondary mt-3 w-full"
                  >
                    Download map ↗
                  </a>
                )}
              </>
            )}
            <Link
              href={`/?map=${encodeURIComponent(route.mapKey)}`}
              className="mt-3 inline-block text-sm text-accent hover:underline"
            >
              More routes on this map →
            </Link>
          </section>

          {route.tags.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-semibold text-text-2">Tags</h2>
              <ul className="flex flex-wrap gap-1.5">
                {route.tags.map((t) => (
                  <li key={t}>
                    <Link href={`/?tag=${encodeURIComponent(t)}`} className="chip py-1 hover:border-border-strong">
                      #{t}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

function StatGrid({ route }: { route: RouteDetail }) {
  const [lo, hi] = [formatDistance(route.distanceM), formatDistance(route.maxDistanceM)];
  const distance = lo === hi ? lo : `${lo} – ${hi}`;
  const rows: { label: string; value: string | number; hint?: string }[] = [
    { label: route.loopable ? "Lap length" : "Length", value: distance },
    { label: "Gates", value: route.checkpoints, hint: route.steps < route.checkpoints ? `${route.steps} on any one run` : undefined },
    {
      label: "Corners",
      value: route.corners,
      hint: route.corners === route.cornersAuto ? "Estimated from the gate layout" : `Set by the author (estimate: ${route.cornersAuto})`,
    },
    { label: "Hairpins", value: route.hairpins },
    { label: "Grid slots", value: route.gridSlots },
    { label: "Sectors", value: route.sectors },
    ...(route.defaultLaps ? [{ label: "Default laps", value: route.defaultLaps }] : []),
    { label: "Climb", value: `${route.elevationGainM} m` },
    { label: "Start", value: route.raceMode === "passive" ? "Rolling (passive)" : "Grid" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`bg-surface p-3 ${i === rows.length - 1 && rows.length % 2 ? "col-span-2" : ""}`}
        >
          <dt className="text-[11px] tracking-wide text-muted uppercase">{r.label}</dt>
          <dd className="font-display text-2xl leading-tight font-semibold tabular-nums">{r.value}</dd>
          {r.hint && <dd className="text-[11px] leading-snug text-muted">{r.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function MapLegend({ loop, branching }: { loop: boolean; branching: boolean }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--route-line)] ring-1 ring-[var(--route-line)]" />
        Start
      </li>
      {!loop && (
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-text" />
          Finish
        </li>
      )}
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full border-[1.5px] border-[var(--route-line)]" />
        Gate
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-1.5 bg-text-2" />
        Grid slot
      </li>
      {branching && (
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-[var(--route-branch)]" />
          Alternate branch
        </li>
      )}
    </ul>
  );
}

async function OwnerActions({ route }: { route: RouteDetail }) {
  const user = await currentUser();
  if (!user || (user.id !== route.authorId && !isAdmin(user.id))) return null;
  return (
    <div className="flex gap-2">
      <Link href={`/routes/${route.id}/edit`} className="btn-secondary">
        Edit
      </Link>
      <DeleteRouteButton routeId={route.id} title={route.title} />
    </div>
  );
}
