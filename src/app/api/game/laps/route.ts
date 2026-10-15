import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSubmitTime } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { cleanPlayerName } from "@/lib/game/link";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { checkLap, cleanSectors, recordLap } from "@/lib/leaderboard";

export function OPTIONS() {
  return preflight();
}

/** One completed lap from the game: `{ route: slug, lapMs, sectors?, vehicle?, playerName? }`. */
export async function POST(req: Request) {
  const viewer = await gameViewer(req);
  const body = (await readJson(req, 10_000)) as Record<string, unknown> | null;
  const slug = typeof body?.route === "string" ? body.route : "";
  if (!slug) return fail(400, "Which route?");
  const [route] = await getDb()
    .select({
      id: schema.routes.id,
      authorId: schema.routes.authorId,
      distanceM: schema.routes.distanceM,
      sectors: schema.routes.sectors,
    })
    .from(schema.routes)
    .where(eq(schema.routes.slug, slug))
    .limit(1);
  if (!route) return fail(404, "Route not found.");

  let user;
  try {
    user = await requireSubmitTime(viewer, route);
  } catch (e) {
    return deniedResponse(e);
  }

  const lapMs = typeof body?.lapMs === "number" ? Math.round(body.lapMs) : NaN;
  const lap = {
    lapMs,
    sectors: cleanSectors(route, lapMs, body?.sectors),
    vehicle: typeof body?.vehicle === "string" ? body.vehicle.slice(0, 64) : "",
    playerName: cleanPlayerName(body?.playerName),
  };
  const problem = checkLap(route, lap);
  if (problem) return fail(422, problem);

  const result = await recordLap(route, user.id, lap);
  if (result === "too-soon") return fail(429, "Already got that lap.");
  return json(result);
}
