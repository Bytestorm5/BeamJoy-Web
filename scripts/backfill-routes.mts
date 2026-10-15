/**
 * Fills columns added after routes were already listed: `prop_count` (decoded from each stored
 * share code) and `level_id` for base-game maps. Reads the rows with wrangler and writes a SQL
 * file to apply the same way:
 *
 *   npm run db:backfill -- --remote backfill.sql
 *   npx wrangler d1 execute DB --remote --file backfill.sql
 *
 * Safe to re-run: every statement sets a value computed from the row itself.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { analyzeRace } from "../src/lib/sharecode/analyze.ts";
import { decodeShareCode } from "../src/lib/sharecode/codec.ts";
import { vanillaMapBySlug } from "../src/lib/maps.ts";

const [where, out] = process.argv.slice(2);
if ((where !== "--remote" && where !== "--local") || !out) {
  console.error("Usage: npm run db:backfill -- --remote|--local <out.sql>");
  process.exit(1);
}

const raw = execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "DB", where, "--json", "--command", "SELECT id, map_key, share_code FROM routes"],
  { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
);
const rows = (JSON.parse(raw) as { results: { id: string; map_key: string; share_code: string }[] }[])[0].results;

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
const lines: string[] = [];
let failed = 0;
for (const row of rows) {
  try {
    const props = analyzeRace((await decodeShareCode(row.share_code)).payload).stats.props;
    const level = vanillaMapBySlug(row.map_key)?.level;
    const setLevel = level ? `, "level_id" = coalesce("level_id", ${q(level)})` : "";
    lines.push(`UPDATE "routes" SET "prop_count" = ${props}${setLevel} WHERE "id" = ${q(row.id)};`);
  } catch (e) {
    failed++;
    console.warn(`Skipping ${row.id}: ${(e as Error).message}`);
  }
}
writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${lines.length} updates to ${out}${failed ? ` (${failed} skipped)` : ""}.`);
