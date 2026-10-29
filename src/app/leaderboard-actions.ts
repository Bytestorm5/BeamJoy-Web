"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getViewer, requireModerateTimes } from "@/lib/access";
import { parseStart } from "@/lib/lap-rules";
import { leaderboardPath, routePath } from "@/lib/paths";

/** Moderation: takes a driver's time off one of a route's leaderboards (standing or flying). */
export async function removeTime(routeSlug: string, userSlug: string, start: string) {
  const board = parseStart(start);
  if (!board) return;
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
    .where(
      and(
        eq(schema.routeRecords.routeId, route.id),
        eq(schema.routeRecords.userId, user.id),
        eq(schema.routeRecords.start, board),
      ),
    );
  revalidatePath(leaderboardPath(routeSlug));
  revalidatePath(routePath(routeSlug));
}
