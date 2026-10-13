import Link from "@/components/link";
import type { RouteGeometry } from "@/lib/sharecode/analyze";
import type { RouteCard as RouteCardData } from "@/lib/queries";
import { SURFACE_LABEL } from "@/lib/constants";
import { formatDistance } from "@/lib/format";
import { RouteMap } from "./route-map";

export function LayoutBadge({ loopable, branching }: { loopable: boolean; branching?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
      <span
        aria-hidden
        className={`size-2 rounded-full ${loopable ? "bg-circuit" : "bg-sprint"}`}
      />
      <span className="text-text-2">{loopable ? "Circuit" : "Sprint"}</span>
      {branching && <span className="text-muted">· Branching</span>}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-display text-lg leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const EyeIcon = () => (
  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
    <circle cx="10" cy="10" r="2.5" />
  </svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 3v10m0 0-4-4m4 4 4-4M4 17h12" />
  </svg>
);

const compact = (n: number) =>
  n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

function RatingPill({ likes, dislikes }: { likes: number; dislikes: number }) {
  const total = likes + dislikes;
  if (!total) return null;
  const pct = Math.round((likes / total) * 100);
  return (
    <span
      className="rounded-full bg-surface-2 px-1.5 py-0.5 font-medium text-text-2"
      title={`${likes} likes, ${dislikes} dislikes`}
    >
      {pct}% liked<span className="sr-only">, {total} ratings</span>
    </span>
  );
}

export function RouteCard({ route }: { route: RouteCardData }) {
  const geometry = JSON.parse(route.geometry) as RouteGeometry;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
        {route.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={route.coverUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute right-2 bottom-2 size-16 rounded-lg border border-border bg-surface/90 p-0.5 backdrop-blur">
              <RouteMap geometry={geometry} variant="thumb" className="size-full" />
            </div>
          </>
        ) : (
          <RouteMap geometry={geometry} variant="thumb" className="mx-auto h-full" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <LayoutBadge loopable={route.loopable} branching={route.branching} />
          <span className="chip">{SURFACE_LABEL[route.surface] ?? route.surface}</span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            <Link href={`/routes/${route.id}`} className="after:absolute after:inset-0">
              {route.title}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">
            {route.mapName}
            {route.mapKind === "custom" && " (mod)"} · by {route.authorName}
          </p>
        </div>
        <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-border pt-3">
          <Stat label={route.loopable ? "Lap" : "Length"} value={formatDistance(route.distanceM)} />
          <Stat label="Gates" value={route.checkpoints} />
          <Stat label="Corners" value={route.corners} />
          <Stat label="Grid" value={route.gridSlots} />
        </dl>
        <div className="flex items-center justify-between gap-3 text-xs text-muted tabular-nums">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1" title={`${route.viewCount.toLocaleString("en-US")} views`}>
              <EyeIcon />
              {compact(route.viewCount)}
              <span className="sr-only"> views</span>
            </span>
            <span className="flex items-center gap-1" title={`${route.copyCount.toLocaleString("en-US")} downloads`}>
              <DownloadIcon />
              {compact(route.copyCount)}
              <span className="sr-only"> downloads</span>
            </span>
          </span>
          <RatingPill likes={route.likeCount} dislikes={route.dislikeCount} />
        </div>
      </div>
    </article>
  );
}
