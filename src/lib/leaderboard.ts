import "server-only";
import { and, asc, count, eq, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { LapInput, RouteForLap } from "./lap-rules";

export { checkLap, cleanSectors } from "./lap-rules";

/**
 * Global leaderboards: each driver's best on a route, fed lap by lap from the game. Two
 * rankings: best lap, and best theoretical lap (the sum of a driver's best time in each sector,
 * whichever laps they came from).
 */

const { routeRecords, users } = schema;

export const LEADERBOARD_PAGE_SIZE = 25;

export type LapResult = {
  isPB: boolean;
  isRecord: boolean;
  bestLapMs: number;
  theoreticalMs: number | null;
  rank: number;
  drivers: number;
};

/** Too soon after the driver's last lap on this route: a duplicate send, not a new lap. */
const MIN_GAP_MS = 2_000;

export async function recordLap(route: RouteForLap, userId: string, lap: LapInput): Promise<LapResult | "too-soon"> {
  const db = getDb();
  const now = Date.now();
  const [prev] = await db
    .select()
    .from(routeRecords)
    .where(and(eq(routeRecords.routeId, route.id), eq(routeRecords.userId, userId)))
    .limit(1);
  if (prev && now - prev.updatedAt.getTime() < MIN_GAP_MS) return "too-soon";

  const [{ record }] = await db
    .select({ record: sql<number | null>`min(${routeRecords.bestLapMs})` })
    .from(routeRecords)
    .where(eq(routeRecords.routeId, route.id));

  const isPB = !prev || lap.lapMs < prev.bestLapMs;
  const prevSectors = prev?.bestSectors ? (JSON.parse(prev.bestSectors) as (number | null)[]) : [];
  const bestSectors: (number | null)[] = Array.from({ length: route.sectors }, (_, i) => {
    const old = prevSectors.length === route.sectors ? prevSectors[i] : null;
    const now = lap.sectors?.[i] ?? null;
    if (old == null) return now;
    if (now == null) return old;
    return Math.min(old, now);
  });
  const complete = route.sectors >= 2 && bestSectors.every((s) => s != null);
  const sectorSum = complete ? (bestSectors as number[]).reduce((a, b) => a + b, 0) : null;
  // A real lap is always a possible lap, so the theoretical best is never slower than it.
  const bestLapMs = isPB ? lap.lapMs : prev!.bestLapMs;
  const theoreticalMs = sectorSum == null ? null : Math.min(sectorSum, bestLapMs);

  const values = {
    playerName: lap.playerName,
    bestLapMs,
    bestLapVehicle: isPB ? lap.vehicle : prev!.bestLapVehicle,
    bestLapSectors: isPB ? (lap.sectors ? JSON.stringify(lap.sectors) : null) : prev!.bestLapSectors,
    bestLapAt: isPB ? new Date(now) : prev!.bestLapAt,
    bestSectors: bestSectors.some((s) => s != null) ? JSON.stringify(bestSectors) : null,
    theoreticalMs,
    laps: (prev?.laps ?? 0) + 1,
    updatedAt: new Date(now),
  };
  await db
    .insert(routeRecords)
    .values({ routeId: route.id, userId, ...values })
    .onConflictDoUpdate({ target: [routeRecords.routeId, routeRecords.userId], set: values });

  const [[{ ahead }], [{ drivers }]] = await Promise.all([
    db
      .select({ ahead: count() })
      .from(routeRecords)
      .where(and(eq(routeRecords.routeId, route.id), lt(routeRecords.bestLapMs, bestLapMs))),
    db.select({ drivers: count() }).from(routeRecords).where(eq(routeRecords.routeId, route.id)),
  ]);
  return {
    isPB,
    isRecord: isPB && (record == null || lap.lapMs < record),
    bestLapMs,
    theoreticalMs,
    rank: ahead + 1,
    drivers,
  };
}

export type BoardSort = "lap" | "theory";

export type BoardEntry = {
  rank: number;
  name: string;
  playerName: string;
  userSlug: string;
  image: string | null;
  bestLapMs: number;
  theoreticalMs: number | null;
  vehicle: string;
  laps: number;
  sectors: number[] | null;
  bestSectors: (number | null)[] | null;
  updatedAt: number;
};

export async function leaderboard(routeId: string, sort: BoardSort, page: number, pageSize = LEADERBOARD_PAGE_SIZE) {
  const db = getDb();
  const where =
    sort === "theory"
      ? and(eq(routeRecords.routeId, routeId), isNotNull(routeRecords.theoreticalMs))
      : eq(routeRecords.routeId, routeId);
  const order =
    sort === "theory"
      ? [asc(routeRecords.theoreticalMs), asc(routeRecords.bestLapMs)]
      : [asc(routeRecords.bestLapMs), asc(routeRecords.bestLapAt)];
  const [rows, [{ total }], [best]] = await Promise.all([
    db
      .select({
        record: routeRecords,
        user: { slug: users.slug, name: users.name, image: users.image },
      })
      .from(routeRecords)
      .innerJoin(users, eq(users.id, routeRecords.userId))
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(routeRecords).where(where),
    // Fastest time anyone has set in each sector, for highlighting.
    db
      .select({ sectors: sql<string | null>`json_group_array(${routeRecords.bestSectors})` })
      .from(routeRecords)
      .where(and(eq(routeRecords.routeId, routeId), isNotNull(routeRecords.bestSectors))),
  ]);

  const fastest: (number | null)[] = [];
  for (const raw of best?.sectors ? (JSON.parse(best.sectors) as string[]) : []) {
    const s = JSON.parse(raw) as (number | null)[];
    s.forEach((v, i) => {
      if (v != null && (fastest[i] == null || v < fastest[i]!)) fastest[i] = v;
    });
  }

  const entries: BoardEntry[] = rows.map(({ record: r, user }, i) => ({
    rank: (page - 1) * pageSize + i + 1,
    name: user.name,
    playerName: r.playerName,
    userSlug: user.slug,
    image: user.image,
    bestLapMs: r.bestLapMs,
    theoreticalMs: r.theoreticalMs,
    vehicle: r.bestLapVehicle,
    laps: r.laps,
    sectors: r.bestLapSectors ? (JSON.parse(r.bestLapSectors) as number[]) : null,
    bestSectors: r.bestSectors ? (JSON.parse(r.bestSectors) as (number | null)[]) : null,
    updatedAt: r.updatedAt.getTime(),
  }));
  // `asOf` lets pages show "5 min ago" without reading the clock while rendering.
  return { entries, total, pages: Math.max(1, Math.ceil(total / pageSize)), fastestSectors: fastest, asOf: Date.now() };
}

export type Leaderboard = Awaited<ReturnType<typeof leaderboard>>;

export function parseSort(v: unknown): BoardSort {
  return v === "theory" ? "theory" : "lap";
}
