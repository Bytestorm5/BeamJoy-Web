import "server-only";
import { checkImage, type ImageBytes } from "@/lib/route-write";

/** Images in game uploads arrive as base64 (the game's UI builds them from canvas JPEGs). */
export function decodeImage(raw: unknown, name: string): ImageBytes | { error: string } {
  const data = typeof raw === "string" ? raw.replace(/^data:[^,]*,/, "") : "";
  if (!data) return { error: `${name} is empty.` };
  let bytes: Uint8Array;
  try {
    const bin = atob(data);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return { error: `${name} isn't valid base64.` };
  }
  return checkImage(bytes, name);
}

/** World box an aerial shot covers: [minX, minY, maxX, maxY], at most 20 km across. */
export function parseBounds(raw: unknown): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  const [minX, minY, maxX, maxY] = raw as number[];
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 1 || h <= 1 || w > 20_000 || h > 20_000) return null;
  return [minX, minY, maxX, maxY];
}
