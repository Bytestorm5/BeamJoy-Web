import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local dev uses a SQLite file; production points DATABASE_URL at a libSQL/Turso database.
const url = process.env.DATABASE_URL ?? "file:.data/beamjoy.db";

const globalForDb = globalThis as unknown as { __bjClient?: ReturnType<typeof createClient> };
const client =
  globalForDb.__bjClient ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
if (process.env.NODE_ENV !== "production") globalForDb.__bjClient = client;

export const db = drizzle(client, { schema });
export { schema };
