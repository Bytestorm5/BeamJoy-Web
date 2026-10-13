import "server-only";
import { and, asc, count, desc, eq, exists, gte, inArray, like, lte, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAGE_SIZE } from "./constants";
import type { Filters } from "./filters";

const { routes, routeTags, routeImages, users } = schema;

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
          db
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
        db
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
  popular: [desc(routes.copyCount), desc(routes.createdAt)],
  longest: [desc(routes.distanceM), desc(routes.createdAt)],
  shortest: [asc(routes.distanceM), desc(routes.createdAt)],
  corners: [desc(routes.corners), desc(routes.createdAt)],
} as const;

export const cardColumns = {
  id: routes.id,
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
  coverUrl: routes.coverUrl,
  geometry: routes.geometry,
  createdAt: routes.createdAt,
  authorName: users.name,
};

export type RouteCard = Awaited<ReturnType<typeof searchRoutes>>["items"][number];

export async function searchRoutes(f: Filters) {
  const where = whereFor(f);
  const [items, [{ total }]] = await Promise.all([
    db
      .select(cardColumns)
      .from(routes)
      .innerJoin(users, eq(users.id, routes.authorId))
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(routes).where(where),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Every map with at least one route, most-used first. */
export async function mapFacets() {
  return db
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

export async function popularTags(limit = 16) {
  return db
    .select({ tag: routeTags.tag, n: count() })
    .from(routeTags)
    .groupBy(routeTags.tag)
    .orderBy(desc(count()), asc(routeTags.tag))
    .limit(limit);
}

export async function getRoute(id: string) {
  const [row] = await db
    .select({ route: routes, author: { id: users.id, name: users.name, image: users.image } })
    .from(routes)
    .innerJoin(users, eq(users.id, routes.authorId))
    .where(eq(routes.id, id))
    .limit(1);
  if (!row) return null;
  const [images, tags] = await Promise.all([
    db.select().from(routeImages).where(eq(routeImages.routeId, id)).orderBy(asc(routeImages.position)),
    db.select({ tag: routeTags.tag }).from(routeTags).where(eq(routeTags.routeId, id)).orderBy(asc(routeTags.tag)),
  ]);
  return { ...row.route, author: row.author, images, tags: tags.map((t) => t.tag) };
}

export type RouteDetail = NonNullable<Awaited<ReturnType<typeof getRoute>>>;

export async function getUser(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function siteTotals() {
  const [row] = await db
    .select({
      routes: count(),
      maps: sql<number>`count(distinct ${routes.mapKey})`,
      km: sql<number>`coalesce(sum(${routes.distanceM}), 0) / 1000.0`,
    })
    .from(routes);
  return row;
}

export const MAPS_PAGE_SIZE = 30;

/** Mod maps (the only open-ended map list), searchable and paginated. */
export async function listModMaps(q: string, page: number) {
  const where = and(
    eq(routes.mapKind, "custom"),
    q ? sql`${routes.mapName} like ${`%${escapeLike(q)}%`} escape '\\'` : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
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
    db.select({ total: sql<number>`count(distinct ${routes.mapKey})` }).from(routes).where(where),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / MAPS_PAGE_SIZE)) };
}

export async function vanillaMapCounts() {
  const rows = await db
    .select({ key: routes.mapKey, routes: count() })
    .from(routes)
    .where(eq(routes.mapKind, "vanilla"))
    .groupBy(routes.mapKey);
  return Object.fromEntries(rows.map((r) => [r.key, r.routes])) as Record<string, number>;
}
