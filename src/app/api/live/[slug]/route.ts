import { getViewer, requireReadLive } from "@/lib/access";
import { deniedResponse, fail, json } from "@/lib/game/http";
import { getLive } from "@/lib/live";

/** Polled by the live session page. */
export async function GET(_req: Request, ctx: RouteContext<"/api/live/[slug]">) {
  try {
    await requireReadLive(await getViewer());
  } catch (e) {
    return deniedResponse(e);
  }
  const session = await getLive((await ctx.params).slug);
  if (!session) return fail(404, "No such session.");
  return json(session);
}
