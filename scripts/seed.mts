/**
 * Dev seed: imports BeamJoy-Revived's bundled races as catalog entries, re-encoded into real
 * share codes exactly like the in-game exporter does. The race data is GPL-licensed and isn't
 * vendored here, so point the script at a local checkout:
 *
 *   git clone --depth 1 https://github.com/foodcache3/BeamJoy-Revived ../BeamJoy-Revived
 *   npm run db:seed -- ../BeamJoy-Revived
 *
 * Writes to the local D1 database that `next dev` uses (via wrangler's platform proxy), and adds
 * some synthetic views/downloads/votes so the metrics UI has something to show. Dev only.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema.ts";
import { analyzeRace } from "../src/lib/sharecode/analyze.ts";
import { decodeShareCode, encodeRaceShareCode } from "../src/lib/sharecode/codec.ts";
import { slugify } from "../src/lib/format.ts";
import { vanillaMapByLevel } from "../src/lib/maps.ts";
import { utcDay, wilsonScore } from "../src/lib/metrics.ts";

const repo = process.argv[2];
if (!repo) {
  console.error("Usage: npm run db:seed -- <path to a BeamJoy-Revived checkout>");
  process.exit(1);
}
const dir = path.join(repo, "BeamJoyServer/bundledContent/activities");

const proxy = await getPlatformProxy<CloudflareEnv>();
const db = drizzle(proxy.env.DB, { schema });

const author = { id: "seed:beamjoy", slug: "beamjoy-bundled", name: "BeamJoy bundled" };
const voters = Array.from({ length: 12 }, (_, i) => ({
  id: `seed:voter${i}`,
  slug: `seed-voter-${i + 1}`,
  name: `Seed voter ${i + 1}`,
}));
await db.insert(schema.users).values([author, ...voters]).onConflictDoNothing();

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
const slugs = new Set(
  (await db.select({ slug: schema.routes.slug }).from(schema.routes)).map((r) => r.slug),
);
let t = Date.now() - 1000 * 60 * 60 * 24 * 60;
for (const file of readdirSync(dir).filter((f) => f.endsWith("_races.json")).sort()) {
  const level = file.replace(/_races\.json$/, "");
  const map = vanillaMapByLevel(level);
  if (!map) continue;
  const mapName = map.name;
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
    let slug = slugify(race.name) || "route";
    for (let n = 2; slugs.has(slug); n++) slug = `${slugify(race.name) || "route"}-${n}`;
    slugs.add(slug);
    await db.insert(schema.routes).values({
      id,
      slug,
      title: race.name,
      description: `One of the races bundled with BeamJoy-Revived for ${mapName}.`,
      authorId: author.id,
      activityType: "race",
      shareCode: code,
      mapKind: "vanilla",
      mapKey: map.slug,
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
      createdAt: new Date(t),
      updatedAt: new Date(t),
    });
    const tags = guessTags(race.name, s.loopable);
    if (tags.length) await db.insert(schema.routeTags).values(tags.map((tag) => ({ routeId: id, tag })));
    await seedMetrics(id, new Date(t));
    inserted++;
  }
}
console.log(`Seeded ${inserted} routes into local D1.`);
await proxy.dispose();

/** Synthetic engagement: a popularity-weighted random walk of daily views/downloads, plus votes. */
async function seedMetrics(routeId: string, created: Date) {
  const pop = Math.random() ** 2 * 40;
  const days: { routeId: string; day: string; views: number; copies: number }[] = [];
  for (let d = new Date(created); d <= new Date(); d = new Date(d.getTime() + 86_400_000)) {
    const views = Math.max(0, Math.round(pop * (0.4 + Math.random())));
    if (!views) continue;
    days.push({ routeId, day: utcDay(d), views, copies: Math.round(views * Math.random() * 0.35) });
  }
  // D1 caps bound parameters per statement, so insert in chunks.
  for (let i = 0; i < days.length; i += 20) await db.insert(schema.routeDailyStats).values(days.slice(i, i + 20));
  const votes = voters.filter(() => Math.random() < pop / 50).map((v) => ({
    routeId,
    userId: v.id,
    value: Math.random() < 0.8 ? 1 : -1,
  }));
  if (votes.length) await db.insert(schema.routeVotes).values(votes);
  const likes = votes.filter((v) => v.value === 1).length;
  const dislikes = votes.length - likes;
  await db
    .update(schema.routes)
    .set({
      viewCount: days.reduce((a, d) => a + d.views, 0),
      copyCount: days.reduce((a, d) => a + d.copies, 0),
      likeCount: likes,
      dislikeCount: dislikes,
      ratingScore: wilsonScore(likes, dislikes),
    })
    .where(eq(schema.routes.id, routeId));
}
