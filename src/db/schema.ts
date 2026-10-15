import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  /** `<provider>:<providerAccountId>`, e.g. `discord:1234`. */
  id: text("id").primaryKey(),
  /** Public URL key (/u/<slug>). Set once from the first display name. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: createdAt(),
});

export const routes = sqliteTable(
  "routes",
  {
    /** Internal key; never shown in URLs. */
    id: text("id").primaryKey(),
    /** Public URL key (/routes/<slug>). Set once from the first title, so links never break. */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    activityType: text("activity_type").notNull().default("race"),
    shareCode: text("share_code").notNull(),

    /** "vanilla" | "custom" */
    mapKind: text("map_kind").notNull(),
    /** The map's slug (see lib/maps.ts): /maps/<slug> and the catalog's `?map=` filter. */
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
    /** Placed props, weighed like the game's prop budget (lib/sharecode/props.ts). */
    propCount: integer("prop_count").notNull().default(0),
    /** JSON RouteGeometry, used to draw previews without re-decoding the code. */
    geometry: text("geometry").notNull(),

    // Engagement totals, denormalized for cards and sorting. Daily history is in routeDailyStats.
    viewCount: integer("view_count").notNull().default(0),
    /** Share-code copies: what the site calls a "download". */
    copyCount: integer("copy_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    dislikeCount: integer("dislike_count").notNull().default(0),
    /** Wilson lower bound of the like ratio; what "Top rated" sorts by. */
    ratingScore: real("rating_score").notNull().default(0),
    /** Denormalized for cards; first image by position. */
    coverUrl: text("cover_url"),
    /**
     * The game's level folder (e.g. `west_coast_usa`), when known: routes uploaded from the game
     * set it, base-game maps derive it from `mapKey`. Picks the road map under the route map.
     */
    levelId: text("level_id"),
    /** Top-down screenshot taken in game, and the world box it shows: JSON [minX, minY, maxX, maxY]. */
    aerialUrl: text("aerial_url"),
    aerialKey: text("aerial_key"),
    aerialBounds: text("aerial_bounds"),
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
    index("routes_rating_idx").on(t.ratingScore),
    index("routes_course_idx").on(t.mapKey, t.checkpoints),
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

/** Per-route, per-UTC-day counters for the "over time" charts. */
export const routeDailyStats = sqliteTable(
  "route_daily_stats",
  {
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD, UTC. */
    day: text("day").notNull(),
    views: integer("views").notNull().default(0),
    copies: integer("copies").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.day] })],
);

export const routeVotes = sqliteTable(
  "route_votes",
  {
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 1 = like, -1 = dislike. */
    value: integer("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.userId] })],
);

/**
 * A game install linked to a site account (the mod's "Link account"). The game holds the raw
 * token; only its SHA-256 is stored.
 */
export const gameTokens = sqliteTable(
  "game_tokens",
  {
    /** Random, never derived from the token. Only the owner's account page uses it. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    /** BeamMP name the game reported when it was linked. */
    playerName: text("player_name").notNull().default(""),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("game_tokens_user_idx").on(t.userId)],
);

/**
 * A pending link, device-code style: the game asks for one, shows `userCode`, and polls with
 * its secret `deviceCode` (stored hashed) until someone signed in approves the code.
 */
export const gameLinks = sqliteTable("game_links", {
  deviceHash: text("device_hash").primaryKey(),
  userCode: text("user_code").notNull().unique(),
  playerName: text("player_name").notNull().default(""),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

/**
 * Global leaderboard: each driver's best on a route, as their game reports laps. The best
 * theoretical lap is the sum of their best time in every sector, from any lap.
 */
export const routeRecords = sqliteTable(
  "route_records",
  {
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    playerName: text("player_name").notNull().default(""),
    bestLapMs: integer("best_lap_ms").notNull(),
    bestLapVehicle: text("best_lap_vehicle").notNull().default(""),
    /** JSON number[]: the sector splits of the best lap, when the game sent them. */
    bestLapSectors: text("best_lap_sectors"),
    bestLapAt: integer("best_lap_at", { mode: "timestamp_ms" }).notNull(),
    /** JSON (number | null)[]: best time in each sector. */
    bestSectors: text("best_sectors"),
    /** Sum of bestSectors once every sector has a time. */
    theoreticalMs: integer("theoretical_ms"),
    laps: integer("laps").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.routeId, t.userId] }),
    index("route_records_lap_idx").on(t.routeId, t.bestLapMs),
    index("route_records_theory_idx").on(t.routeId, t.theoreticalMs),
    index("route_records_user_idx").on(t.userId),
  ],
);

/** Road network of a game level, uploaded once from the game, stored gzipped in R2. */
export const levelMaps = sqliteTable("level_maps", {
  /** The game's level folder, e.g. `west_coast_usa`. */
  level: text("level").primaryKey(),
  storageKey: text("storage_key").notNull(),
  nodes: integer("nodes").notNull(),
  edges: integer("edges").notNull(),
  /** JSON [minX, minY, maxX, maxY] */
  bounds: text("bounds").notNull(),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** A BeamMP server sharing its players live (opt-in on the server). One row per server. */
export const liveSessions = sqliteTable(
  "live_sessions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    /** Random id the server plugin keeps in its config; never shown. */
    serverKey: text("server_key").notNull().unique(),
    serverName: text("server_name").notNull(),
    level: text("level").notNull(),
    mapName: text("map_name").notNull(),
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    /** JSON LivePlayer[] */
    players: text("players").notNull().default("[]"),
    playerCount: integer("player_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("live_sessions_updated_idx").on(t.updatedAt)],
);

export type Route = typeof routes.$inferSelect;
export type RouteImage = typeof routeImages.$inferSelect;
export type User = typeof users.$inferSelect;
