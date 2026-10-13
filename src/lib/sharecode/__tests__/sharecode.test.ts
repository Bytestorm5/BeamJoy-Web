import { describe, expect, it } from "vitest";
import { analyzeRace, countCorners, type Vec2 } from "../analyze";
import { decodeShareCode, encodeRaceShareCode, ShareCodeError } from "../codec";
import type { RacePayload } from "../race";

const gate = (x: number, y: number, z = 0, extra: object = {}) => ({
  pos: { x, y, z },
  dir: { x: 1, y: 0, z: 0 },
  width: 8,
  height: 5,
  ...extra,
});

// A 100 m x 50 m rectangle driven anticlockwise.
const rectangle: RacePayload = {
  name: "Box",
  mode: "grid",
  loopable: true,
  sectorCount: 2,
  gates: [gate(0, 0), gate(100, 0, 5), gate(100, 50, 10), gate(0, 50, 5)],
  startPositions: [{ pos: { x: -5, y: 0, z: 0 } }, { pos: { x: -10, y: 0, z: 0 } }],
  defaults: { laps: 4 },
};

describe("share codes", () => {
  it("round-trips through the in-game encoding", async () => {
    const code = await encodeRaceShareCode(rectangle);
    expect(code.startsWith("BJRACE1:")).toBe(true);
    const decoded = await decodeShareCode(code);
    expect(decoded.payload.gates).toHaveLength(4);
    expect(decoded.payload.name).toBe("Box");
  });

  it("tolerates whitespace and line breaks from chat apps", async () => {
    const code = await encodeRaceShareCode(rectangle);
    const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 40)} ${code.slice(40)}\n`;
    await expect(decodeShareCode(mangled)).resolves.toMatchObject({ code });
  });

  it("rejects unknown prefixes, corrupt data and payloads without gates", async () => {
    await expect(decodeShareCode("hello")).rejects.toBeInstanceOf(ShareCodeError);
    await expect(decodeShareCode("BJRACE1:@@@")).rejects.toBeInstanceOf(ShareCodeError);
    const noGates = await encodeRaceShareCode({ ...rectangle, gates: [] });
    await expect(decodeShareCode(noGates)).rejects.toThrow(/valid race/);
  });

  it("refuses gzip bombs", async () => {
    const huge = await encodeRaceShareCode({ ...rectangle, padding: "x".repeat(9_000_000) } as RacePayload);
    await expect(decodeShareCode(huge)).rejects.toThrow(/too large/);
  });
});

describe("analyzeRace", () => {
  it("measures a full lap on circuits, including the closing stretch", () => {
    const { stats } = analyzeRace(rectangle);
    expect(stats.loopable).toBe(true);
    // 100 + 50 + 100 + 50, with a little extra from the elevation changes.
    expect(stats.distanceM).toBeGreaterThanOrEqual(300);
    expect(stats.distanceM).toBeLessThan(303);
    expect(stats.checkpoints).toBe(4);
    expect(stats.corners).toBe(4);
    expect(stats.gridSlots).toBe(2);
    expect(stats.defaultLaps).toBe(4);
    expect(stats.elevationGainM).toBe(10);
    expect(stats.elevationRangeM).toBe(10);
  });

  it("measures sprints gate-to-gate only", () => {
    const { stats } = analyzeRace({ ...rectangle, loopable: false });
    expect(stats.distanceM).toBe(Math.round(Math.hypot(100, 5) + Math.hypot(50, 5) + Math.hypot(100, 5)));
    expect(stats.defaultLaps).toBeNull();
  });

  it("finds the shortest and longest way through branches", () => {
    // Start -> 1 -> (2 | 3 via a detour) -> 4 finish.
    const race: RacePayload = {
      loopable: false,
      branchingEnabled: true,
      gates: [
        gate(0, 0, 0, { parents: [0] }),
        gate(100, 0, 0, { parents: [1] }),
        gate(50, 80, 0, { parents: [1] }),
        gate(200, 0, 0, { parents: [2, 3], isFinish: true }),
      ],
      startPositions: [],
    };
    const { stats, geometry } = analyzeRace(race);
    expect(stats.branching).toBe(true);
    expect(stats.steps).toBe(3);
    expect(stats.distanceM).toBe(200);
    expect(stats.maxDistanceM).toBe(Math.round(Math.hypot(50, 80) + Math.hypot(150, 80)));
    expect(geometry.primary).toEqual([0, 1, 3]);
  });

  it("doesn't call a linear route branching just because the toggle is on", () => {
    const { stats } = analyzeRace({ ...rectangle, branchingEnabled: true, gates: rectangle.gates.map((g, i) => ({ ...g, parents: [i] })) });
    expect(stats.branching).toBe(false);
  });

  it("survives a cyclic parents graph", () => {
    const { stats } = analyzeRace({
      branchingEnabled: true,
      gates: [gate(0, 0, 0, { parents: [2] }), gate(10, 0, 0, { parents: [1] })],
      startPositions: [],
    });
    expect(Number.isFinite(stats.distanceM)).toBe(true);
  });
});

describe("countCorners", () => {
  it("keeps distinct corners apart on sparse layouts", () => {
    const square: Vec2[] = [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ];
    expect(countCorners(square, true).corners).toBe(4);
  });

  it("adds gentle bends up into one sweeper", () => {
    // 60 m segments, each turning 20° more than the last: 80° in all, no single sharp turn.
    const sweep: Vec2[] = [[0, 0]];
    for (let k = 0; k <= 4; k++) {
      const [x, y] = sweep[sweep.length - 1];
      const r = (k * 20 * Math.PI) / 180;
      sweep.push([x + 60 * Math.cos(r), y + 60 * Math.sin(r)]);
    }
    expect(countCorners(sweep, false).corners).toBe(1);
  });

  it("merges a hairpin spread over several gates into one corner", () => {
    const hairpin: Vec2[] = [
      [0, 0],
      [100, 0],
      [120, 10],
      [125, 30],
      [115, 45],
      [100, 50],
      [0, 50],
    ];
    expect(countCorners(hairpin, false)).toEqual({ corners: 1, hairpins: 1 });
  });

  it("splits every change of direction and ignores gentle wiggles", () => {
    const pts: Vec2[] = [
      [0, 0],
      [100, 2],
      [200, 0],
      [230, 30],
      [260, 0],
      [400, 0],
    ];
    // Left 45°, right 90°, left 45°: three separate turns.
    expect(countCorners(pts, false).corners).toBe(3);
  });
});
