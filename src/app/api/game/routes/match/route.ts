import { requireReadRoutes } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { findCourse, parseGates, parseLevel } from "@/lib/game/course";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { routePath } from "@/lib/paths";

export function OPTIONS() {
  return preflight();
}

/** Is this race (by its gates) on the site? Linked or not, the game may ask. */
export async function POST(req: Request) {
  const viewer = await gameViewer(req);
  try {
    await requireReadRoutes(viewer);
  } catch (e) {
    return deniedResponse(e);
  }
  const body = (await readJson(req, 200_000)) as Record<string, unknown> | null;
  const level = parseLevel(body?.level);
  const gates = parseGates(body?.gates);
  if (!level || !gates) return fail(400, "Send the level and the race's gates.");
  const route = await findCourse({
    level,
    gates,
    loopable: body?.loopable === true,
    mapName: typeof body?.mapName === "string" ? body.mapName.slice(0, 80) : undefined,
  });
  if (!route) return json({ route: null });
  return json({
    route: {
      slug: route.slug,
      title: route.title,
      sectors: route.sectors,
      url: new URL(routePath(route.slug), req.url).toString(),
      mine: !!viewer.user && viewer.user.id === route.authorId,
    },
  });
}
