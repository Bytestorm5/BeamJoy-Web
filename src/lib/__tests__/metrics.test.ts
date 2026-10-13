import { describe, expect, it } from "vitest";
import { fillDays, isBot, utcDay, wilsonScore } from "../metrics";

describe("wilsonScore", () => {
  it("is 0 with no votes and stays within 0..1", () => {
    expect(wilsonScore(0, 0)).toBe(0);
    for (const [l, d] of [[1, 0], [0, 1], [50, 50], [1000, 3]]) {
      const s = wilsonScore(l, d);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("ranks consistent approval above a single vote", () => {
    expect(wilsonScore(9, 0)).toBeGreaterThan(wilsonScore(1, 0));
    expect(wilsonScore(90, 10)).toBeGreaterThan(wilsonScore(9, 1));
    expect(wilsonScore(10, 0)).toBeGreaterThan(wilsonScore(10, 5));
  });
});

describe("fillDays", () => {
  it("returns oldest-first UTC days ending today with gaps zero-filled", () => {
    const today = new Date("2026-03-02T15:00:00Z");
    const rows = [{ day: "2026-03-01", n: 4 }];
    const out = fillDays(rows, 3, (day) => ({ day, n: 0 }), today);
    expect(out).toEqual([
      { day: "2026-02-28", n: 0 },
      { day: "2026-03-01", n: 4 },
      { day: "2026-03-02", n: 0 },
    ]);
  });

  it("formats days in UTC", () => {
    expect(utcDay(new Date("2026-01-01T23:30:00-05:00"))).toBe("2026-01-02");
  });
});

describe("isBot", () => {
  it("skips crawlers, link previews and missing user agents", () => {
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/140.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36")).toBe(false);
  });
});

describe("slugs", () => {
  it("makes ASCII slugs from any title", async () => {
    const { slugify } = await import("../format");
    expect(slugify("Ünïcödé Rälly!")).toBe("unicode-rally");
    expect(slugify("  Gas Station Loop -- Reverse ")).toBe("gas-station-loop-reverse");
    expect(slugify("東京")).toBe("");
  });

  it("never gives a mod map a base-game map's slug", async () => {
    const { modMapSlug, vanillaMapByLevel } = await import("../maps");
    expect(modMapSlug("Italy")).toBe("italy-mod");
    expect(modMapSlug("Nürburgring")).toBe("nurburgring");
    expect(vanillaMapByLevel("west_coast_usa")?.slug).toBe("west-coast-usa");
  });
});
