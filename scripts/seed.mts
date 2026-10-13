/**
 * Dev seed: loads BeamJoy-Revived's bundled races (scripts/lib/bundled-routes.mts) into the local
 * D1 database that `next dev` uses, plus synthetic views, downloads and votes so the metrics UI
 * has something to show. Dev only; production uses `npm run db:import-bundled`.
 *
 *   npm run db:seed -- ../BeamJoy-Revived
 */
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { utcDay, wilsonScore } from "../src/lib/metrics.ts";
import { BUNDLED_AUTHOR, bundledRoutes } from "./lib/bundled-routes.mts";

const repo = process.argv[2];
if (!repo) {
  console.error("Usage: npm run db:seed -- <path to a BeamJoy-Revived checkout>");
  process.exit(1);
}

const proxy = await getPlatformProxy<CloudflareEnv>();
const db = drizzle(proxy.env.DB, { schema });

const voters = Array.from({ length: 12 }, (_, i) => ({
  id: `seed:voter${i}`,
  slug: `seed-voter-${i + 1}`,
  name: `Seed voter ${i + 1}`,
}));
await db.insert(schema.users).values([BUNDLED_AUTHOR, ...voters]).onConflictDoNothing();

const taken = new Set((await db.select({ slug: schema.routes.slug }).from(schema.routes)).map((r) => r.slug));
const bundled = await bundledRoutes(repo, { taken });
// Spread creation over the last 60 days so the activity charts have history.
const DAY = 86_400_000;
for (const [i, { route, tags }] of bundled.entries()) {
  const at = new Date(Date.now() - 60 * DAY + (i * 60 * DAY) / bundled.length);
  await db.insert(schema.routes).values({ ...route, createdAt: at, updatedAt: at });
  if (tags.length) await db.insert(schema.routeTags).values(tags.map((tag) => ({ routeId: route.id!, tag })));
  await seedMetrics(route.id!, at);
}
console.log(`Seeded ${bundled.length} routes into local D1.`);
await proxy.dispose();

/** Synthetic engagement: a popularity-weighted random walk of daily views/downloads, plus votes. */
async function seedMetrics(routeId: string, created: Date) {
  const pop = Math.random() ** 2 * 40;
  const days: { routeId: string; day: string; views: number; copies: number }[] = [];
  for (let d = new Date(created); d <= new Date(); d = new Date(d.getTime() + DAY)) {
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
