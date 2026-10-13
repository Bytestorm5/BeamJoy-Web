import { VANILLA_MAPS } from "./constants";
import { slugify } from "./format";

/**
 * Map identity. Every route stores its map's slug (`routes.map_key`), which is also the public URL
 * key: /maps/<slug> and the catalog's `?map=<slug>`. Base-game maps have fixed slugs; a mod map's
 * slug comes from its name, so routes that name the same map group together.
 */

const BY_SLUG = new Map<string, (typeof VANILLA_MAPS)[number]>(VANILLA_MAPS.map((m) => [m.slug, m]));
const BY_LEVEL = new Map<string, (typeof VANILLA_MAPS)[number]>(VANILLA_MAPS.map((m) => [m.level, m]));

export const vanillaMapBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;
export const vanillaMapByLevel = (level: string) => BY_LEVEL.get(level) ?? null;

/** Slug for a mod map name; never collides with a base-game map. */
export function modMapSlug(name: string) {
  const s = slugify(name) || "map";
  return BY_SLUG.has(s) ? `${s}-mod` : s;
}

export const mapPath = (slug: string) => `/maps/${slug}`;
export const routePath = (slug: string) => `/routes/${slug}`;
