import { readUpload } from "@/lib/storage";

// Serves screenshots out of R2 (unless SCREENSHOTS_PUBLIC_URL points straight at the bucket).
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...key]">) {
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
