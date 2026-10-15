// alfiz-verify-ignore-file authentication: starts a device sign-in for the game, nothing to authorize yet
import { cleanPlayerName, LINK_TTL_MS, POLL_INTERVAL_S, startLink } from "@/lib/game/link";
import { json, preflight, readJson } from "@/lib/game/http";

export function OPTIONS() {
  return preflight();
}

/** The mod's "Link account": a short code to approve on the site, and a secret to poll with. */
export async function POST(req: Request) {
  const body = (await readJson(req, 2_000)) as { playerName?: unknown } | null;
  const link = await startLink(cleanPlayerName(body?.playerName));
  const verifyUrl = new URL(`/link?code=${link.userCode}`, req.url).toString();
  return json({
    userCode: link.userCode,
    deviceCode: link.deviceCode,
    verifyUrl,
    expiresIn: LINK_TTL_MS / 1000,
    interval: POLL_INTERVAL_S,
  });
}
