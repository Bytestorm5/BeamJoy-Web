import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { nanoid } from "nanoid";

/**
 * Route screenshots live under `screenshots/` in the site's general STORAGE R2 bucket and are
 * served by app/uploads/[...key]/route.ts. Set STORAGE_PUBLIC_URL (an r2.dev or custom domain on
 * that bucket) to link to R2 directly instead of going through the Worker.
 */
const bucket = () => getCloudflareContext().env.STORAGE;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Sniff the real type from magic bytes; never trust the browser-supplied MIME type. */
export function sniffImageType(buf: Uint8Array): string | null {
  const at = (i: number, bytes: number[]) => bytes.every((b, k) => buf[i + k] === b);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (at(4, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])) return "image/avif";
  return null;
}

function publicUrl(key: string) {
  const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : `/uploads/${key}`;
}

export async function storeImage(
  routeId: string,
  bytes: Uint8Array,
  type: string,
): Promise<{ url: string; storageKey: string }> {
  const key = `screenshots/${routeId}/${nanoid(12)}.${IMAGE_TYPES[type]}`;
  await bucket().put(key, bytes, {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return { url: publicUrl(key), storageKey: key };
}

export async function deleteImages(storageKeys: string[]) {
  if (storageKeys.length) await bucket().delete(storageKeys);
}

export async function readUpload(key: string) {
  // Only screenshot keys are publicly readable; anything else in the bucket stays private.
  if (!/^screenshots\/[\w-]+\/[\w-]+\.(jpg|png|webp|avif)$/.test(key)) return null;
  return bucket().get(key);
}
