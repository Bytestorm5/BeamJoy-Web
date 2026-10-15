"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getViewer, requireModerateTimes } from "@/lib/access";
import { leaderboardPath, routePath } from "@/lib/paths";

/** Moderation: takes a driver's time off a route's leaderboard. */
export async function removeTime(routeSlug: string, userSlug: string) {
  const db = getDb();
  const [route] = await db
    .select({ id: schema.routes.id, authorId: schema.routes.authorId })
    .from(schema.routes)
    .where(eq(schema.routes.slug, routeSlug))
    .limit(1);
  if (!route) return;
  await requireModerateTimes(await getViewer(), route);
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.slug, userSlug)).limit(1);
  if (!user) return;
  await db
    .delete(schema.routeRecords)
    .where(and(eq(schema.routeRecords.routeId, route.id), eq(schema.routeRecords.userId, user.id)));
  revalidatePath(leaderboardPath(routeSlug));
  revalidatePath(routePath(routeSlug));
}
