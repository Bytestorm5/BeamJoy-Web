import { describe, expect, it } from "vitest";
import { formatLap } from "../format";
import {
  checkLap,
  cleanSectors,
  mergeLap,
  parseRun,
  parseStart,
  pickStart,
  restoreRecord,
  snapshotRecord,
  type LapInput,
} from "../lap-rules";

const route = { id: "r", distanceM: 3000, sectors: 3 };
const lap = (lapMs: number, sectors: number[] | null = null): LapInput => ({
  lapMs,
  sectors,
  vehicle: "ETK 800",
  playerName: "Bob",
  start: "flying",
  run: null,
});

describe("lap rules", () => {
  it("accepts a plausible lap", () => {
    expect(checkLap(route, lap(95_000))).toBeNull();
  });
  it("refuses laps faster than 150 m/s on average, or nonsense", () => {
    expect(checkLap(route, lap(19_000))).toMatch(/faster/);
    expect(checkLap(route, lap(-5))).toBeTruthy();
    expect(checkLap(route, lap(1.5))).toBeTruthy();
  });
  it("keeps sector splits only when they add up to the lap", () => {
    expect(cleanSectors(route, 90_000, [30_000, 30_000, 30_000])).toEqual([30_000, 30_000, 30_000]);
    expect(cleanSectors(route, 90_000, [30_000, 30_000, 20_000])).toBeNull();
    expect(cleanSectors(route, 90_000, [45_000, 45_000])).toBeNull();
    expect(cleanSectors({ ...route, sectors: 1 }, 90_000, [90_000])).toBeNull();
    expect(cleanSectors(route, 90_000, "junk")).toBeNull();
  });
});

describe("boards", () => {
  it("reads a start, nothing else", () => {
    expect(parseStart("standing")).toBe("standing");
    expect(parseStart("flying")).toBe("flying");
    expect(parseStart("grid")).toBeNull();
  });
  it("opens circuits on flying laps and sprints on standing starts, unless only the other has times", () => {
    expect(pickStart(undefined, true, { standing: 0, flying: 0 })).toBe("flying");
    expect(pickStart(undefined, false, { standing: 0, flying: 0 })).toBe("standing");
    expect(pickStart(undefined, false, { standing: 0, flying: 4 })).toBe("flying");
    expect(pickStart(undefined, true, { standing: 3, flying: 1 })).toBe("flying");
    expect(pickStart("standing", true, { standing: 0, flying: 9 })).toBe("standing");
  });
});

describe("runs", () => {
  it("takes a run id and a lap number", () => {
    expect(parseRun("8f2c-4a#2", 3)).toEqual({ run: "8f2c-4a#2", runLap: 3 });
    expect(parseRun("a b", 1)).toBeNull();
    expect(parseRun("x".repeat(101), 1)).toBeNull();
    expect(parseRun("abc", 0)).toBeNull();
    expect(parseRun("abc", 1.5)).toBeNull();
    expect(parseRun(undefined, 1)).toBeNull();
  });
});

describe("records", () => {
  it("keeps the best lap and the best of each sector, from any lap", () => {
    const first = mergeLap(route, null, lap(95_000, [30_000, 35_000, 30_000]), 1_000);
    expect(first).toMatchObject({ isPB: true, bestLapMs: 95_000, theoreticalMs: 95_000, laps: 1 });
    const second = mergeLap(route, first, lap(96_000, [29_000, 37_000, 30_000]), 2_000);
    expect(second).toMatchObject({ isPB: false, bestLapMs: 95_000, theoreticalMs: 94_000, laps: 2 });
    expect(JSON.parse(second.bestSectors!)).toEqual([29_000, 35_000, 30_000]);
    expect(second.bestLapAt.getTime()).toBe(1_000);
  });
  it("snapshots a record and puts it back as it was", () => {
    const fields = mergeLap(route, null, lap(95_000, [30_000, 35_000, 30_000]), 1_000);
    // a database row: only the record's own fields go in, never an earlier snapshot
    const row = { ...fields, routeId: "r", run: "a#1", beforeRun: '{"bestLapMs":1}' };
    const snap = snapshotRecord(row);
    expect(snap).not.toContain("beforeRun");
    expect(restoreRecord(snap)).toEqual({ ...fields, isPB: undefined });
    expect(restoreRecord("{}")).toBeNull();
    expect(restoreRecord("junk")).toBeNull();
  });
});

describe("formatLap", () => {
  it("formats like a timing screen", () => {
    expect(formatLap(83_456)).toBe("1:23.456");
    expect(formatLap(9_005)).toBe("9.005");
    expect(formatLap(3_723_004)).toBe("1:02:03.004");
    expect(formatLap(-1_500)).toBe("-1.500");
  });
});
