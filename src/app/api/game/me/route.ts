import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireReadAccount, requireUnlinkGame } from "@/lib/access";
import { bearerHash, gameViewer } from "@/lib/game/auth";
import { deniedResponse, json, preflight } from "@/lib/game/http";
import { userPath } from "@/lib/paths";

export function OPTIONS() {
  return preflight();
}

/** Which account the game's token belongs to (the mod's account panel). */
export async function GET(req: Request) {
  const viewer = await gameViewer(req);
  try {
    const user = await requireReadAccount(viewer);
    return json({ user: { name: user.name, slug: user.slug, url: new URL(userPath(user.slug), req.url).toString() } });
  } catch (e) {
    return deniedResponse(e);
  }
}

/** The mod's "Unlink": revokes the token the request carries. */
export async function DELETE(req: Request) {
  const viewer = await gameViewer(req);
  try {
    await requireUnlinkGame(viewer, { userId: viewer.user?.id ?? "" });
  } catch (e) {
    return deniedResponse(e);
  }
  const hash = await bearerHash(req);
  if (hash) await getDb().delete(schema.gameTokens).where(eq(schema.gameTokens.tokenHash, hash));
  return json({ ok: true });
}
