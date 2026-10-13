/**
 * Production import of BeamJoy-Revived's bundled races (scripts/lib/bundled-routes.mts), listed
 * under the BeamJoy-Revived account with no synthetic metrics. Writes a SQL file to apply with
 * wrangler:
 *
 *   npm run db:import-bundled -- ../BeamJoy-Revived bundled.sql
 *   npx wrangler d1 execute DB --remote --file bundled.sql
 *
 * Re-running is safe: a race already listed (same map and title under the BeamJoy-Revived
 * account) is skipped, so new upstream races can be added later. Slugs are picked as if the
 * database held no other routes, so a clash with a user's route fails the insert (UNIQUE)
 * rather than silently renaming.
 */
import { writeFileSync } from "node:fs";
import { getTableColumns, type Table } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { BUNDLED_AUTHOR, bundledRoutes } from "./lib/bundled-routes.mts";

const [repo, out] = process.argv.slice(2);
if (!repo || !out) {
  console.error("Usage: npm run db:import-bundled -- <BeamJoy-Revived checkout> <out.sql>");
  process.exit(1);
}

/** A SQL literal for a value already mapped to its driver form. */
function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replaceAll("'", "''")}'`;
}

/** Column names and SQL literals for the fields set on `row`, mapped the way drizzle would. */
function columnsOf(table: Table, row: Record<string, unknown>) {
  const cols = getTableColumns(table);
  const names: string[] = [];
  const values: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    const col = cols[key];
    if (!col) throw new Error(`Unknown column ${key}`);
    names.push(`"${col.name}"`);
    values.push(literal(value === null ? null : col.mapToDriverValue(value)));
  }
  return { names: names.join(", "), values: values.join(", ") };
}

const bundled = await bundledRoutes(repo);
const lines: string[] = [];
const author = columnsOf(schema.users, BUNDLED_AUTHOR);
lines.push(`INSERT OR IGNORE INTO "users" (${author.names}) VALUES (${author.values});`);
for (const { route, tags } of bundled) {
  const r = columnsOf(schema.routes, route);
  const same =
    `"author_id" = ${literal(route.authorId)} AND "map_key" = ${literal(route.mapKey)} ` +
    `AND "title" = ${literal(route.title)}`;
  lines.push(
    `INSERT INTO "routes" (${r.names}) SELECT ${r.values} WHERE NOT EXISTS (SELECT 1 FROM "routes" WHERE ${same});`,
  );
  for (const tag of tags) {
    lines.push(`INSERT OR IGNORE INTO "route_tags" ("route_id", "tag") SELECT "id", ${literal(tag)} FROM "routes" WHERE ${same};`);
  }
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${bundled.length} routes to ${out}.`);
