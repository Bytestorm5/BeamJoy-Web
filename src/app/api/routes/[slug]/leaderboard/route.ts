import { getRouteRef } from "@/lib/queries";
import { requireReadRoutes } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { deniedResponse, fail, json, preflight } from "@/lib/game/http";
import { leaderboard, parseSort } from "@/lib/leaderboard";

export function OPTIONS() {
  return preflight();
}

/** A page of a route's leaderboard, polled by the leaderboard page and by the game. */
export async function GET(req: Request, ctx: RouteContext<"/api/routes/[slug]/leaderboard">) {
  try {
    await requireReadRoutes(await gameViewer(req));
  } catch (e) {
    return deniedResponse(e);
  }
  const route = await getRouteRef((await ctx.params).slug);
  if (!route) return fail(404, "Route not found.");
  const url = new URL(req.url);
  const page = Math.max(1, Math.min(1000, Math.floor(Number(url.searchParams.get("page")) || 1)));
  const size = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get("size")) || 25)));
  const board = await leaderboard(route.id, parseSort(url.searchParams.get("sort")), page, size);
  return json({ route: { slug: route.slug, title: route.title, sectors: route.sectors }, ...board });
}
