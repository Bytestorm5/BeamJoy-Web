import { requireCreateRoute } from "@/lib/access";
import { LIMITS } from "@/lib/constants";
import { gameViewer } from "@/lib/game/auth";
import { parseLevel } from "@/lib/game/course";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { decodeImage, parseBounds } from "@/lib/game/images";
import { vanillaMapByLevel } from "@/lib/maps";
import { routePath } from "@/lib/paths";
import { parseRouteForm } from "@/lib/route-input";
import { analyzeCode, insertRoute, type ImageBytes } from "@/lib/route-write";

export function OPTIONS() {
  return preflight();
}

/** Screenshots arrive downscaled (about 1600 px JPEG), so 8 of them plus an aerial fit easily. */
const MAX_BODY = 30 * 1024 * 1024;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Publishes a race straight from the game: the share code plus everything the site's form asks
 * for. Validated exactly like the form (same parser, same limits); the map comes from the level
 * the game is on.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireCreateRoute(await gameViewer(req));
  } catch (e) {
    return deniedResponse(e);
  }
  const body = (await readJson(req, MAX_BODY)) as Record<string, unknown> | null;
  if (!body) return fail(413, "Upload is too large or not JSON.");

  const code = await analyzeCode(str(body.shareCode));
  if (!code.ok) return json({ errors: { shareCode: code.message } }, { status: 400 });

  const level = parseLevel(body.level);
  if (!level) return json({ errors: { map: "The game didn't say which map this is." } }, { status: 400 });
  const vanilla = vanillaMapByLevel(level);

  const fd = new FormData();
  fd.set("title", str(body.title));
  fd.set("description", str(body.description));
  fd.set("surface", str(body.surface) || "asphalt");
  fd.set("tags", Array.isArray(body.tags) ? body.tags.map(str).join(",") : str(body.tags));
  fd.set("videoUrl", str(body.videoUrl));
  fd.set("cornersOverride", typeof body.cornersOverride === "number" ? String(body.cornersOverride) : "");
  fd.set("mapKind", vanilla ? "vanilla" : "custom");
  fd.set("vanillaMap", vanilla?.slug ?? "");
  fd.set("customMapName", str(body.mapName) || level);
  fd.set("customMapUrl", str(body.mapDownloadUrl));
  const input = parseRouteForm(fd);
  if (!input.ok) return json({ errors: input.errors }, { status: 400 });

  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length > LIMITS.images) return json({ errors: { images: `Up to ${LIMITS.images} screenshots.` } }, { status: 400 });
  const images: ImageBytes[] = [];
  for (const [i, raw] of rawImages.entries()) {
    const img = decodeImage(raw, `Screenshot ${i + 1}`);
    if ("error" in img) return json({ errors: { images: img.error } }, { status: 400 });
    images.push(img);
  }

  let aerial = null;
  if (body.aerial && typeof body.aerial === "object") {
    const a = body.aerial as Record<string, unknown>;
    const image = decodeImage(a.data, "Aerial");
    const bounds = parseBounds(a.bounds);
    if ("error" in image || !bounds) return json({ errors: { aerial: "The aerial shot didn't come through." } }, { status: 400 });
    aerial = { image, bounds };
  }

  const slug = await insertRoute({
    authorId: user.id,
    decoded: code.decoded,
    analysis: code.analysis,
    input: input.data,
    images,
    levelId: level,
    aerial,
  });
  return json({ slug, url: new URL(routePath(slug), req.url).toString() }, { status: 201 });
}
