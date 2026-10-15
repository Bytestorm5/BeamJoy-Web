import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUpdateRoute } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { decodeImage, parseBounds } from "@/lib/game/images";
import { deleteImages, storeImage } from "@/lib/storage";

export function OPTIONS() {
  return preflight();
}

/** Replaces a route's aerial shot (the top-down photo under its map). Author or moderator. */
export async function POST(req: Request, ctx: RouteContext<"/api/game/routes/[slug]/aerial">) {
  const { slug } = await ctx.params;
  const db = getDb();
  const [route] = await db
    .select({ id: schema.routes.id, authorId: schema.routes.authorId, aerialKey: schema.routes.aerialKey })
    .from(schema.routes)
    .where(eq(schema.routes.slug, slug))
    .limit(1);
  if (!route) return fail(404, "Route not found.");
  try {
    await requireUpdateRoute(await gameViewer(req), route);
  } catch (e) {
    return deniedResponse(e);
  }
  const body = (await readJson(req, 8 * 1024 * 1024)) as Record<string, unknown> | null;
  const image = decodeImage(body?.data, "Aerial");
  const bounds = parseBounds(body?.bounds);
  if ("error" in image) return fail(400, image.error);
  if (!bounds) return fail(400, "Missing the area the shot covers.");

  const stored = await storeImage(image.bytes, image.type);
  await db
    .update(schema.routes)
    .set({ aerialUrl: stored.url, aerialKey: stored.storageKey, aerialBounds: JSON.stringify(bounds), updatedAt: new Date() })
    .where(eq(schema.routes.id, route.id));
  if (route.aerialKey) await deleteImages([route.aerialKey]);
  return json({ ok: true });
}
