import "server-only";
import { and, asc, count, eq, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  LAP_STARTS,
  mergeLap,
  restoreRecord,
  snapshotRecord,
  type LapInput,
  type LapStart,
  type RouteForLap,
} from "./lap-rules";

export { checkLap, cleanSectors } from "./lap-rules";

/**
 * Global leaderboards: each driver's best on a route, fed lap by lap from the game. Two
 * rankings: best lap, and best theoretical lap (the sum of a driver's best time in each sector,
 * whichever laps they came from). Standing and flying starts are separate boards.
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
  start: LapStart;
};

/** Too soon after the driver's last lap on this board: a duplicate send, not a new lap. */
const MIN_GAP_MS = 2_000;

const recordKey = (routeId: string, userId: string, start: LapStart) =>
  and(eq(routeRecords.routeId, routeId), eq(routeRecords.userId, userId), eq(routeRecords.start, start));

export async function recordLap(route: RouteForLap, userId: string, lap: LapInput): Promise<LapResult | "duplicate"> {
  const db = getDb();
  const now = Date.now();
  const board = and(eq(routeRecords.routeId, route.id), eq(routeRecords.start, lap.start));
  const [prev] = await db.select().from(routeRecords).where(recordKey(route.id, userId, lap.start)).limit(1);
  // A lap from a run is known by its number; one without, by its timing.
  if (lap.run) {
    if (prev && prev.run === lap.run.run && prev.runLap != null && lap.run.runLap <= prev.runLap) return "duplicate";
  } else if (prev && now - prev.updatedAt.getTime() < MIN_GAP_MS) {
    return "duplicate";
  }

  const [{ record }] = await db
    .select({ record: sql<number | null>`min(${routeRecords.bestLapMs})` })
    .from(routeRecords)
    .where(board);

  const { isPB, ...merged } = mergeLap(route, prev ?? null, lap, now);
  // The record as it was before this run, kept until another run (or a lap from no run) comes.
  const sameRun = !!lap.run && !!prev && prev.run === lap.run.run;
  const values = {
    ...merged,
    run: lap.run?.run ?? null,
    runLap: lap.run?.runLap ?? null,
    beforeRun: !lap.run ? null : sameRun ? prev!.beforeRun : prev ? snapshotRecord(prev) : null,
  };
  await db
    .insert(routeRecords)
    .values({ routeId: route.id, userId, start: lap.start, ...values })
    .onConflictDoUpdate({ target: [routeRecords.routeId, routeRecords.userId, routeRecords.start], set: values });

  const [[{ ahead }], [{ drivers }]] = await Promise.all([
    db
      .select({ ahead: count() })
      .from(routeRecords)
      .where(and(board, lt(routeRecords.bestLapMs, merged.bestLapMs))),
    db.select({ drivers: count() }).from(routeRecords).where(board),
  ]);
  return {
    isPB,
    isRecord: isPB && (record == null || lap.lapMs < record),
    bestLapMs: merged.bestLapMs,
    theoreticalMs: merged.theoreticalMs,
    rank: ahead + 1,
    drivers,
    start: lap.start,
  };
}

/**
 * Takes back what one run gave a driver's records on a route (the run was disqualified after its
 * laps were posted): each record it changed goes back to how it was before, or goes when it
 * didn't exist. Records a later run has changed since are left alone. Returns how many changed.
 */
export async function withdrawRun(routeId: string, userId: string, run: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(routeRecords)
    .where(and(eq(routeRecords.routeId, routeId), eq(routeRecords.userId, userId), eq(routeRecords.run, run)));
  for (const row of rows) {
    const before = row.beforeRun ? restoreRecord(row.beforeRun) : null;
    const key = and(recordKey(routeId, userId, row.start), eq(routeRecords.run, run));
    if (before) {
      await db
        .update(routeRecords)
        .set({ ...before, run: null, runLap: null, beforeRun: null })
        .where(key);
    } else {
      await db.delete(routeRecords).where(key);
    }
  }
  return rows.length;
}

/** How many drivers each of a route's boards has. */
export async function boardCounts(routeId: string): Promise<Record<LapStart, number>> {
  const rows = await getDb()
    .select({ start: routeRecords.start, drivers: count() })
    .from(routeRecords)
    .where(eq(routeRecords.routeId, routeId))
    .groupBy(routeRecords.start);
  const counts = Object.fromEntries(LAP_STARTS.map((s) => [s, 0])) as Record<LapStart, number>;
  for (const r of rows) counts[r.start] = r.drivers;
  return counts;
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

export async function leaderboard(
  routeId: string,
  start: LapStart,
  sort: BoardSort,
  page: number,
  pageSize = LEADERBOARD_PAGE_SIZE,
) {
  const db = getDb();
  const board = and(eq(routeRecords.routeId, routeId), eq(routeRecords.start, start));
  const where = sort === "theory" ? and(board, isNotNull(routeRecords.theoreticalMs)) : board;
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
      .where(and(board, isNotNull(routeRecords.bestSectors))),
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
  return {
    start,
    entries,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    fastestSectors: fastest,
    asOf: Date.now(),
  };
}

export type Leaderboard = Awaited<ReturnType<typeof leaderboard>>;

export function parseSort(v: unknown): BoardSort {
  return v === "theory" ? "theory" : "lap";
}
