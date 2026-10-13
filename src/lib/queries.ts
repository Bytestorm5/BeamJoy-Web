import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, exists, gte, inArray, like, lte, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PAGE_SIZE } from "./constants";
import { slugify } from "./format";
import { vanillaMapBySlug } from "./maps";
import { fillDays, utcDay } from "./metrics";
import type { Filters } from "./filters";

const { routes, routeTags, routeImages, users, routeDailyStats, routeVotes } = schema;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function whereFor(f: Filters): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.q) {
    const pat = `%${escapeLike(f.q)}%`;
    const likeEsc = (col: SQLWrapper) => sql`${col} like ${pat} escape '\\'`;
    c.push(
      or(
        likeEsc(routes.title),
        likeEsc(routes.description),
        likeEsc(routes.mapName),
        exists(
          getDb()
            .select({ one: sql`1` })
            .from(routeTags)
            .where(and(eq(routeTags.routeId, routes.id), like(routeTags.tag, f.q.toLowerCase()))),
        ),
      ),
    );
  }
  if (f.maps.length) c.push(inArray(routes.mapKey, f.maps));
  if (f.layout) c.push(eq(routes.loopable, f.layout === "circuit"));
  if (f.surfaces.length) c.push(inArray(routes.surface, f.surfaces));
  if (f.dmin != null) c.push(gte(routes.distanceM, f.dmin * 1000));
  if (f.dmax != null) c.push(lte(routes.distanceM, f.dmax * 1000));
  if (f.cpmin != null) c.push(gte(routes.checkpoints, f.cpmin));
  if (f.cpmax != null) c.push(lte(routes.checkpoints, f.cpmax));
  if (f.cmin != null) c.push(gte(routes.corners, f.cmin));
  if (f.cmax != null) c.push(lte(routes.corners, f.cmax));
  if (f.grid != null) c.push(gte(routes.gridSlots, f.grid));
  if (f.branching) c.push(eq(routes.branching, true));
  if (f.author) c.push(eq(routes.authorId, f.author));
  if (f.tag) {
    c.push(
      exists(
        getDb()
          .select({ one: sql`1` })
          .from(routeTags)
          .where(and(eq(routeTags.routeId, routes.id), eq(routeTags.tag, f.tag))),
      ),
    );
  }
  return c.length ? and(...c) : undefined;
}

const ORDER = {
  new: [desc(routes.createdAt)],
  top: [desc(routes.ratingScore), desc(routes.likeCount), desc(routes.createdAt)],
  popular: [desc(routes.copyCount), desc(routes.createdAt)],
  viewed: [desc(routes.viewCount), desc(routes.createdAt)],
  longest: [desc(routes.distanceM), desc(routes.createdAt)],
  shortest: [asc(routes.distanceM), desc(routes.createdAt)],
  corners: [desc(routes.corners), desc(routes.createdAt)],
} as const;

export const cardColumns = {
  slug: routes.slug,
  title: routes.title,
  mapName: routes.mapName,
  mapKind: routes.mapKind,
  surface: routes.surface,
  distanceM: routes.distanceM,
  checkpoints: routes.checkpoints,
  corners: routes.corners,
  gridSlots: routes.gridSlots,
  loopable: routes.loopable,
  branching: routes.branching,
  copyCount: routes.copyCount,
  viewCount: routes.viewCount,
  likeCount: routes.likeCount,
  dislikeCount: routes.dislikeCount,
  coverUrl: routes.coverUrl,
  geometry: routes.geometry,
  createdAt: routes.createdAt,
  authorName: users.name,
};

export type RouteCard = Awaited<ReturnType<typeof searchRoutes>>["items"][number];

export async function searchRoutes(f: Filters) {
  const where = whereFor(f);
  const [items, [{ total }]] = await Promise.all([
    getDb()
      .select(cardColumns)
      .from(routes)
      .innerJoin(users, eq(users.id, routes.authorId))
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    getDb().select({ total: count() }).from(routes).where(where),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Every map with at least one route, most-used first. */
export async function mapFacets() {
  return getDb()
    .select({
      key: routes.mapKey,
      name: sql<string>`max(${routes.mapName})`,
      kind: sql<string>`max(${routes.mapKind})`,
      downloadUrl: sql<string | null>`max(${routes.mapDownloadUrl})`,
      routes: count(),
    })
    .from(routes)
    .groupBy(routes.mapKey)
    .orderBy(desc(count()), asc(sql`max(${routes.mapName})`));
}

/** By public slug. Deduped per request: generateMetadata and the page body both need it. */
export const getRoute = cache(async (slug: string) => {
  const [row] = await getDb()
    .select({ route: routes, author: { id: users.id, name: users.name, image: users.image } })
    .from(routes)
    .innerJoin(users, eq(users.id, routes.authorId))
    .where(eq(routes.slug, slug))
    .limit(1);
  if (!row) return null;
  const id = row.route.id;
  const [images, tags] = await Promise.all([
    getDb().select().from(routeImages).where(eq(routeImages.routeId, id)).orderBy(asc(routeImages.position)),
    getDb().select({ tag: routeTags.tag }).from(routeTags).where(eq(routeTags.routeId, id)).orderBy(asc(routeTags.tag)),
  ]);
  return { ...row.route, author: row.author, images, tags: tags.map((t) => t.tag) };
});

export type RouteDetail = NonNullable<Awaited<ReturnType<typeof getRoute>>>;

export async function getUser(id: string) {
  const [u] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}


export const MAPS_PAGE_SIZE = 30;

/** Mod maps (the only open-ended map list), searchable and paginated. */
export async function listModMaps(q: string, page: number) {
  const where = and(
    eq(routes.mapKind, "custom"),
    q ? sql`${routes.mapName} like ${`%${escapeLike(q)}%`} escape '\\'` : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    getDb()
      .select({
        key: routes.mapKey,
        name: sql<string>`max(${routes.mapName})`,
        downloadUrl: sql<string | null>`max(${routes.mapDownloadUrl})`,
        routes: count(),
        latest: sql<number>`max(${routes.createdAt})`,
      })
      .from(routes)
      .where(where)
      .groupBy(routes.mapKey)
      .orderBy(desc(count()), asc(sql`max(${routes.mapName})`))
      .limit(MAPS_PAGE_SIZE)
      .offset((page - 1) * MAPS_PAGE_SIZE),
    getDb().select({ total: sql<number>`count(distinct ${routes.mapKey})` }).from(routes).where(where),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / MAPS_PAGE_SIZE)) };
}

export async function vanillaMapCounts() {
  const rows = await getDb()
    .select({ key: routes.mapKey, routes: count() })
    .from(routes)
    .where(eq(routes.mapKind, "vanilla"))
    .groupBy(routes.mapKey);
  return Object.fromEntries(rows.map((r) => [r.key, r.routes])) as Record<string, number>;
}

export type DailyPoint = { day: string; views: number; copies: number };

/** Daily views and downloads for the last `days` UTC days, zero-filled. */
export async function routeActivity(routeId: string, days = 30): Promise<DailyPoint[]> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await getDb()
    .select({ day: routeDailyStats.day, views: routeDailyStats.views, copies: routeDailyStats.copies })
    .from(routeDailyStats)
    .where(and(eq(routeDailyStats.routeId, routeId), gte(routeDailyStats.day, since)));
  return fillDays(rows, days, (day) => ({ day, views: 0, copies: 0 }));
}

export async function myVote(routeId: string, userId: string): Promise<-1 | 0 | 1> {
  const [row] = await getDb()
    .select({ value: routeVotes.value })
    .from(routeVotes)
    .where(and(eq(routeVotes.routeId, routeId), eq(routeVotes.userId, userId)))
    .limit(1);
  return row?.value === 1 ? 1 : row?.value === -1 ? -1 : 0;
}

/** First free slug for a new route's title: `name`, then `name-2`, `name-3`… */
export async function freeRouteSlug(title: string) {
  const base = slugify(title) || "route";
  const taken = new Set(
    (
      await getDb()
        .select({ slug: routes.slug })
        .from(routes)
        .where(or(eq(routes.slug, base), like(routes.slug, `${base}-%`)))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export type MapInfo = { slug: string; name: string; kind: "vanilla" | "custom"; downloadUrl: string | null; routes: number };

/** A map by slug: every base-game map, or a mod map that has at least one route. */
export const getMap = cache(async (slug: string): Promise<MapInfo | null> => {
  const [row] = await getDb()
    .select({
      name: sql<string>`max(${routes.mapName})`,
      downloadUrl: sql<string | null>`max(${routes.mapDownloadUrl})`,
      routes: count(),
    })
    .from(routes)
    .where(eq(routes.mapKey, slug));
  const vanilla = vanillaMapBySlug(slug);
  if (vanilla) return { slug, name: vanilla.name, kind: "vanilla", downloadUrl: null, routes: row?.routes ?? 0 };
  if (!row?.routes) return null;
  return { slug, name: row.name, kind: "custom", downloadUrl: row.downloadUrl, routes: row.routes };
});
