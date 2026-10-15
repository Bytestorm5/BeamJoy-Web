import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import { newToken, randomSecret, sha256 } from "./auth";

/**
 * Linking the game, device-code style (like signing in on a TV): the mod asks for a link, shows
 * the short code and opens /link?code=…, the player approves it while signed in, and the mod's
 * poll then receives a token. Nothing to type in game, no password anywhere near it.
 */

export const LINK_TTL_MS = 10 * 60_000;
export const POLL_INTERVAL_S = 3;

/** No 0/O, 1/I/L: the code is read off one screen and typed into another. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function userCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Accepts codes typed in lower case, without the dash, or with spaces. */
export function normalizeUserCode(raw: string) {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : null;
}

export const cleanPlayerName = (v: unknown) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) : "";

export async function startLink(playerName: string) {
  const db = getDb();
  await db.delete(schema.gameLinks).where(lt(schema.gameLinks.expiresAt, new Date()));
  const deviceCode = randomSecret();
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  // A clash on the 8-char code is astronomically unlikely, but retry rather than fail on one.
  for (let attempt = 0; ; attempt++) {
    const code = userCode();
    try {
      await db.insert(schema.gameLinks).values({
        deviceHash: await sha256(deviceCode),
        userCode: code,
        playerName,
        expiresAt,
      });
      return { userCode: code, deviceCode, expiresAt };
    } catch (e) {
      if (attempt >= 3) throw e;
    }
  }
}

export async function pendingLink(code: string) {
  const [row] = await getDb()
    .select({ playerName: schema.gameLinks.playerName, approvedBy: schema.gameLinks.approvedBy })
    .from(schema.gameLinks)
    .where(and(eq(schema.gameLinks.userCode, code), gt(schema.gameLinks.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** Approves a code for `userId`. False when the code is unknown, expired or already used. */
export async function approveLink(code: string, userId: string) {
  const rows = await getDb()
    .update(schema.gameLinks)
    .set({ approvedBy: userId })
    .where(
      and(
        eq(schema.gameLinks.userCode, code),
        gt(schema.gameLinks.expiresAt, new Date()),
        isNull(schema.gameLinks.approvedBy),
      ),
    )
    .returning({ code: schema.gameLinks.userCode });
  return rows.length > 0;
}

export type PollResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "linked"; token: string; user: { name: string; slug: string } };

/** The mod's poll. Once approved, mints the token and consumes the link: it works once. */
export async function pollLink(deviceCode: string): Promise<PollResult> {
  const db = getDb();
  const deviceHash = await sha256(deviceCode);
  const [row] = await db
    .select()
    .from(schema.gameLinks)
    .where(eq(schema.gameLinks.deviceHash, deviceHash))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (!row.approvedBy) return { status: "pending" };

  // Claim the link first, so two racing polls can't both mint a token.
  const claimed = await db
    .delete(schema.gameLinks)
    .where(eq(schema.gameLinks.deviceHash, deviceHash))
    .returning({ userId: schema.gameLinks.approvedBy });
  const userId = claimed[0]?.userId;
  if (!userId) return { status: "expired" };

  const token = newToken();
  await db.insert(schema.gameTokens).values({
    id: nanoid(12),
    userId,
    tokenHash: await sha256(token),
    playerName: row.playerName,
  });
  const [user] = await db
    .select({ name: schema.users.name, slug: schema.users.slug })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return { status: "linked", token, user: user ?? { name: "", slug: "" } };
}
