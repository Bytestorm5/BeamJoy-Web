"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getViewer,
  isAccessDenied,
  requireCreateRoute,
  requireDeleteRoute,
  requireRateRoute,
  requireRecordActivity,
  requireUpdateRoute,
} from "@/lib/access";
import { ALFIZ_SYSTEM, alfizApp } from "@/lib/alfiz/app";
import { getDb, schema } from "@/db";
import { LIMITS } from "@/lib/constants";
import { parseRouteForm, type FieldErrors } from "@/lib/route-input";
import { analyzeRace } from "@/lib/sharecode/analyze";
import { decodeShareCode, ShareCodeError } from "@/lib/sharecode/codec";
import { isBot, utcDay, wilsonScore } from "@/lib/metrics";
import { routePath } from "@/lib/paths";
import { freeSlug } from "@/lib/queries";
import { deleteImages, sniffImageType, storeImage } from "@/lib/storage";

const { routes, routeImages, routeTags, routeDailyStats, routeVotes } = schema;

export type FormState = { errors?: FieldErrors; message?: string };

async function analyzeCode(code: string) {
  try {
    const decoded = await decodeShareCode(code);
    return { ok: true as const, decoded, analysis: analyzeRace(decoded.payload) };
  } catch (e) {
    const message = e instanceof ShareCodeError ? e.message : "Invalid share code.";
    return { ok: false as const, message };
  }
}

async function readImages(fd: FormData, room: number) {
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > room) {
    return { error: `Up to ${LIMITS.images} screenshots.` };
  }
  const out: { bytes: Uint8Array; type: string }[] = [];
  for (const f of files) {
    if (f.size > LIMITS.imageBytes) return { error: `"${f.name}" is over 5 MB.` };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return { error: `"${f.name}" isn’t a supported image.` };
    out.push({ bytes, type });
  }
  return { images: out };
}

function statColumns(analysis: ReturnType<typeof analyzeRace>, cornersOverride: number | null) {
  const s = analysis.stats;
  return {
    distanceM: s.distanceM,
    maxDistanceM: s.maxDistanceM,
    checkpoints: s.checkpoints,
    steps: s.steps,
    corners: cornersOverride ?? s.corners,
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
    geometry: JSON.stringify(analysis.geometry),
  };
}

/** A denied gate as form feedback; anything else is a real error. */
function denied(e: unknown, signedOut: string, forbidden: string): FormState {
  if (!isAccessDenied(e)) throw e;
  return { message: e.reason === "unauthenticated" ? signedOut : forbidden };
}

export async function createRoute(_prev: FormState, fd: FormData): Promise<FormState> {
  let user;
  try {
    user = await requireCreateRoute(await getViewer());
  } catch (e) {
    return denied(e, "Sign in to share.", "You can't share routes.");
  }

  const code = await analyzeCode(String(fd.get("shareCode") ?? ""));
  if (!code.ok) return { errors: { shareCode: code.message } };

  const input = parseRouteForm(fd);
  if (!input.ok) return { errors: input.errors };

  const imgs = await readImages(fd, LIMITS.images);
  if ("error" in imgs) return { errors: { images: imgs.error } };

  const id = nanoid(10);
  const d = input.data;
  // Upload first so the rows can reference the stored files in one atomic batch.
  const [slug, stored] = await Promise.all([
    freeSlug(routes.slug, d.title, "route"),
    Promise.all(imgs.images.map((img) => storeImage(img.bytes, img.type))),
  ]);
  const db = getDb();
  try {
    await db.batch([
      db.insert(routes).values({
        id,
        slug,
        title: d.title,
        description: d.description,
        authorId: user.id,
        activityType: code.decoded.type,
        shareCode: code.decoded.code,
        mapKind: d.mapKind,
        mapKey: d.mapKey,
        mapName: d.mapName,
        mapDownloadUrl: d.mapDownloadUrl,
        surface: d.surface,
        videoUrl: d.videoUrl ?? null,
        coverUrl: stored[0]?.url ?? null,
        ...statColumns(code.analysis, d.cornersOverride),
      }),
      ...d.tags.map((tag) => db.insert(routeTags).values({ routeId: id, tag })),
      ...stored.map((s, i) =>
        db.insert(routeImages).values({ id: nanoid(12), routeId: id, url: s.url, storageKey: s.storageKey, position: i }),
      ),
    ]);
  } catch (e) {
    await deleteImages(stored.map((s) => s.storageKey));
    throw e;
  }

  redirect(routePath(slug));
}

async function routeBySlug(slug: string) {
  const [route] = await getDb().select().from(routes).where(eq(routes.slug, slug)).limit(1);
  return route ?? null;
}

export async function updateRoute(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const route = await routeBySlug(slug);
  if (!route) return { message: "Route not found." };
  try {
    await requireUpdateRoute(await getViewer(), route);
  } catch (e) {
    return denied(e, "Sign in to edit.", "You can only edit your own routes.");
  }
  const routeId = route.id;

  const input = parseRouteForm(fd);
  if (!input.ok) return { errors: input.errors };
  const d = input.data;

  const newCode = String(fd.get("shareCode") ?? "").replace(/\s+/g, "");
  let stats: ReturnType<typeof statColumns> | null = null;
  let shareCode = route.shareCode;
  if (newCode && newCode !== route.shareCode) {
    const code = await analyzeCode(newCode);
    if (!code.ok) return { errors: { shareCode: code.message } };
    stats = statColumns(code.analysis, d.cornersOverride);
    shareCode = code.decoded.code;
  }

  const db = getDb();
  const removeIds = fd.getAll("removeImage").map(String);
  const existing = await db
    .select()
    .from(routeImages)
    .where(eq(routeImages.routeId, routeId))
    .orderBy(asc(routeImages.position));
  const removing = existing.filter((img) => removeIds.includes(img.id));
  const kept = existing.filter((img) => !removeIds.includes(img.id));

  const imgs = await readImages(fd, LIMITS.images - kept.length);
  if ("error" in imgs) return { errors: { images: imgs.error } };

  const maxPos = existing.reduce((m, i) => Math.max(m, i.position), -1);
  const stored = await Promise.all(imgs.images.map((img) => storeImage(img.bytes, img.type)));
  const added = stored.map((s, i) => ({
    id: nanoid(12),
    routeId,
    url: s.url,
    storageKey: s.storageKey,
    position: maxPos + 1 + i,
  }));
  const cover = [...kept, ...added][0]?.url ?? null;

  try {
    await db.batch([
      db
        .update(routes)
        .set({
          title: d.title,
          description: d.description,
          shareCode,
          mapKind: d.mapKind,
          mapKey: d.mapKey,
          mapName: d.mapName,
          mapDownloadUrl: d.mapDownloadUrl,
          surface: d.surface,
          videoUrl: d.videoUrl ?? null,
          coverUrl: cover,
          ...(stats ?? { corners: d.cornersOverride ?? route.cornersAuto }),
          updatedAt: new Date(),
        })
        .where(eq(routes.id, routeId)),
      db.delete(routeTags).where(eq(routeTags.routeId, routeId)),
      ...d.tags.map((tag) => db.insert(routeTags).values({ routeId, tag })),
      ...removing.map((r) => db.delete(routeImages).where(eq(routeImages.id, r.id))),
      ...added.map((a) => db.insert(routeImages).values(a)),
    ]);
  } catch (e) {
    await deleteImages(added.map((a) => a.storageKey));
    throw e;
  }
  await deleteImages(removing.map((r) => r.storageKey));

  redirect(routePath(route.slug));
}

export async function deleteRoute(slug: string) {
  const route = await routeBySlug(slug);
  if (!route) return;
  await requireDeleteRoute(await getViewer(), route);
  const db = getDb();
  const images = await db.select().from(routeImages).where(eq(routeImages.routeId, route.id));
  // Tags, images, votes and daily stats cascade.
  await db.delete(routes).where(eq(routes.id, route.id));
  // Drop any access rows scoped to the route, so a reused id can't inherit them.
  await (await alfizApp()).deleteScope(`bj.route:${route.id}`, ALFIZ_SYSTEM);
  await deleteImages(images.map((i) => i.storageKey));
  redirect("/");
}

/**
 * Counts a page view or a share-code copy ("download") for today's bucket. Deduplicated per
 * browser per route per UTC day with a small cookie, and skipped for obvious bots.
 */
export async function trackRouteEvent(slug: string, kind: "view" | "copy") {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) return;
  if (kind !== "view" && kind !== "copy") return;
  if (isBot((await headers()).get("user-agent"))) return;
  try {
    await requireRecordActivity(await getViewer());
  } catch (e) {
    if (isAccessDenied(e)) return;
    throw e;
  }

  const day = utcDay();
  const jar = await cookies();
  const [cookieDay, ...seen] = (jar.get("bj_seen")?.value ?? "").split(".");
  const seenToday = cookieDay === day ? seen : [];
  // A short hash keeps the cookie small however long slugs get.
  const token = `${kind[0]}${shortHash(slug)}`;
  if (seenToday.includes(token)) return;

  const db = getDb();
  const isView = kind === "view";
  const routeId = sql<string>`(select ${routes.id} from ${routes} where ${routes.slug} = ${slug})`;
  try {
    await db.batch([
      db
        .insert(routeDailyStats)
        .values({ routeId, day, views: isView ? 1 : 0, copies: isView ? 0 : 1 })
        .onConflictDoUpdate({
          target: [routeDailyStats.routeId, routeDailyStats.day],
          set: isView
            ? { views: sql`${routeDailyStats.views} + 1` }
            : { copies: sql`${routeDailyStats.copies} + 1` },
        }),
      db
        .update(routes)
        .set(isView ? { viewCount: sql`${routes.viewCount} + 1` } : { copyCount: sql`${routes.copyCount} + 1` })
        .where(eq(routes.slug, slug)),
    ]);
  } catch {
    return; // Unknown slug (null route_id): nothing to count.
  }
  jar.set("bj_seen", [day, ...seenToday, token].slice(0, 120).join("."), {
    maxAge: 60 * 60 * 26,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

/** FNV-1a, 32-bit, hex. Only for de-duplication tokens, not security. */
function shortHash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

export type VoteResult = { likes: number; dislikes: number; myVote: -1 | 0 | 1; error?: string };

/** Like (1), dislike (-1) or clear (0) the signed-in user's vote on a route. */
export async function voteRoute(slug: string, value: -1 | 0 | 1): Promise<VoteResult> {
  const viewer = await getViewer();
  const db = getDb();
  const [route] = await db
    .select({ id: routes.id, authorId: routes.authorId, likes: routes.likeCount, dislikes: routes.dislikeCount })
    .from(routes)
    .where(eq(routes.slug, slug))
    .limit(1);
  if (!route) return { likes: 0, dislikes: 0, myVote: 0, error: "Route not found." };
  const refuse = (error: string) => ({ likes: route.likes, dislikes: route.dislikes, myVote: 0 as const, error });
  try {
    await requireRateRoute(viewer, route);
  } catch (e) {
    if (!isAccessDenied(e)) throw e;
    if (e.reason === "unauthenticated") return refuse("Sign in to rate.");
    return refuse(viewer.user?.id === route.authorId ? "You can't rate your own route." : "You can't rate routes.");
  }
  const user = viewer.user!;
  const routeId = route.id;
  if (value !== 1 && value !== -1 && value !== 0) value = 0;

  const tally = (v: number) =>
    sql<number>`(select count(*) from ${routeVotes} where ${routeVotes.routeId} = ${routeId} and ${routeVotes.value} = ${v})`;
  const [, [counts]] = await db.batch([
    value === 0
      ? db.delete(routeVotes).where(and(eq(routeVotes.routeId, routeId), eq(routeVotes.userId, user.id)))
      : db
          .insert(routeVotes)
          .values({ routeId, userId: user.id, value })
          .onConflictDoUpdate({ target: [routeVotes.routeId, routeVotes.userId], set: { value } }),
    db
      .update(routes)
      .set({ likeCount: tally(1), dislikeCount: tally(-1) })
      .where(eq(routes.id, routeId))
      .returning({ likes: routes.likeCount, dislikes: routes.dislikeCount }),
  ]);
  await db
    .update(routes)
    .set({ ratingScore: wilsonScore(counts.likes, counts.dislikes) })
    .where(eq(routes.id, routeId));
  return { likes: counts.likes, dislikes: counts.dislikes, myVote: value };
}
