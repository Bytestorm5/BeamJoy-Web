import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Viewer } from "@/lib/access";

/**
 * Game tokens: how the BeamJoy-Revived-Live mod acts for a site account. A token is minted when
 * a link code is approved (see lib/game/link.ts) and sent as `Authorization: Bearer bjl_…`.
 * Only its SHA-256 is stored, so a database leak doesn't leak working tokens.
 */

const TOKEN_PREFIX = "bjl_";

function base64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomSecret(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const newToken = () => TOKEN_PREFIX + randomSecret();

/** Don't write `last_used_at` on every lap: once every few minutes is plenty. */
const TOUCH_EVERY_MS = 5 * 60_000;

/**
 * The account a game request acts for, as a Viewer the access gates understand. Signed out
 * (principal `anonymous`) when the token is missing, malformed or revoked.
 */
/** SHA-256 of the request's bearer token, or null when it carries none. */
export async function bearerHash(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) return null;
  return sha256(token);
}

export async function gameViewer(req: Request): Promise<Viewer> {
  const anonymous: Viewer = { user: null, principal: { userId: "anonymous" } };
  const hash = await bearerHash(req);
  if (!hash) return anonymous;

  const db = getDb();
  const [row] = await db
    .select({
      id: schema.gameTokens.id,
      lastUsedAt: schema.gameTokens.lastUsedAt,
      user: { id: schema.users.id, slug: schema.users.slug, name: schema.users.name, image: schema.users.image },
    })
    .from(schema.gameTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.gameTokens.userId))
    .where(eq(schema.gameTokens.tokenHash, hash))
    .limit(1);
  if (!row) return anonymous;

  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db
      .update(schema.gameTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(
        and(
          eq(schema.gameTokens.id, row.id),
          or(isNull(schema.gameTokens.lastUsedAt), lt(schema.gameTokens.lastUsedAt, new Date(now - TOUCH_EVERY_MS))),
        ),
      );
  }
  return { user: { ...row.user, email: null }, principal: { userId: row.user.id } };
}

