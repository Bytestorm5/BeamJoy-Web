import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { modMapSlug, vanillaMapByLevel } from "@/lib/maps";
import type { RouteGeometry, Vec3 } from "@/lib/sharecode/analyze";

/**
 * Which listed route a race in the game is. The game sends its gates (it knows nothing about the
 * site's ids); a route matches when it's on the same map with the same number of gates, each
 * within a few metres. Small edits that move a gate further are a different course, with its own
 * leaderboard.
 */

/** How far a gate may sit from the listed one: share codes round to millimetres, the site to 0.1 m. */
const GATE_TOLERANCE_M = 3;

export type CourseQuery = { level: string; mapName?: string; gates: Vec3[]; loopable: boolean };

/** The map slugs a level can be listed under. */
export function mapKeysForLevel(level: string, mapName?: string) {
  const vanilla = vanillaMapByLevel(level);
  if (vanilla) return [vanilla.slug];
  return [...new Set([modMapSlug(level), ...(mapName ? [modMapSlug(mapName)] : [])])];
}

function sameCourse(a: Vec3[], b: Vec3[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i][0] - b[i][0];
    const dy = a[i][1] - b[i][1];
    const dz = a[i][2] - b[i][2];
    if (dx * dx + dy * dy + dz * dz > GATE_TOLERANCE_M * GATE_TOLERANCE_M) return false;
  }
  return true;
}

/** The oldest listed route with this course, or null. */
export async function findCourse(q: CourseQuery) {
  const candidates = await getDb()
    .select({
      id: schema.routes.id,
      slug: schema.routes.slug,
      title: schema.routes.title,
      authorId: schema.routes.authorId,
      sectors: schema.routes.sectors,
      distanceM: schema.routes.distanceM,
      geometry: schema.routes.geometry,
    })
    .from(schema.routes)
    .where(
      and(
        or(eq(schema.routes.levelId, q.level), inArray(schema.routes.mapKey, mapKeysForLevel(q.level, q.mapName))),
        eq(schema.routes.checkpoints, q.gates.length),
        eq(schema.routes.loopable, q.loopable),
      ),
    )
    .orderBy(asc(schema.routes.createdAt))
    .limit(50);
  for (const c of candidates) {
    const g = JSON.parse(c.geometry) as RouteGeometry;
    if (sameCourse(g.gates, q.gates)) return c;
  }
  return null;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e6;

/** Gates as the game sends them: [[x, y, z], ...] or [{x, y, z}, ...]. Null when malformed. */
export function parseGates(raw: unknown): Vec3[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2000) return null;
  const out: Vec3[] = [];
  for (const g of raw) {
    const v = Array.isArray(g) ? g : g && typeof g === "object" ? [(g as Vec3Obj).x, (g as Vec3Obj).y, (g as Vec3Obj).z] : null;
    if (!v || !finite(v[0]) || !finite(v[1]) || !finite(v[2])) return null;
    out.push([v[0], v[1], v[2]]);
  }
  return out;
}

type Vec3Obj = { x: unknown; y: unknown; z: unknown };

/** Level folder names are plain identifiers in the game; anything else is refused. */
export function parseLevel(raw: unknown) {
  return typeof raw === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(raw) ? raw : null;
}
