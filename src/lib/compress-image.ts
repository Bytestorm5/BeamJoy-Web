/**
 * Downscale a screenshot in the browser before upload. Game screenshots are often 4K PNGs
 * (10+ MB); a 1920px WebP is visually the same in a gallery at a fraction of the size, and it
 * keeps the whole submission under hosting request-size limits.
 */
const MAX_EDGE = 1920;

export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Not decodable here; let the server validate it.
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await encode("image/webp", 0.85);
  // Browsers that can't encode WebP silently hand back PNG; JPEG is the smaller fallback.
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", 0.85);
  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], file.name.replace(/\.\w+$/, "") + `.${ext}`, { type: blob.type });
}
