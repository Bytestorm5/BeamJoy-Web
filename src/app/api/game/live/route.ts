import { requirePublishLive } from "@/lib/access";
import { gameViewer } from "@/lib/game/auth";
import { parseLevel } from "@/lib/game/course";
import { deniedResponse, fail, json, preflight, readJson } from "@/lib/game/http";
import { livePath } from "@/lib/paths";
import { parsePlayers, saveLiveReport, validServerKey } from "@/lib/live";

export function OPTIONS() {
  return preflight();
}

/** A server's current player list, from the one game its BeamJoy Live plugin picked to report. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requirePublishLive(await gameViewer(req));
  } catch (e) {
    return deniedResponse(e);
  }
  const body = (await readJson(req, 100_000)) as Record<string, unknown> | null;
  const level = parseLevel(body?.level);
  const players = parsePlayers(body?.players);
  const serverName = typeof body?.serverName === "string" ? body.serverName.trim().slice(0, 80) : "";
  if (!validServerKey(body?.serverKey) || !level || !players || !serverName) return fail(400, "Malformed session.");
  const slug = await saveLiveReport(
    {
      serverKey: body.serverKey,
      serverName,
      level,
      mapName: typeof body?.mapName === "string" ? body.mapName.slice(0, 80) : "",
      players,
    },
    user.id,
  );
  return json({ slug, url: new URL(livePath(slug), req.url).toString() });
}
