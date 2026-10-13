import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { nanoid } from "nanoid";

/**
 * Screenshot storage. With BLOB_READ_WRITE_TOKEN set, files go to Vercel Blob (what a Vercel
 * deployment needs, since its filesystem is read-only); otherwise they're written to
 * UPLOAD_DIR (default `.data/uploads`) and served by app/uploads/[...key]/route.ts.
 */
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? ".data/uploads");

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

export async function storeImage(
  routeId: string,
  bytes: Uint8Array,
  type: string,
): Promise<{ url: string; storageKey: string }> {
  const key = `routes/${routeId}/${nanoid(12)}.${IMAGE_TYPES[type]}`;
  if (useBlob) {
    const blob = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      addRandomSuffix: false,
    });
    return { url: blob.url, storageKey: blob.url };
  }
  const file = path.join(/*turbopackIgnore: true*/ uploadDir, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { url: `/uploads/${key}`, storageKey: key };
}

export async function deleteImage(storageKey: string) {
  try {
    if (storageKey.startsWith("https://")) await del(storageKey);
    else await unlink(resolveLocal(storageKey));
  } catch {
    // Already gone: nothing to clean up.
  }
}

function resolveLocal(key: string) {
  const file = path.resolve(/*turbopackIgnore: true*/ uploadDir, key);
  if (!file.startsWith(uploadDir + path.sep)) throw new Error("Invalid upload path");
  return file;
}

export async function readLocalUpload(key: string) {
  const file = resolveLocal(key);
  const ext = path.extname(file).slice(1);
  const type = Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)?.[0];
  if (!type) return null;
  try {
    return { bytes: await readFile(/*turbopackIgnore: true*/ file), type };
  } catch {
    return null;
  }
}
