import "server-only";
import { z } from "zod";
import { LIMITS, SURFACES, VANILLA_MAP_BY_LEVEL } from "./constants";
import { slugify } from "./format";

const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.url)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

const optionalUrl = z
  .string()
  .trim()
  .transform((s) => s || undefined)
  .pipe(httpUrl.optional());

const baseSchema = z.object({
  title: z.string().trim().min(3, "Give the route a name (3+ characters).").max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).default(""),
  surface: z.enum(SURFACES.map((s) => s.value) as [string, ...string[]]),
  tags: z
    .string()
    .default("")
    .transform((s) =>
      [
        ...new Set(
          s
            .split(/[,\n]/)
            .map((t) =>
              t
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9 -]/g, "")
                .replace(/\s+/g, "-")
                .slice(0, LIMITS.tagLength),
            )
            .filter(Boolean),
        ),
      ].slice(0, LIMITS.tags),
    ),
  videoUrl: optionalUrl,
  cornersOverride: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .pipe(z.number().int().min(0).max(999).nullable()),
  mapKind: z.enum(["vanilla", "custom"]),
  vanillaLevel: z.string().optional(),
  customMapName: z.string().trim().max(LIMITS.mapName).optional(),
  customMapUrl: z.string().trim().optional(),
});

export type RouteInput = z.infer<typeof baseSchema> & {
  mapKey: string;
  mapName: string;
  mapDownloadUrl: string | null;
};

export type FieldErrors = Partial<Record<string, string>>;

export function parseRouteForm(
  fd: FormData,
): { ok: true; data: RouteInput } | { ok: false; errors: FieldErrors } {
  const raw = Object.fromEntries(
    [
      "title",
      "description",
      "surface",
      "tags",
      "videoUrl",
      "cornersOverride",
      "mapKind",
      "vanillaLevel",
      "customMapName",
      "customMapUrl",
    ].map((k) => [k, (fd.get(k) as string | null) ?? ""]),
  );
  const parsed = baseSchema.safeParse(raw);
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const d = parsed.data;

  if (d.mapKind === "vanilla") {
    const name = d.vanillaLevel ? VANILLA_MAP_BY_LEVEL[d.vanillaLevel] : undefined;
    if (!name) return { ok: false, errors: { vanillaLevel: "Pick the map this route runs on." } };
    return {
      ok: true,
      data: { ...d, mapKey: d.vanillaLevel!, mapName: name, mapDownloadUrl: null },
    };
  }

  const name = d.customMapName ?? "";
  if (name.length < 2) errors.customMapName = "Enter the map's name.";
  const url = httpUrl.safeParse(d.customMapUrl ?? "");
  if (!url.success) errors.customMapUrl = "Link to where players can download the map (https://…).";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      ...d,
      mapKey: `custom:${slugify(name) || "map"}`,
      mapName: name,
      mapDownloadUrl: url.data!,
    },
  };
}
