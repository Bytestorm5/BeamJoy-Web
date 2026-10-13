/**
 * BeamJoy-Revived's bundled races as catalog rows, re-encoded into real share codes exactly like
 * the in-game exporter does. Shared by the dev seed and the production import.
 *
 * The race data is GPL-licensed and isn't vendored here; callers pass a local checkout:
 *   git clone --depth 1 https://github.com/foodcache3/BeamJoy-Revived ../BeamJoy-Revived
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type * as schema from "../../src/db/schema.ts";
import { analyzeRace } from "../../src/lib/sharecode/analyze.ts";
import { decodeShareCode, encodeRaceShareCode } from "../../src/lib/sharecode/codec.ts";
import { slugify } from "../../src/lib/format.ts";
import { vanillaMapByLevel } from "../../src/lib/maps.ts";

/** The account bundled routes are listed under. Not a login: no provider issues `system:` ids. */
export const BUNDLED_AUTHOR = { id: "system:beamjoy-revived", slug: "beamjoy-revived", name: "BeamJoy-Revived" };

export type BundledRoute = {
  route: typeof schema.routes.$inferInsert;
  tags: string[];
};

function guessSurface(name: string) {
  const n = name.toLowerCase();
  if (n.includes("mixed")) return "mixed";
  if (n.includes("gravel") || n.includes("rally")) return "gravel";
  if (n.includes("dirt") || n.includes("oval")) return "dirt";
  if (n.includes("off-road") || n.includes("trail") || n.includes("crawl")) return "offroad";
  return "asphalt";
}

function guessTags(name: string, loop: boolean) {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  if (n.includes("rally") || n.includes("stage")) tags.add("rally");
  if (n.includes("hillclimb")) tags.add("hillclimb");
  if (n.includes("gymkhana")) tags.add("gymkhana");
  if (n.includes("highway") || n.includes("high speed") || n.includes("highspeed")) tags.add("high-speed");
  if (n.includes("reverse")) tags.add("reverse");
  if (loop && (n.includes("circuit") || n.includes("raceway"))) tags.add("circuit");
  return [...tags];
}

/**
 * Every bundled race on a vanilla map, in a stable order (file, then position in the file).
 * `taken` holds slugs already in use; a clashing title gets the map's slug, then a number.
 * Creation times count down from `newest` a minute apart, so the first race sorts first.
 */
export async function bundledRoutes(
  repo: string,
  { taken = new Set<string>(), newest = Date.now() }: { taken?: Set<string>; newest?: number } = {},
): Promise<BundledRoute[]> {
  const dir = path.join(repo, "BeamJoyServer/bundledContent/activities");
  const out: BundledRoute[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith("_races.json")).sort()) {
    const map = vanillaMapByLevel(file.replace(/_races\.json$/, ""));
    if (!map) {
      console.warn(`Skipping ${file}: not a known vanilla map.`);
      continue;
    }
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
      const { stats: s, geometry } = analyzeRace((await decodeShareCode(code)).payload);

      const base = slugify(race.name) || "route";
      let slug = taken.has(base) ? `${base}-${map.slug}` : base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${map.slug}-${n}`;
      taken.add(slug);

      const at = new Date(newest - out.length * 60_000);
      const builtBy = typeof race.author === "string" && race.author.trim() ? race.author.trim() : null;
      out.push({
        route: {
          id: nanoid(10),
          slug,
          title: race.name,
          description: builtBy ? `Bundled with BeamJoy-Revived. Built by ${builtBy}.` : "Bundled with BeamJoy-Revived.",
          authorId: BUNDLED_AUTHOR.id,
          activityType: "race",
          shareCode: code,
          mapKind: "vanilla",
          mapKey: map.slug,
          mapName: map.name,
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
          createdAt: at,
          updatedAt: at,
        },
        tags: guessTags(race.name, s.loopable),
      });
    }
  }
  return out;
}
