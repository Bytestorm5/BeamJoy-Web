/** What a lap from the game must look like before it reaches a leaderboard. Pure, so it is unit-tested. */

/** Faster than any car BeamNG ships, averaged over a whole lap (the game's own check uses 150). */
const MAX_AVG_SPEED_MS = 150;
const MAX_LAP_MS = 6 * 3_600_000;

/**
 * How a lap's clock started. Standing: from the grid (a point-to-point run, a circuit's first
 * lap). Flying: at a line crossed at speed (a circuit's later laps or out lap, a flying start, a
 * freeroam run). They don't compare, so each has its own board.
 */
export type LapStart = "standing" | "flying";
export const LAP_STARTS: readonly LapStart[] = ["standing", "flying"];

export function parseStart(v: unknown): LapStart | null {
  return v === "standing" || v === "flying" ? v : null;
}

/** The board a route's leaderboard opens on: lap times for circuits, standing starts for sprints. */
export const defaultStart = (loopable: boolean): LapStart => (loopable ? "flying" : "standing");

/** The board to show: the one asked for, else the route's default unless only the other has times. */
export function pickStart(requested: unknown, loopable: boolean, counts: Record<LapStart, number>): LapStart {
  const asked = parseStart(requested);
  if (asked) return asked;
  const preferred = defaultStart(loopable);
  const other: LapStart = preferred === "flying" ? "standing" : "flying";
  return counts[preferred] === 0 && counts[other] > 0 ? other : preferred;
}

/**
 * The game's run a lap belongs to (a race session's phase) and the lap's number in it. With a
 * run, a resent lap is told apart by its number, and the run can be withdrawn if it's
 * disqualified later.
 */
export function parseRun(run: unknown, runLap: unknown): { run: string; runLap: number } | null {
  if (typeof run !== "string" || !/^[\w.:#@-]{1,100}$/.test(run)) return null;
  if (typeof runLap !== "number" || !Number.isInteger(runLap) || runLap < 1 || runLap > 100_000) return null;
  return { run, runLap };
}

export type LapInput = {
  lapMs: number;
  sectors: number[] | null;
  vehicle: string;
  playerName: string;
  start: LapStart;
  run: { run: string; runLap: number } | null;
};

export type RouteForLap = { id: string; distanceM: number; sectors: number };

/** A driver's record on one board, the fields a lap changes. */
export type RecordFields = {
  playerName: string;
  bestLapMs: number;
  bestLapVehicle: string;
  bestLapSectors: string | null;
  bestLapAt: Date;
  bestSectors: string | null;
  theoreticalMs: number | null;
  laps: number;
  updatedAt: Date;
};

/** A record with the lap added: best lap, best sectors and the theoretical lap they make. */
export function mergeLap(route: RouteForLap, prev: RecordFields | null, lap: LapInput, now: number): RecordFields & { isPB: boolean } {
  const isPB = !prev || lap.lapMs < prev.bestLapMs;
  const prevSectors = prev?.bestSectors ? (JSON.parse(prev.bestSectors) as (number | null)[]) : [];
  const bestSectors: (number | null)[] = Array.from({ length: route.sectors }, (_, i) => {
    const old = prevSectors.length === route.sectors ? prevSectors[i] : null;
    const cur = lap.sectors?.[i] ?? null;
    if (old == null) return cur;
    if (cur == null) return old;
    return Math.min(old, cur);
  });
  const complete = route.sectors >= 2 && bestSectors.every((s) => s != null);
  const sectorSum = complete ? (bestSectors as number[]).reduce((a, b) => a + b, 0) : null;
  // A real lap is always a possible lap, so the theoretical best is never slower than it.
  const bestLapMs = isPB ? lap.lapMs : prev!.bestLapMs;
  return {
    isPB,
    playerName: lap.playerName,
    bestLapMs,
    bestLapVehicle: isPB ? lap.vehicle : prev!.bestLapVehicle,
    bestLapSectors: isPB ? (lap.sectors ? JSON.stringify(lap.sectors) : null) : prev!.bestLapSectors,
    bestLapAt: isPB ? new Date(now) : prev!.bestLapAt,
    bestSectors: bestSectors.some((s) => s != null) ? JSON.stringify(bestSectors) : null,
    theoreticalMs: sectorSum == null ? null : Math.min(sectorSum, bestLapMs),
    laps: (prev?.laps ?? 0) + 1,
    updatedAt: new Date(now),
  };
}

/** A record as JSON, kept while a run changes it (`before_run`). */
export function snapshotRecord(r: RecordFields): string {
  return JSON.stringify({
    playerName: r.playerName,
    bestLapMs: r.bestLapMs,
    bestLapVehicle: r.bestLapVehicle,
    bestLapSectors: r.bestLapSectors,
    bestLapAt: r.bestLapAt.getTime(),
    bestSectors: r.bestSectors,
    theoreticalMs: r.theoreticalMs,
    laps: r.laps,
    updatedAt: r.updatedAt.getTime(),
  });
}

/** The record a snapshot holds, or null when it doesn't parse. */
export function restoreRecord(json: string): RecordFields | null {
  try {
    const s = JSON.parse(json) as Record<string, unknown>;
    if (typeof s.bestLapMs !== "number" || typeof s.bestLapAt !== "number" || typeof s.updatedAt !== "number") return null;
    return {
      playerName: typeof s.playerName === "string" ? s.playerName : "",
      bestLapMs: s.bestLapMs,
      bestLapVehicle: typeof s.bestLapVehicle === "string" ? s.bestLapVehicle : "",
      bestLapSectors: typeof s.bestLapSectors === "string" ? s.bestLapSectors : null,
      bestLapAt: new Date(s.bestLapAt),
      bestSectors: typeof s.bestSectors === "string" ? s.bestSectors : null,
      theoreticalMs: typeof s.theoreticalMs === "number" ? s.theoreticalMs : null,
      laps: typeof s.laps === "number" ? s.laps : 0,
      updatedAt: new Date(s.updatedAt),
    };
  } catch {
    return null;
  }
}

/** Null when the lap is plausible, else why not. Sector splits that don't add up are dropped. */
export function checkLap(route: RouteForLap, lap: LapInput): string | null {
  if (!Number.isInteger(lap.lapMs) || lap.lapMs <= 0 || lap.lapMs > MAX_LAP_MS) return "Invalid lap time.";
  if (lap.lapMs < (route.distanceM / MAX_AVG_SPEED_MS) * 1000) return "That lap is faster than possible.";
  return null;
}

/** Sector splits we can trust for this route, or null. */
export function cleanSectors(route: RouteForLap, lapMs: number, sectors: unknown): number[] | null {
  if (!Array.isArray(sectors) || route.sectors < 2 || sectors.length !== route.sectors) return null;
  if (!sectors.every((s) => Number.isInteger(s) && s > 0 && s <= MAX_LAP_MS)) return null;
  const sum = (sectors as number[]).reduce((a, b) => a + b, 0);
  return Math.abs(sum - lapMs) <= Math.max(1500, lapMs * 0.02) ? (sectors as number[]) : null;
}

