import { describe, expect, it } from "vitest";
import { formatLap } from "../format";
import { checkLap, cleanSectors } from "../lap-rules";

const route = { id: "r", distanceM: 3000, sectors: 3 };
const lap = (lapMs: number) => ({ lapMs, sectors: null, vehicle: "", playerName: "" });

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

describe("formatLap", () => {
  it("formats like a timing screen", () => {
    expect(formatLap(83_456)).toBe("1:23.456");
    expect(formatLap(9_005)).toBe("9.005");
    expect(formatLap(3_723_004)).toBe("1:02:03.004");
    expect(formatLap(-1_500)).toBe("-1.500");
  });
});
