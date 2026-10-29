/**
 * Production import of BeamJoy-Revived's bundled races (scripts/lib/bundled-routes.mts), listed
 * under the BeamJoy-Revived account with no synthetic metrics. Reads the routes the database has
 * now and writes a SQL file to apply with wrangler:
 *
 *   npx wrangler d1 execute DB --remote --json --command "$(npm run -s db:import-bundled -- --query)" > existing.json
 *   npm run db:import-bundled -- ../BeamJoy-Revived bundled.sql existing.json
 *   npx wrangler d1 execute DB --remote --file bundled.sql
 *
 * Bundled races are matched to listed ones by course (the same gates, as the game's laps are), so
 * a race renamed upstream keeps its route: its title, share code (props, pit lane), stats and,
 * unless a moderator rewrote it, description are updated. Its id, slug and times stay. A race
 * whose course changed upstream gets a new route; the old course keeps its own, with its times
 * and a note. Re-running only changes what changed. Without existing.json (an empty database),
 * every race is added.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getTableColumns, type Table } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { sameCourse, type RouteGeometry } from "../src/lib/sharecode/analyze.ts";
import {
  allocateSlug,
  BUNDLED_AUTHOR,
  BUNDLED_DESCRIPTION_PREFIX,
  bundledRoutes,
  type BundledRoute,
} from "./lib/bundled-routes.mts";

/** What the import needs to know about the routes listed now (geometry: bundled ones only). */
const EXISTING_QUERY =
  `SELECT "id", "slug", "author_id", "title", "description", "map_key", "loopable", ` +
  `CASE WHEN "author_id" = '${BUNDLED_AUTHOR.id}' THEN "geometry" END AS "geometry" FROM "routes"`;

/** Not overwritten on a listed route: a moderator may have set them. */
const KEPT_COLUMNS = new Set(["id", "slug", "authorId", "description", "surface", "corners", "createdAt"]);

const OLD_COURSE_NOTE = `${BUNDLED_DESCRIPTION_PREFIX} Its course has changed since; this is the older one.`;

type Existing = {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  description: string;
  map_key: string;
  loopable: number;
  geometry: string | null;
};

if (process.argv[2] === "--query") {
  console.log(EXISTING_QUERY);
  process.exit(0);
}

const [repo, out, existingFile] = process.argv.slice(2);
if (!repo || !out) {
  console.error("Usage: npm run db:import-bundled -- <BeamJoy-Revived checkout> <out.sql> [existing.json]");
  process.exit(1);
}

/** Rows from `wrangler d1 execute --json` (an array of statement results). */
function readExisting(file: string | undefined): Existing[] {
  if (!file) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { results?: Existing[] }[] | { results?: Existing[] };
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || !Array.isArray(first.results)) throw new Error(`${file} isn't wrangler's --json output.`);
  return first.results;
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
  return { names, values };
}

const gatesOf = (geometry: string | null | undefined) =>
  geometry ? ((JSON.parse(geometry) as RouteGeometry).gates ?? []) : [];

const rows = readExisting(existingFile);
const listed = rows
  .filter((r) => r.author_id === BUNDLED_AUTHOR.id && r.geometry)
  .map((r) => ({ ...r, gates: gatesOf(r.geometry), matched: false }));
const taken = new Set(rows.map((r) => r.slug));

// Slugs are picked below, once it's known which races are new.
const bundled = await bundledRoutes(repo);
const lines: string[] = [];
const author = columnsOf(schema.users, BUNDLED_AUTHOR);
lines.push(`INSERT OR IGNORE INTO "users" (${author.names.join(", ")}) VALUES (${author.values.join(", ")});`);

const tagLines = (routeId: string, tags: string[]) =>
  tags.map((tag) => `INSERT OR IGNORE INTO "route_tags" ("route_id", "tag") VALUES (${literal(routeId)}, ${literal(tag)});`);

/** The listed route with this race's course, preferring one under one of its names. */
function findListed(b: BundledRoute) {
  const gates = gatesOf(b.route.geometry);
  const names = new Set([b.route.title, ...b.formerNames]);
  const same = listed.filter(
    (l) => !l.matched && l.map_key === b.route.mapKey && !!l.loopable === !!b.route.loopable && sameCourse(l.gates, gates),
  );
  return same.find((l) => names.has(l.title)) ?? same[0] ?? null;
}

const added: BundledRoute[] = [];
let matched = 0;
let renamed = 0;
for (const b of bundled) {
  const l = findListed(b);
  if (l) {
    l.matched = true;
    const set: Record<string, unknown> = Object.fromEntries(Object.entries(b.route).filter(([k]) => !KEPT_COLUMNS.has(k)));
    // A moderator's own wording stays; the generated one follows the race's author.
    if (l.description.startsWith(BUNDLED_DESCRIPTION_PREFIX)) set.description = b.route.description;
    const { names, values } = columnsOf(schema.routes, set);
    const assignments = names.map((n, i) => `${n} = ${values[i]}`).join(", ");
    // Only when something changed, so a re-run leaves `updated_at` alone.
    const changed = names.flatMap((n, i) => (n === `"updated_at"` ? [] : [`${n} IS NOT ${values[i]}`])).join(" OR ");
    lines.push(`UPDATE "routes" SET ${assignments} WHERE "id" = ${literal(l.id)} AND (${changed});`);
    lines.push(...tagLines(l.id, b.tags));
    matched++;
    if (l.title !== b.route.title) renamed++;
  } else {
    const slug = allocateSlug(b.route.title, b.route.mapKey, taken);
    const route = { ...b.route, slug };
    const { names, values } = columnsOf(schema.routes, route);
    lines.push(`INSERT INTO "routes" (${names.join(", ")}) VALUES (${values.join(", ")});`);
    lines.push(...tagLines(route.id!, b.tags));
    added.push(b);
  }
}

// A listed course nothing matched, whose race is now listed again under a new course.
let oldCourses = 0;
for (const l of listed) {
  if (l.matched) continue;
  const replaced = added.some((b) => b.route.mapKey === l.map_key && [b.route.title, ...b.formerNames].includes(l.title));
  if (!replaced) continue;
  oldCourses++;
  if (l.description.startsWith(BUNDLED_DESCRIPTION_PREFIX) && l.description !== OLD_COURSE_NOTE) {
    lines.push(`UPDATE "routes" SET "description" = ${literal(OLD_COURSE_NOTE)} WHERE "id" = ${literal(l.id)};`);
  }
}

writeFileSync(out, lines.join("\n") + "\n");
console.log(
  `Wrote ${out}: ${matched} listed (${renamed} renamed), ${added.length} new, ${oldCourses} older course(s) noted.`,
);
