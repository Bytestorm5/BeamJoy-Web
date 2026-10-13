import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * The request's D1 database. Bindings only exist inside a request on Workers (and in `next dev`
 * via initOpenNextCloudflareForDev), so this is called per use rather than held in a module global.
 */
export function getDb() {
  return drizzle(getCloudflareContext().env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
