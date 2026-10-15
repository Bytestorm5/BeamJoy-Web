import { getViewer, requireReadMaps } from "@/lib/access";
import { parseLevel } from "@/lib/game/course";
import { deniedResponse, fail } from "@/lib/game/http";
import { readRoads } from "@/lib/roads";

/** A level's road map for the site's maps. Rarely changes, so browsers and the CDN keep it a day. */
export async function GET(_req: Request, ctx: RouteContext<"/api/levels/[level]/roads">) {
  try {
    await requireReadMaps(await getViewer());
  } catch (e) {
    return deniedResponse(e);
  }
  const level = parseLevel((await ctx.params).level);
  if (!level) return fail(400, "Unknown level.");
  const body = await readRoads(level);
  if (!body) return fail(404, "No road map for this level yet.");
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
