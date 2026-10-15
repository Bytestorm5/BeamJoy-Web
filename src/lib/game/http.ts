import "server-only";
import { isAccessDenied } from "@/lib/access";

/**
 * Responses for the game API (`/api/game/*` and the public JSON the mod reads). The mod calls it
 * from the game's UI (a Chromium page on the `local://` scheme), so every response allows any
 * origin. No cookies are involved: game requests authenticate with a bearer token.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  return Response.json(data, { ...init, headers });
}

export const fail = (status: number, error: string) => json({ error }, { status });

/** The preflight answer; route files export it as a plain (non-async) `OPTIONS`. */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

/** A denied gate as JSON: 401 when the game isn't linked, 403 otherwise. */
export function deniedResponse(e: unknown) {
  if (!isAccessDenied(e)) throw e;
  return e.reason === "unauthenticated"
    ? fail(401, "Link your account first.")
    : fail(403, "Your account can't do that.");
}

/** Parses a JSON body up to `maxBytes`, or null. */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
