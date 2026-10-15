import "server-only";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import { LIMITS } from "@/lib/constants";
import { freeSlug } from "@/lib/queries";
import type { RouteInput } from "@/lib/route-input";
import { analyzeRace } from "@/lib/sharecode/analyze";
import { decodeShareCode, ShareCodeError, type DecodedShareCode } from "@/lib/sharecode/codec";
import { deleteImages, sniffImageType, storeImage } from "@/lib/storage";

/** Writing routes: shared by the site's form (app/actions.ts) and the game's upload API. */

const { routes, routeImages, routeTags } = schema;

export async function analyzeCode(code: string) {
  try {
    const decoded = await decodeShareCode(code);
    return { ok: true as const, decoded, analysis: analyzeRace(decoded.payload) };
  } catch (e) {
    const message = e instanceof ShareCodeError ? e.message : "Invalid share code.";
    return { ok: false as const, message };
  }
}

export function statColumns(analysis: ReturnType<typeof analyzeRace>, cornersOverride: number | null) {
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
    propCount: s.props,
    geometry: JSON.stringify(analysis.geometry),
  };
}

export type ImageBytes = { bytes: Uint8Array; type: string };

/** Checks raw image bytes against the screenshot limits; the type comes from the bytes. */
export function checkImage(bytes: Uint8Array, name: string): ImageBytes | { error: string } {
  if (bytes.byteLength > LIMITS.imageBytes) return { error: `"${name}" is over 5 MB.` };
  const type = sniffImageType(bytes);
  if (!type) return { error: `"${name}" isn’t a supported image.` };
  return { bytes, type };
}

export type NewRoute = {
  authorId: string;
  decoded: DecodedShareCode;
  analysis: ReturnType<typeof analyzeRace>;
  input: RouteInput;
  images: ImageBytes[];
  levelId?: string | null;
  aerial?: { image: ImageBytes; bounds: [number, number, number, number] } | null;
};

/** Stores the images, then inserts the route, its tags and images in one batch. Returns the slug. */
export async function insertRoute(r: NewRoute) {
  const id = nanoid(10);
  const d = r.input;
  // Upload first so the rows can reference the stored files in one atomic batch.
  const [slug, stored, aerial] = await Promise.all([
    freeSlug(routes.slug, d.title, "route"),
    Promise.all(r.images.map((img) => storeImage(img.bytes, img.type))),
    r.aerial ? storeImage(r.aerial.image.bytes, r.aerial.image.type) : null,
  ]);
  const db = getDb();
  try {
    await db.batch([
      db.insert(routes).values({
        id,
        slug,
        title: d.title,
        description: d.description,
        authorId: r.authorId,
        activityType: r.decoded.type,
        shareCode: r.decoded.code,
        mapKind: d.mapKind,
        mapKey: d.mapKey,
        mapName: d.mapName,
        mapDownloadUrl: d.mapDownloadUrl,
        surface: d.surface,
        videoUrl: d.videoUrl ?? null,
        coverUrl: stored[0]?.url ?? null,
        levelId: r.levelId ?? null,
        aerialUrl: aerial?.url ?? null,
        aerialKey: aerial?.storageKey ?? null,
        aerialBounds: aerial && r.aerial ? JSON.stringify(r.aerial.bounds) : null,
        ...statColumns(r.analysis, d.cornersOverride),
      }),
      ...d.tags.map((tag) => db.insert(routeTags).values({ routeId: id, tag })),
      ...stored.map((s, i) =>
        db.insert(routeImages).values({ id: nanoid(12), routeId: id, url: s.url, storageKey: s.storageKey, position: i }),
      ),
    ]);
  } catch (e) {
    await deleteImages([...stored.map((s) => s.storageKey), ...(aerial ? [aerial.storageKey] : [])]);
    throw e;
  }
  return slug;
}
