// alfiz-verify-ignore-file authentication: the game exchanging an approved link code for its token
import { pollLink } from "@/lib/game/link";
import { fail, json, preflight, readJson } from "@/lib/game/http";

export function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  const body = (await readJson(req, 2_000)) as { deviceCode?: unknown } | null;
  const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!deviceCode || deviceCode.length > 100) return fail(400, "Missing device code.");
  const result = await pollLink(deviceCode);
  return json(result, { status: result.status === "expired" ? 410 : 200 });
}
