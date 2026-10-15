import "server-only";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/db";

/**
 * Level road maps: the game's own road graph (`map.getMap()` in BeamNG), uploaded once per level
 * by the first linked player who loads it, and drawn under route and live maps. Exact world
 * coordinates, so it lines up with the gates without any calibration.
 *
 * Format (v1): `{ v: 1, nodes: [[x, y, z, radius], ...], edges: [[a, b], ...] }`, where `a`/`b`
 * index `nodes`. Stored gzipped in R2 under `levels/`.
 */

export type RoadMap = { v: 1; nodes: [number, number, number, number][]; edges: [number, number][] };

const MAX_NODES = 300_000;
const MAX_EDGES = 600_000;
/** Decompressed; a big map is a few MB. */
export const MAX_ROADS_BYTES = 24 * 1024 * 1024;

const bucket = () => getCloudflareContext().env.STORAGE;
const keyFor = (level: string) => `levels/${level}/roads.json.gz`;

export function validateRoads(raw: unknown): RoadMap | string {
  if (!raw || typeof raw !== "object") return "Not a road map.";
  const r = raw as Partial<RoadMap>;
  if (r.v !== 1 || !Array.isArray(r.nodes) || !Array.isArray(r.edges)) return "Unknown road map format.";
  if (r.nodes.length < 2 || r.nodes.length > MAX_NODES || r.edges.length < 1 || r.edges.length > MAX_EDGES) {
    return "Road map is empty or too big.";
  }
  for (const n of r.nodes) {
    if (!Array.isArray(n) || n.length !== 4 || !n.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e6)) {
      return "Malformed road node.";
    }
  }
  const count = r.nodes.length;
  for (const e of r.edges) {
    if (!Array.isArray(e) || e.length !== 2 || !e.every((i) => Number.isInteger(i) && i >= 0 && i < count)) {
      return "Malformed road edge.";
    }
  }
  return r as RoadMap;
}

export function boundsOf(map: RoadMap): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of map.nodes) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [Math.floor(minX), Math.floor(minY), Math.ceil(maxX), Math.ceil(maxY)];
}

export async function hasRoads(level: string) {
  const [row] = await getDb()
    .select({ level: schema.levelMaps.level })
    .from(schema.levelMaps)
    .where(eq(schema.levelMaps.level, level))
    .limit(1);
  return !!row;
}

/** Stores a validated road map (gzipped) unless the level already has one. */
export async function saveRoads(level: string, map: RoadMap, gzipped: Uint8Array, userId: string) {
  if (await hasRoads(level)) return false;
  const key = keyFor(level);
  await bucket().put(key, gzipped, { httpMetadata: { contentType: "application/json", contentEncoding: "gzip" } });
  await getDb()
    .insert(schema.levelMaps)
    .values({
      level,
      storageKey: key,
      nodes: map.nodes.length,
      edges: map.edges.length,
      bounds: JSON.stringify(boundsOf(map)),
      uploadedBy: userId,
    })
    .onConflictDoNothing();
  return true;
}

/** The level's road map as a JSON byte stream, or null. */
export async function readRoads(level: string) {
  const obj = await bucket().get(keyFor(level));
  if (!obj) return null;
  return obj.body.pipeThrough(new DecompressionStream("gzip"));
}

export async function gunzipLimited(bytes: Uint8Array, limit: number): Promise<string | null> {
  const reader = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(out);
}

export async function gzipText(text: string) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
