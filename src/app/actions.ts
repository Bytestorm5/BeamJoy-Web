"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, signIn, signOut } from "@/auth";
import { db, schema } from "@/db";
import { LIMITS } from "@/lib/constants";
import { parseRouteForm, type FieldErrors } from "@/lib/route-input";
import { analyzeRace } from "@/lib/sharecode/analyze";
import { decodeShareCode, ShareCodeError } from "@/lib/sharecode/codec";
import { deleteImage, sniffImageType, storeImage } from "@/lib/storage";

const { routes, routeImages, routeTags } = schema;

export type FormState = { errors?: FieldErrors; message?: string };

async function analyzeCode(code: string) {
  try {
    const decoded = await decodeShareCode(code);
    return { ok: true as const, decoded, analysis: analyzeRace(decoded.payload) };
  } catch (e) {
    const message = e instanceof ShareCodeError ? e.message : "Couldn't read that share code.";
    return { ok: false as const, message };
  }
}

async function readImages(fd: FormData, room: number) {
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > room) {
    return { error: `You can attach up to ${LIMITS.images} screenshots per route.` };
  }
  const out: { bytes: Uint8Array; type: string }[] = [];
  for (const f of files) {
    if (f.size > LIMITS.imageBytes) return { error: `"${f.name}" is larger than 5 MB.` };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return { error: `"${f.name}" isn't a JPEG, PNG, WebP or AVIF image.` };
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

async function refreshCover(routeId: string) {
  const [first] = await db
    .select({ url: routeImages.url })
    .from(routeImages)
    .where(eq(routeImages.routeId, routeId))
    .orderBy(asc(routeImages.position))
    .limit(1);
  await db.update(routes).set({ coverUrl: first?.url ?? null }).where(eq(routes.id, routeId));
}

export async function createRoute(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { message: "Sign in to share a route." };

  const code = await analyzeCode(String(fd.get("shareCode") ?? ""));
  if (!code.ok) return { errors: { shareCode: code.message } };

  const input = parseRouteForm(fd);
  if (!input.ok) return { errors: input.errors };

  const imgs = await readImages(fd, LIMITS.images);
  if ("error" in imgs) return { errors: { images: imgs.error } };

  const id = nanoid(10);
  const d = input.data;
  await db.insert(routes).values({
    id,
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
    ...statColumns(code.analysis, d.cornersOverride),
  });
  if (d.tags.length) await db.insert(routeTags).values(d.tags.map((tag) => ({ routeId: id, tag })));

  const stored = await Promise.all(imgs.images.map((img) => storeImage(id, img.bytes, img.type)));
  if (stored.length) {
    await db.insert(routeImages).values(
      stored.map((s, i) => ({ id: nanoid(12), routeId: id, url: s.url, storageKey: s.storageKey, position: i })),
    );
    await refreshCover(id);
  }

  redirect(`/routes/${id}`);
}

async function loadOwned(routeId: string) {
  const user = await currentUser();
  if (!user) return null;
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
  if (!route || (route.authorId !== user.id && !isAdmin(user.id))) return null;
  return route;
}

export async function updateRoute(routeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const route = await loadOwned(routeId);
  if (!route) return { message: "You can only edit routes you shared." };

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

  const removeIds = fd.getAll("removeImage").map(String);
  const existing = await db
    .select()
    .from(routeImages)
    .where(eq(routeImages.routeId, routeId))
    .orderBy(asc(routeImages.position));
  const removing = existing.filter((img) => removeIds.includes(img.id));
  const keptCount = existing.length - removing.length;

  const imgs = await readImages(fd, LIMITS.images - keptCount);
  if ("error" in imgs) return { errors: { images: imgs.error } };

  await db
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
      ...(stats ?? { corners: d.cornersOverride ?? route.cornersAuto }),
      updatedAt: new Date(),
    })
    .where(eq(routes.id, routeId));

  await db.delete(routeTags).where(eq(routeTags.routeId, routeId));
  if (d.tags.length) await db.insert(routeTags).values(d.tags.map((tag) => ({ routeId, tag })));

  if (removing.length) {
    await db.delete(routeImages).where(
      and(
        eq(routeImages.routeId, routeId),
        inArray(
          routeImages.id,
          removing.map((r) => r.id),
        ),
      ),
    );
    await Promise.all(removing.map((r) => deleteImage(r.storageKey)));
  }
  const maxPos = existing.reduce((m, i) => Math.max(m, i.position), -1);
  const stored = await Promise.all(imgs.images.map((img) => storeImage(routeId, img.bytes, img.type)));
  if (stored.length) {
    await db.insert(routeImages).values(
      stored.map((s, i) => ({
        id: nanoid(12),
        routeId,
        url: s.url,
        storageKey: s.storageKey,
        position: maxPos + 1 + i,
      })),
    );
  }
  await refreshCover(routeId);

  redirect(`/routes/${routeId}`);
}

export async function deleteRoute(routeId: string) {
  const route = await loadOwned(routeId);
  if (!route) return;
  const images = await db.select().from(routeImages).where(eq(routeImages.routeId, routeId));
  await db.delete(routes).where(eq(routes.id, routeId));
  await Promise.all(images.map((i) => deleteImage(i.storageKey)));
  redirect("/");
}

/** Counts a share-code copy, at most once per browser per route. */
export async function recordCopy(routeId: string) {
  const jar = await cookies();
  const seen = (jar.get("bj_copied")?.value ?? "").split(".").filter(Boolean);
  if (seen.includes(routeId)) return;
  const res = await db
    .update(routes)
    .set({ copyCount: sql`${routes.copyCount} + 1` })
    .where(eq(routes.id, routeId))
    .returning({ id: routes.id });
  if (!res.length) return;
  jar.set("bj_copied", [...seen, routeId].slice(-200).join("."), {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signInWith(provider: string, callbackUrl: string, fd: FormData) {
  // Only same-site relative redirects.
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  if (provider === "dev") {
    await signIn("dev", { name: String(fd.get("name") ?? ""), redirectTo });
  } else {
    await signIn(provider, { redirectTo });
  }
}
