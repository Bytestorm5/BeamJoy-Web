import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { driverContractCases, eventLogContractCases } from "@alfiz/application/driver-suite";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, it } from "vitest";
import { d1Driver } from "../d1-driver";

/**
 * Holds the D1 driver to Alfiz's own storage contract, against a real (local) D1 with the app's
 * migrations applied, exactly as production runs them.
 */
let proxy: Awaited<ReturnType<typeof getPlatformProxy<CloudflareEnv>>>;
let db: D1Database;
// Throwaway state, so tests never touch the dev database in .wrangler/state.
const stateDir = mkdtempSync(path.join(tmpdir(), "alfiz-d1-"));

const ALFIZ_TABLES = [
  "alfiz_grants",
  "alfiz_revokes",
  "alfiz_roles",
  "alfiz_groups",
  "alfiz_users",
  "alfiz_requests",
  "alfiz_catalog",
  "alfiz_catalog_versions",
  "alfiz_imports",
  "alfiz_audit",
  "alfiz_events",
];

beforeAll(async () => {
  proxy = await getPlatformProxy<CloudflareEnv>({ persist: { path: stateDir } });
  db = proxy.env.DB;
  const dir = path.resolve("drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.replace(/--.*$/gm, "").trim()) await db.prepare(stmt).run();
    }
  }
});

afterAll(async () => {
  await proxy?.dispose();
  rmSync(stateDir, { recursive: true, force: true });
});

/** Each case gets an empty store, as the suite expects of a fresh driver. */
async function freshDriver() {
  await db.batch([
    ...ALFIZ_TABLES.map((t) => db.prepare(`DELETE FROM ${t}`)),
    db.prepare("UPDATE alfiz_event_head SET seq = 0, pruned_through = 0 WHERE id = 1"),
  ]);
  return d1Driver(db);
}

describe("d1Driver: Alfiz storage contract", () => {
  for (const c of driverContractCases) it(c.name, async () => c.run(await freshDriver()));
});

describe("d1Driver: Alfiz event-log contract", () => {
  for (const c of eventLogContractCases) it(c.name, async () => c.run(await freshDriver()));
});
