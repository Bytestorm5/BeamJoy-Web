import type { StorageDriver } from "@alfiz/application";
import type { AuditEvent, GrantRow, InvalidationEvent } from "@alfiz/core";

/**
 * Alfiz storage on Cloudflare D1. Alfiz ships memory, Prisma and Mongo drivers; this is the same
 * seam (`StorageDriver`) over D1, held to Alfiz's own conformance suite (driver + event-log cases,
 * see src/lib/alfiz/__tests__/d1-driver.test.ts).
 *
 * Records are stored whole as JSON (`doc`) and returned as stored; the extra columns are only for
 * filtering and ordering. Tables come from src/db/alfiz-schema.ts (migration drizzle/0003_alfiz).
 *
 * Not implemented (all optional): metrics, imports and multi-app partitions. `runExclusive` is an
 * in-isolate mutex, so `crossProcess` is false: fine while nothing builds group graphs.
 */

type Doc = { doc: string };
const parse = <T>(row: Doc | null | undefined): T | null => (row ? (JSON.parse(row.doc) as T) : null);
const parseAll = <T>(rows: Doc[]): T[] => rows.map((r) => JSON.parse(r.doc) as T);

/** D1 caps bound parameters per statement at 100. */
const CHUNK = 90;
const chunks = <T>(xs: readonly T[]) =>
  Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK));
const marks = (n: number) => Array(n).fill("?").join(",");

const locks = new Map<string, Promise<unknown>>();

export function d1Driver(db: D1Database): StorageDriver {
  const all = async <T = Doc>(sql: string, ...params: unknown[]) =>
    (await db.prepare(sql).bind(...params).all<T>()).results;
  const first = <T = Doc>(sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params).first<T>();
  const run = (sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params).run();

  /** WHERE clause for grant filters; `null` when the filter can match nothing. */
  function grantWhere(filter: Parameters<StorageDriver["listGrants"]>[0], subjects?: readonly string[]) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.subject !== undefined) {
      clauses.push("subject = ?");
      params.push(filter.subject);
    }
    if (subjects !== undefined) {
      if (!subjects.length) return null;
      clauses.push(`subject IN (${marks(subjects.length)})`);
      params.push(...subjects);
    }
    if (filter?.scope !== undefined) {
      clauses.push("scope = ?");
      params.push(filter.scope);
    }
    if (filter?.roleId !== undefined) {
      // Only a string is a roleId filter (the bundled drivers agree): `null` is not "no role".
      if (typeof filter.roleId !== "string") return null;
      clauses.push("role_id = ?");
      params.push(filter.roleId);
    }
    return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
  }

  /** Runs a grant query once, or once per chunk of a large `subjects` filter. */
  async function eachGrantQuery<T>(filter: Parameters<StorageDriver["listGrants"]>[0], q: (where: { sql: string; params: unknown[] }) => Promise<T>) {
    const groups = filter?.subjects === undefined ? [undefined] : filter.subjects.length ? chunks(filter.subjects) : [[]];
    const out: T[] = [];
    for (const subjects of groups) {
      const where = grantWhere(filter, subjects);
      if (where) out.push(await q(where));
    }
    return out;
  }

  return {
    durable: true,
    driverName: "d1",
    crossProcess: false,

    async insertGrant(row) {
      await run(
        "INSERT INTO alfiz_grants (id, subject, scope, role_id, doc) VALUES (?, ?, ?, ?, ?)",
        row.id,
        row.subject,
        row.scope,
        row.roleId ?? null,
        JSON.stringify(row),
      );
    },
    async deleteGrant(id) {
      return parse<GrantRow>(await first("DELETE FROM alfiz_grants WHERE id = ? RETURNING doc", id));
    },
    async listGrants(filter) {
      const pages = await eachGrantQuery(filter, (w) => all(`SELECT doc FROM alfiz_grants ${w.sql}`, ...w.params));
      return pages.flatMap((rows) => parseAll<GrantRow>(rows));
    },
    async countGrants(filter) {
      const counts = await eachGrantQuery(filter, async (w) =>
        Number((await first<{ n: number }>(`SELECT count(*) AS n FROM alfiz_grants ${w.sql}`, ...w.params))?.n ?? 0),
      );
      return counts.reduce((a, b) => a + b, 0);
    },

    async insertRevoke(row) {
      await run(
        "INSERT INTO alfiz_revokes (id, user_id, scope, doc) VALUES (?, ?, ?, ?)",
        row.id,
        row.userId,
        row.scope,
        JSON.stringify(row),
      );
    },
    async deleteRevoke(id) {
      return parse(await first("DELETE FROM alfiz_revokes WHERE id = ? RETURNING doc", id));
    },
    async listRevokes(filter) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (filter?.userId !== undefined) {
        clauses.push("user_id = ?");
        params.push(filter.userId);
      }
      if (filter?.scope !== undefined) {
        clauses.push("scope = ?");
        params.push(filter.scope);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      return parseAll(await all(`SELECT doc FROM alfiz_revokes ${where}`, ...params));
    },

    async upsertRole(role) {
      await run(
        "INSERT INTO alfiz_roles (id, doc) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
        role.id,
        JSON.stringify(role),
      );
    },
    async getRole(id) {
      return parse(await first("SELECT doc FROM alfiz_roles WHERE id = ?", id));
    },
    async getRoles(ids) {
      const out = [];
      for (const part of chunks(ids)) {
        out.push(...parseAll(await all(`SELECT doc FROM alfiz_roles WHERE id IN (${marks(part.length)})`, ...part)));
      }
      return out as Awaited<ReturnType<NonNullable<StorageDriver["getRoles"]>>>;
    },
    async listRoles() {
      return parseAll(await all("SELECT doc FROM alfiz_roles"));
    },
    async deleteRole(id) {
      await run("DELETE FROM alfiz_roles WHERE id = ?", id);
    },

    async upsertGroup(group) {
      await run(
        "INSERT INTO alfiz_groups (id, doc) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
        group.id,
        JSON.stringify(group),
      );
    },
    async getGroup(id) {
      return parse(await first("SELECT doc FROM alfiz_groups WHERE id = ?", id));
    },
    async listGroups() {
      return parseAll(await all("SELECT doc FROM alfiz_groups"));
    },
    async deleteGroup(id) {
      await run("DELETE FROM alfiz_groups WHERE id = ?", id);
    },

    async getUser(userId) {
      return parse(await first("SELECT doc FROM alfiz_users WHERE user_id = ?", userId));
    },
    async upsertUser(user) {
      await run(
        "INSERT INTO alfiz_users (user_id, doc) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET doc = excluded.doc",
        user.userId,
        JSON.stringify(user),
      );
    },
    async deleteUser(userId) {
      // Memberships live on the user record, so this removes them too.
      await run("DELETE FROM alfiz_users WHERE user_id = ?", userId);
    },
    async listUsers() {
      return parseAll(await all("SELECT doc FROM alfiz_users"));
    },
    async listUsersInGroup(groupId) {
      const rows = await all<{ user_id: string }>(
        "SELECT u.user_id FROM alfiz_users u, json_each(u.doc, '$.groupIds') g WHERE g.value = ?",
        groupId,
      );
      return rows.map((r) => r.user_id);
    },

    async insertRequest(request) {
      await run(
        "INSERT INTO alfiz_requests (id, state, requester_user_id, doc) VALUES (?, ?, ?, ?)",
        request.id,
        request.state,
        request.requesterUserId,
        JSON.stringify(request),
      );
    },
    async updateRequest(request) {
      await run(
        `INSERT INTO alfiz_requests (id, state, requester_user_id, doc) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET state = excluded.state, requester_user_id = excluded.requester_user_id, doc = excluded.doc`,
        request.id,
        request.state,
        request.requesterUserId,
        JSON.stringify(request),
      );
    },
    async getRequest(id) {
      return parse(await first("SELECT doc FROM alfiz_requests WHERE id = ?", id));
    },
    async listRequests(filter) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (filter?.state !== undefined) {
        clauses.push("state = ?");
        params.push(filter.state);
      }
      if (filter?.requesterUserId !== undefined) {
        clauses.push("requester_user_id = ?");
        params.push(filter.requesterUserId);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      return parseAll(await all(`SELECT doc FROM alfiz_requests ${where}`, ...params));
    },

    async putCatalog(version, document, publishedAt) {
      const doc = JSON.stringify(document);
      await db.batch([
        db
          .prepare(
            "INSERT INTO alfiz_catalog (id, version, doc) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version, doc = excluded.doc",
          )
          .bind(version, doc),
        db
          .prepare(
            "INSERT INTO alfiz_catalog_versions (version, published_at, doc) VALUES (?, ?, ?) ON CONFLICT(version) DO UPDATE SET published_at = excluded.published_at, doc = excluded.doc",
          )
          .bind(version, publishedAt ?? 0, doc),
      ]);
    },
    async getCatalog() {
      const row = await first<{ version: number; doc: string }>("SELECT version, doc FROM alfiz_catalog WHERE id = 1");
      return row ? { version: row.version, document: JSON.parse(row.doc) } : null;
    },
    async getCatalogVersion(version) {
      const row = await first<{ version: number; published_at: number; doc: string }>(
        "SELECT version, published_at, doc FROM alfiz_catalog_versions WHERE version = ?",
        version,
      );
      return row ? { version: row.version, document: JSON.parse(row.doc), publishedAt: row.published_at } : null;
    },
    async listCatalogVersions() {
      const rows = await all<{ version: number; published_at: number }>(
        "SELECT version, published_at FROM alfiz_catalog_versions ORDER BY version",
      );
      return rows.map((r) => ({ version: r.version, publishedAt: r.published_at }));
    },

    async appendAudit(event) {
      await run(
        "INSERT INTO alfiz_audit (id, at, actor, action, target, doc) VALUES (?, ?, ?, ?, ?, ?)",
        event.id,
        event.at,
        event.actor,
        event.action,
        event.target,
        JSON.stringify(event),
      );
    },
    async listAudit(filter) {
      for (const field of ["from", "to"] as const) {
        const value = filter?.[field];
        if (value !== undefined && !Number.isSafeInteger(value)) {
          throw new TypeError(
            `alfiz: listAudit ${field} must be an integer epoch-millisecond value, received ${JSON.stringify(value)}`,
          );
        }
      }
      const clauses: string[] = [];
      const params: unknown[] = [];
      for (const [col, value] of [
        ["target", filter?.target],
        ["actor", filter?.actor],
        ["action", filter?.action],
      ] as const) {
        if (value !== undefined) {
          clauses.push(`${col} = ?`);
          params.push(value);
        }
      }
      if (filter?.from !== undefined) {
        clauses.push("at >= ?");
        params.push(filter.from);
      }
      if (filter?.to !== undefined) {
        clauses.push("at < ?");
        params.push(filter.to);
      }
      const limit = filter?.limit;
      if (filter?.cursor !== undefined) {
        // Export paging: ascending, strictly after the cursor, first `limit`.
        clauses.push("(at > ? OR (at = ? AND id > ?))");
        params.push(filter.cursor.at, filter.cursor.at, filter.cursor.id);
        const where = `WHERE ${clauses.join(" AND ")}`;
        if (limit !== undefined && limit <= 0) return [];
        const lim = limit === undefined ? "" : ` LIMIT ${Math.trunc(limit)}`;
        return parseAll<AuditEvent>(await all(`SELECT doc FROM alfiz_audit ${where} ORDER BY at, id${lim}`, ...params));
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      if (limit === undefined) {
        return parseAll<AuditEvent>(await all(`SELECT doc FROM alfiz_audit ${where} ORDER BY at, id`, ...params));
      }
      if (limit <= 0) return [];
      // The LAST `limit` matching events, returned oldest first.
      const rows = await all(`SELECT doc FROM alfiz_audit ${where} ORDER BY at DESC, id DESC LIMIT ${Math.trunc(limit)}`, ...params);
      return parseAll<AuditEvent>(rows).reverse();
    },

    // The persisted invalidation log: lets every Worker isolate see grants made in another one.
    async appendEvents(events, at) {
      const stmts: D1PreparedStatement[] = [
        db.prepare("INSERT OR IGNORE INTO alfiz_event_head (id, seq, pruned_through) VALUES (1, 0, 0)"),
      ];
      for (const event of events) {
        stmts.push(
          db
            .prepare("INSERT INTO alfiz_events (seq, at, doc) VALUES ((SELECT seq + 1 FROM alfiz_event_head WHERE id = 1), ?, ?)")
            .bind(at, JSON.stringify(event)),
          db.prepare("UPDATE alfiz_event_head SET seq = seq + 1 WHERE id = 1"),
        );
      }
      stmts.push(db.prepare("SELECT seq FROM alfiz_event_head WHERE id = 1"));
      // A batch is one transaction, so the sequence advances atomically even across isolates.
      const results = await db.batch<{ seq: number }>(stmts);
      return { upTo: Number(results[results.length - 1].results[0].seq) };
    },
    async headSeq() {
      return Number((await first<{ seq: number }>("SELECT seq FROM alfiz_event_head WHERE id = 1"))?.seq ?? 0);
    },
    async eventsSince(seq, limit) {
      const head = await first<{ pruned_through: number }>("SELECT pruned_through FROM alfiz_event_head WHERE id = 1");
      if (seq < Number(head?.pruned_through ?? 0)) return { gap: true };
      const take = limit === undefined ? -1 : Math.max(0, Math.trunc(limit));
      const rows = await all<{ seq: number; doc: string }>(
        "SELECT seq, doc FROM alfiz_events WHERE seq > ? ORDER BY seq LIMIT ?",
        seq,
        take,
      );
      // Stop at the first hole so a cursor never skips an event it wasn't handed.
      const events: InvalidationEvent[] = [];
      let expected = seq + 1;
      for (const r of rows) {
        if (Number(r.seq) !== expected) break;
        events.push(JSON.parse(r.doc));
        expected += 1;
      }
      return { upTo: expected - 1, events };
    },
    async pruneEvents(cutoff) {
      const head = await first<{ seq: number; pruned_through: number }>(
        "SELECT seq, pruned_through FROM alfiz_event_head WHERE id = 1",
      );
      const headSeq = Number(head?.seq ?? 0);
      const prunedThrough = Number(head?.pruned_through ?? 0);
      let upTo = 0;
      if (cutoff.at !== undefined) {
        const row = await first<{ s: number | null }>("SELECT max(seq) AS s FROM alfiz_events WHERE at < ?", cutoff.at);
        upTo = Number(row?.s ?? 0);
      }
      if (cutoff.keepRows !== undefined) upTo = Math.max(upTo, headSeq - cutoff.keepRows);
      if (upTo <= prunedThrough) return 0;
      const [deleted] = await db.batch([
        db.prepare("DELETE FROM alfiz_events WHERE seq <= ?").bind(upTo),
        db.prepare("UPDATE alfiz_event_head SET pruned_through = ? WHERE id = 1").bind(upTo),
      ]);
      return deleted.meta.changes ?? 0;
    },

    async runExclusive(key, fn) {
      const previous = locks.get(key) ?? Promise.resolve();
      const next = previous.then(fn, fn);
      locks.set(
        key,
        next.catch(() => undefined),
      );
      return next;
    },
  };
}
