import { requireUploadRoads } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { parseLevel } from "@/lib/game/course";
import { deniedResponse, fail, json, preflight } from "@/lib/game/http";
import { gunzipLimited, gzipText, MAX_ROADS_BYTES, saveRoads, validateRoads } from "@/lib/roads";

export function OPTIONS() {
  return preflight();
}

/**
 * A level's road map from the game, gzipped (`Content-Type: application/gzip`) or plain JSON.
 * The first upload for a level wins; later ones are acknowledged and dropped.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/game/levels/[level]/roads">) {
  let user;
  try {
    user = await requireUploadRoads(await gameViewer(req));
  } catch (e) {
    return deniedResponse(e);
  }
  const level = parseLevel((await ctx.params).level);
  if (!level) return fail(400, "Unknown level.");

  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.byteLength > MAX_ROADS_BYTES) return fail(413, "Road map is too big.");
  const gzipped = raw[0] === 0x1f && raw[1] === 0x8b;
  const text = gzipped ? await gunzipLimited(raw, MAX_ROADS_BYTES) : new TextDecoder().decode(raw);
  if (text == null) return fail(400, "Couldn't unpack the road map.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(400, "Road map isn't JSON.");
  }
  const map = validateRoads(parsed);
  if (typeof map === "string") return fail(400, map);
  const saved = await saveRoads(level, map, gzipped ? raw : await gzipText(text), user.id);
  return json({ saved }, { status: saved ? 201 : 200 });
}
