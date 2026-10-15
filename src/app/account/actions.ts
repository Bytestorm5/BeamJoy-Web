"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getViewer, requireUnlinkGame } from "@/lib/access";

/**
 * Unlinks one of the viewer's games. Takes the link's random id: a linked game has no public
 * page or slug, and the id is only ever shown to its owner.
 */
export async function unlinkGame(id: string) {
  if (typeof id !== "string" || id.length > 40) return;
  const db = getDb();
  const [link] = await db
    .select({ userId: schema.gameTokens.userId })
    .from(schema.gameTokens)
    .where(eq(schema.gameTokens.id, id))
    .limit(1);
  if (!link) return;
  await requireUnlinkGame(await getViewer(), link);
  await db.delete(schema.gameTokens).where(eq(schema.gameTokens.id, id));
  revalidatePath("/account");
}
