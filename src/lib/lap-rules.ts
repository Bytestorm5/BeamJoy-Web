/** What a lap from the game must look like before it reaches a leaderboard. Pure, so it is unit-tested. */

/** Faster than any car BeamNG ships, averaged over a whole lap (the game's own check uses 150). */
const MAX_AVG_SPEED_MS = 150;
const MAX_LAP_MS = 6 * 3_600_000;

export type LapInput = {
  lapMs: number;
  sectors: number[] | null;
  vehicle: string;
  playerName: string;
};

export type RouteForLap = { id: string; distanceM: number; sectors: number };

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

