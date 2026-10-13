/**
 * Every public URL in the app. Pages are addressed by slug, never by database id: ids stay on the
 * server, and slugs are readable and stable (see freeSlug in lib/queries.ts).
 */
export const routePath = (slug: string) => `/routes/${slug}`;
export const mapPath = (slug: string) => `/maps/${slug}`;
export const userPath = (slug: string) => `/u/${slug}`;
