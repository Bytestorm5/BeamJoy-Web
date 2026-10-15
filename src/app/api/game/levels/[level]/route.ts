import { requireReadMaps } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { parseLevel } from "@/lib/game/course";
import { deniedResponse, fail, json, preflight } from "@/lib/game/http";
import { hasRoads } from "@/lib/roads";

export function OPTIONS() {
  return preflight();
}

/** What the site has for a level, so the game only uploads what's missing. */
export async function GET(req: Request, ctx: RouteContext<"/api/game/levels/[level]">) {
  try {
    await requireReadMaps(await gameViewer(req));
  } catch (e) {
    return deniedResponse(e);
  }
  const level = parseLevel((await ctx.params).level);
  if (!level) return fail(400, "Unknown level.");
  return json({ level, roads: await hasRoads(level) });
}
