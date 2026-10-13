import "server-only";
import { createApplication, type AlfizApplication } from "@alfiz/application";
import { createAlfizClient, type ClientOf, type Provenance, type SubjectId } from "@alfiz/core";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BUILTIN_ROLES, catalog } from "./catalog";
import { d1Driver } from "./d1-driver";

/**
 * The Alfiz Application (authorization engine, stored in D1) and the typed client every check
 * goes through. One of each per Worker isolate. Grants made in one isolate reach the others
 * through the persisted invalidation log: the client re-reads the log head at most every 5s.
 *
 * Nothing outside lib/access.ts (checks) and this file (writes) should touch these.
 */

type App = AlfizApplication<string, string>;
type Client = ClientOf<typeof catalog>;

const SYSTEM: Provenance = { kind: "system", note: "beamjoy-web bootstrap" };

const g = globalThis as unknown as { __bjAlfiz?: { app: App; client: Client }; __bjAlfizReady?: boolean };

function runtime() {
  if (!g.__bjAlfiz) {
    // Construction does no I/O, so this is safe to share across requests.
    const app = createApplication({ catalog, storage: d1Driver(getCloudflareContext().env.DB) }) as unknown as App;
    const client = createAlfizClient({ catalog, provider: app, revalidateAfterMs: 5_000 }) as Client;
    g.__bjAlfiz = { app, client };
  }
  return g.__bjAlfiz;
}

/** Makes sure one grant of `roleId` to `subject` exists (and only one, if two isolates raced). */
async function ensureRoleGrant(app: App, subject: SubjectId, roleId: string) {
  const existing = (await app.listGrants({ subject, roleId })).filter((r) => r.scope === "*" && !r.expiresAt);
  if (!existing.length) {
    await app.createGrant({ subject, roleId, provenance: SYSTEM });
    return;
  }
  for (const extra of existing.slice(1)) await app.deleteGrant(extra.id, SYSTEM);
}

/**
 * Idempotent first-use setup, once per isolate: publish the catalog when it changed, insert any
 * missing built-in role, grant `everyone` the member role, and make ADMIN_USER_IDS administrators.
 * Remembered as a value (never a shared promise), so a cancelled request can't strand others.
 */
async function bootstrap(app: App) {
  const doc = catalog.toDocument();
  const [published, roles] = await Promise.all([app.getPublishedCatalog(), app.listRoles()]);
  if (!published || JSON.stringify(published.document) !== JSON.stringify(doc)) {
    await app.publishCatalog(doc, SYSTEM);
  }
  const have = new Set(roles.map((r) => r.id));
  for (const role of BUILTIN_ROLES) {
    if (!have.has(role.id)) await app.createRole({ ...role, patterns: [...role.patterns] }, SYSTEM);
  }
  await ensureRoleGrant(app, "everyone", "bj-member");
  const admins = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of admins) await ensureRoleGrant(app, `user:${id}`, "bj-admin");
}

async function ready() {
  const rt = runtime();
  if (!g.__bjAlfizReady) {
    await bootstrap(rt.app);
    g.__bjAlfizReady = true;
  }
  return rt;
}

/** The check surface: can / require / snapshot. */
export async function alfizClient(): Promise<Client> {
  return (await ready()).client;
}

/** The write surface: grants, roles, scope cleanup. */
export async function alfizApp(): Promise<App> {
  return (await ready()).app;
}

export { SYSTEM as ALFIZ_SYSTEM };
