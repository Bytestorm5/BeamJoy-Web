/**
 * Dev seed: imports BeamJoy-Revived's bundled races as catalog entries, re-encoded into real
 * share codes exactly like the in-game exporter does. The race data is GPL-licensed and isn't
 * vendored here, so point the script at a local checkout:
 *
 *   git clone --depth 1 https://github.com/foodcache3/BeamJoy-Revived ../BeamJoy-Revived
 *   npm run db:seed -- ../BeamJoy-Revived
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema.ts";
import { analyzeRace } from "../src/lib/sharecode/analyze.ts";
import { decodeShareCode, encodeRaceShareCode } from "../src/lib/sharecode/codec.ts";
import { VANILLA_MAP_BY_LEVEL } from "../src/lib/constants.ts";

const repo = process.argv[2];
if (!repo) {
  console.error("Usage: npm run db:seed -- <path to a BeamJoy-Revived checkout>");
  process.exit(1);
}
const dir = path.join(repo, "BeamJoyServer/bundledContent/activities");

const db = drizzle(
  createClient({
    url: process.env.DATABASE_URL ?? "file:.data/beamjoy.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  }),
  { schema },
);

const author = { id: "seed:beamjoy", name: "BeamJoy bundled" };
await db.insert(schema.users).values(author).onConflictDoNothing();

const guessSurface = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("mixed")) return "mixed";
  if (n.includes("gravel") || n.includes("rally")) return "gravel";
  if (n.includes("dirt") || n.includes("oval")) return "dirt";
  if (n.includes("off-road") || n.includes("trail") || n.includes("crawl")) return "offroad";
  return "asphalt";
};
const guessTags = (name: string, loop: boolean) => {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  if (n.includes("rally") || n.includes("stage")) tags.add("rally");
  if (n.includes("hillclimb")) tags.add("hillclimb");
  if (n.includes("gymkhana")) tags.add("gymkhana");
  if (n.includes("highway") || n.includes("high speed") || n.includes("highspeed")) tags.add("high-speed");
  if (n.includes("reverse")) tags.add("reverse");
  if (loop && (n.includes("circuit") || n.includes("raceway"))) tags.add("circuit");
  return [...tags];
};

let inserted = 0;
let t = Date.now() - 1000 * 60 * 60 * 24 * 60;
for (const file of readdirSync(dir).filter((f) => f.endsWith("_races.json")).sort()) {
  const level = file.replace(/_races\.json$/, "");
  const mapName = VANILLA_MAP_BY_LEVEL[level];
  if (!mapName) continue;
  for (const race of JSON.parse(readFileSync(path.join(dir, file), "utf8"))) {
    const code = await encodeRaceShareCode({
      name: race.name,
      mode: race.mode,
      loopable: race.loopable,
      sectorCount: race.sectorCount,
      manualSectors: race.manualSectors,
      branchingEnabled: race.branchingEnabled,
      oneWayGates: race.oneWayGates,
      gates: race.gates,
      startPositions: race.startPositions,
      defaults: race.defaults,
    });
    const decoded = await decodeShareCode(code);
    const { stats: s, geometry } = analyzeRace(decoded.payload);
    const id = nanoid(10);
    t += 1000 * 60 * 37;
    await db.insert(schema.routes).values({
      id,
      title: race.name,
      description: `One of the races bundled with BeamJoy-Revived for ${mapName}.`,
      authorId: author.id,
      activityType: "race",
      shareCode: code,
      mapKind: "vanilla",
      mapKey: level,
      mapName,
      surface: guessSurface(race.name),
      distanceM: s.distanceM,
      maxDistanceM: s.maxDistanceM,
      checkpoints: s.checkpoints,
      steps: s.steps,
      corners: s.corners,
      cornersAuto: s.corners,
      hairpins: s.hairpins,
      gridSlots: s.gridSlots,
      loopable: s.loopable,
      branching: s.branching,
      sectors: s.sectors,
      defaultLaps: s.defaultLaps,
      raceMode: s.mode,
      elevationGainM: s.elevationGainM,
      elevationRangeM: s.elevationRangeM,
      geometry: JSON.stringify(geometry),
      copyCount: Math.floor(Math.random() * 60),
      createdAt: new Date(t),
      updatedAt: new Date(t),
    });
    const tags = guessTags(race.name, s.loopable);
    if (tags.length) await db.insert(schema.routeTags).values(tags.map((tag) => ({ routeId: id, tag })));
    inserted++;
  }
}
console.log(`Seeded ${inserted} routes.`);
