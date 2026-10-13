import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  /** `<provider>:<providerAccountId>`, e.g. `discord:1234`. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: createdAt(),
});

export const routes = sqliteTable(
  "routes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    activityType: text("activity_type").notNull().default("race"),
    shareCode: text("share_code").notNull(),

    /** "vanilla" | "custom" */
    mapKind: text("map_kind").notNull(),
    /** Grouping key for filters: the level folder for vanilla maps, `custom:<slug>` otherwise. */
    mapKey: text("map_key").notNull(),
    mapName: text("map_name").notNull(),
    mapDownloadUrl: text("map_download_url"),

    surface: text("surface").notNull().default("asphalt"),
    videoUrl: text("video_url"),

    // Derived from the share code at submit time (see lib/sharecode/analyze.ts).
    distanceM: integer("distance_m").notNull(),
    maxDistanceM: integer("max_distance_m").notNull(),
    checkpoints: integer("checkpoints").notNull(),
    steps: integer("steps").notNull(),
    /** Author-overridable; `cornersAuto` keeps the estimate for reference. */
    corners: integer("corners").notNull(),
    cornersAuto: integer("corners_auto").notNull(),
    hairpins: integer("hairpins").notNull(),
    gridSlots: integer("grid_slots").notNull(),
    loopable: integer("loopable", { mode: "boolean" }).notNull(),
    branching: integer("branching", { mode: "boolean" }).notNull(),
    sectors: integer("sectors").notNull(),
    defaultLaps: integer("default_laps"),
    raceMode: text("race_mode").notNull(),
    elevationGainM: integer("elevation_gain_m").notNull(),
    elevationRangeM: integer("elevation_range_m").notNull(),
    /** JSON RouteGeometry, used to draw previews without re-decoding the code. */
    geometry: text("geometry").notNull(),

    copyCount: integer("copy_count").notNull().default(0),
    /** Denormalized for cards; first image by position. */
    coverUrl: text("cover_url"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("routes_map_idx").on(t.mapKey),
    index("routes_author_idx").on(t.authorId),
    index("routes_created_idx").on(t.createdAt),
    index("routes_distance_idx").on(t.distanceM),
  ],
);

export const routeImages = sqliteTable(
  "route_images",
  {
    id: text("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Storage key so the file can be deleted with the route. */
    storageKey: text("storage_key").notNull(),
    position: integer("position").notNull(),
    aspect: real("aspect"),
  },
  (t) => [index("route_images_route_idx").on(t.routeId)],
);

export const routeTags = sqliteTable(
  "route_tags",
  {
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.tag] }), index("route_tags_tag_idx").on(t.tag)],
);

export type Route = typeof routes.$inferSelect;
export type RouteImage = typeof routeImages.$inferSelect;
export type User = typeof users.$inferSelect;
