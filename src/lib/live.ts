import "server-only";
import { and, count, desc, eq, gt, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import { slugify } from "@/lib/format";
import { vanillaMapByLevel } from "@/lib/maps";

/**
 * Live sessions: BeamMP servers that opted in (BeamJoy Live's server plugin) have one linked
 * player's game send the player list every few seconds. One row per server, overwritten each
 * time; a server that stops sending drops off the list after STALE_MS.
 */

export const STALE_MS = 60_000;
/** Rows nobody has updated in a day are deleted on the next write. */
const FORGET_MS = 86_400_000;
export const MAX_PLAYERS = 128;
export const LIVE_PAGE_SIZE = 20;

export type LivePlayer = {
  name: string;
  vehicle: string;
  /** World position, metres. */
  pos: [number, number, number];
  /** Degrees clockwise from north. */
  heading: number;
  /** m/s */
  speed: number;
  /** What they're doing, e.g. "Racing Hirochi GP · lap 2/5". */
  activity: string;
  spectating: boolean;
};

const finite = (n: unknown, max = 1e6): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max;
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) : "";

export function parsePlayers(raw: unknown): LivePlayer[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAYERS) return null;
  const out: LivePlayer[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const r = p as Record<string, unknown>;
    const pos = Array.isArray(r.pos) && r.pos.length === 3 && r.pos.every((n) => finite(n)) ? (r.pos as number[]) : null;
    const name = text(r.name, 40);
    if (!name) return null;
    out.push({
      name,
      vehicle: text(r.vehicle, 80),
      pos: pos ? [Math.round(pos[0] * 10) / 10, Math.round(pos[1] * 10) / 10, Math.round(pos[2] * 10) / 10] : [0, 0, 0],
      heading: finite(r.heading, 1e4) ? Math.round(((r.heading % 360) + 360) % 360) : 0,
      speed: finite(r.speed, 1e4) ? Math.round(Math.max(0, r.speed) * 10) / 10 : 0,
      activity: text(r.activity, 80),
      spectating: r.spectating === true || !pos,
    });
  }
  return out;
}

export type LiveReport = {
  serverKey: string;
  serverName: string;
  level: string;
  mapName: string;
  players: LivePlayer[];
};

export const validServerKey = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(v);

/** Upserts the server's row. Returns its slug. */
export async function saveLiveReport(r: LiveReport, reporterId: string) {
  const db = getDb();
  const now = Date.now();
  const mapName = vanillaMapByLevel(r.level)?.name ?? (r.mapName || r.level);
  const values = {
    serverName: r.serverName,
    level: r.level,
    mapName,
    reporterId,
    players: JSON.stringify(r.players),
    playerCount: r.players.length,
    updatedAt: new Date(now),
  };
  const [existing] = await db
    .select({ slug: schema.liveSessions.slug })
    .from(schema.liveSessions)
    .where(eq(schema.liveSessions.serverKey, r.serverKey))
    .limit(1);
  if (existing) {
    await db.update(schema.liveSessions).set(values).where(eq(schema.liveSessions.serverKey, r.serverKey));
    return existing.slug;
  }
  await db.delete(schema.liveSessions).where(lt(schema.liveSessions.updatedAt, new Date(now - FORGET_MS)));
  // Fixed once, like every slug: from the server name, with a short random tail because server
  // names aren't unique and the row is recreated after a day offline.
  const slug = `${slugify(r.serverName, 40) || "server"}-${nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
  await db
    .insert(schema.liveSessions)
    .values({ id: nanoid(10), slug, serverKey: r.serverKey, ...values })
    .onConflictDoNothing();
  return slug;
}

const fresh = () => gt(schema.liveSessions.updatedAt, new Date(Date.now() - STALE_MS));

export async function listLive(page: number) {
  const db = getDb();
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        slug: schema.liveSessions.slug,
        serverName: schema.liveSessions.serverName,
        mapName: schema.liveSessions.mapName,
        playerCount: schema.liveSessions.playerCount,
        updatedAt: schema.liveSessions.updatedAt,
      })
      .from(schema.liveSessions)
      .where(fresh())
      .orderBy(desc(schema.liveSessions.playerCount), desc(schema.liveSessions.updatedAt))
      .limit(LIVE_PAGE_SIZE)
      .offset((page - 1) * LIVE_PAGE_SIZE),
    db.select({ total: count() }).from(schema.liveSessions).where(fresh()),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / LIVE_PAGE_SIZE)), asOf: Date.now() };
}

export async function getLive(slug: string) {
  const [row] = await getDb()
    .select({
      slug: schema.liveSessions.slug,
      serverName: schema.liveSessions.serverName,
      level: schema.liveSessions.level,
      mapName: schema.liveSessions.mapName,
      players: schema.liveSessions.players,
      updatedAt: schema.liveSessions.updatedAt,
    })
    .from(schema.liveSessions)
    .where(and(eq(schema.liveSessions.slug, slug)))
    .limit(1);
  if (!row) return null;
  return {
    slug: row.slug,
    serverName: row.serverName,
    level: row.level,
    mapName: row.mapName,
    players: JSON.parse(row.players) as LivePlayer[],
    updatedAt: row.updatedAt.getTime(),
    online: Date.now() - row.updatedAt.getTime() < STALE_MS,
  };
}

export type LiveSession = NonNullable<Awaited<ReturnType<typeof getLive>>>;
