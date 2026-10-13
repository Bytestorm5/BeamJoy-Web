import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Storage for the Alfiz authorization engine (see lib/alfiz/d1-driver.ts). Each record is kept
 * whole as JSON in `doc`, exactly as Alfiz hands it over; the other columns exist only to filter
 * and order by. Declared here so drizzle-kit generates the migration; the driver itself speaks
 * raw SQL to D1.
 */

export const alfizGrants = sqliteTable(
  "alfiz_grants",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    scope: text("scope").notNull(),
    roleId: text("role_id"),
    doc: text("doc").notNull(),
  },
  (t) => [index("alfiz_grants_subject_idx").on(t.subject), index("alfiz_grants_scope_idx").on(t.scope)],
);

export const alfizRevokes = sqliteTable(
  "alfiz_revokes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    scope: text("scope").notNull(),
    doc: text("doc").notNull(),
  },
  (t) => [index("alfiz_revokes_user_idx").on(t.userId)],
);

export const alfizRoles = sqliteTable("alfiz_roles", {
  id: text("id").primaryKey(),
  doc: text("doc").notNull(),
});

export const alfizGroups = sqliteTable("alfiz_groups", {
  id: text("id").primaryKey(),
  doc: text("doc").notNull(),
});

export const alfizUsers = sqliteTable("alfiz_users", {
  userId: text("user_id").primaryKey(),
  doc: text("doc").notNull(),
});

export const alfizRequests = sqliteTable(
  "alfiz_requests",
  {
    id: text("id").primaryKey(),
    state: text("state").notNull(),
    requesterUserId: text("requester_user_id").notNull(),
    doc: text("doc").notNull(),
  },
  (t) => [index("alfiz_requests_state_idx").on(t.state)],
);

/** Singleton head (id = 1) plus one row per published version. */
export const alfizCatalog = sqliteTable("alfiz_catalog", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
  doc: text("doc").notNull(),
});

export const alfizCatalogVersions = sqliteTable("alfiz_catalog_versions", {
  version: integer("version").primaryKey(),
  publishedAt: integer("published_at").notNull(),
  doc: text("doc").notNull(),
});

export const alfizImports = sqliteTable("alfiz_imports", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
  doc: text("doc").notNull(),
});

export const alfizAudit = sqliteTable(
  "alfiz_audit",
  {
    id: text("id").primaryKey(),
    at: integer("at").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    doc: text("doc").notNull(),
  },
  (t) => [index("alfiz_audit_at_idx").on(t.at, t.id), index("alfiz_audit_target_idx").on(t.target)],
);

/** The invalidation log's head: singleton (id = 1), seeded by the migration. */
export const alfizEventHead = sqliteTable("alfiz_event_head", {
  id: integer("id").primaryKey(),
  seq: integer("seq").notNull(),
  prunedThrough: integer("pruned_through").notNull(),
});

export const alfizEvents = sqliteTable(
  "alfiz_events",
  {
    seq: integer("seq").primaryKey(),
    at: integer("at").notNull(),
    doc: text("doc").notNull(),
  },
  (t) => [index("alfiz_events_at_idx").on(t.at)],
);
