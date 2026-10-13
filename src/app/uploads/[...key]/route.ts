import { getViewer, isAccessDenied, requireReadRoutes } from "@/lib/access";
import { readUpload } from "@/lib/storage";

// Serves screenshots out of R2 (unless STORAGE_PUBLIC_URL points straight at the bucket).
// Screenshots are route content, so they follow the same read permission as route pages.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...key]">) {
  try {
    await requireReadRoutes(await getViewer());
  } catch (e) {
    if (isAccessDenied(e)) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { key } = await ctx.params;
  const obj = await readUpload(key.join("/"));
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  // Keys are random and never rewritten, so the bytes behind a URL never change.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { headers });
}
