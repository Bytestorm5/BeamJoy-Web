import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireWithdrawTime } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { parseRun } from "@/lib/lap-rules";
import { withdrawRun } from "@/lib/leaderboard";

export function OPTIONS() {
  return preflight();
}

/**
 * The game takes back a run's laps (`{ route: slug, run }`): the race disqualified the driver
 * after they were posted. Their records on the route go back to before that run.
 */
export async function POST(req: Request) {
  const viewer = await gameViewer(req);
  const body = (await readJson(req, 2_000)) as Record<string, unknown> | null;
  const slug = typeof body?.route === "string" ? body.route : "";
  const run = parseRun(body?.run, 1)?.run;
  if (!slug || !run) return fail(400, "Send the route and the run.");
  const [route] = await getDb()
    .select({ id: schema.routes.id, authorId: schema.routes.authorId })
    .from(schema.routes)
    .where(eq(schema.routes.slug, slug))
    .limit(1);
  if (!route) return fail(404, "Route not found.");

  let user;
  try {
    user = await requireWithdrawTime(viewer, route);
  } catch (e) {
    return deniedResponse(e);
  }
  return json({ withdrawn: await withdrawRun(route.id, user.id, run) });
}
