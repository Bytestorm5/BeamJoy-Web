import { defineCatalog } from "@alfiz/core";

/**
 * Every permission the site enforces. Keys are `bj.<area>.<leaf>`; the rest of the app reaches
 * them only through the gates in lib/access.ts. After changing this file, run `npm run authz`
 * (regenerates alfiz-catalog.json and runs alfiz-verify).
 *
 * Ownership ("authors manage their own routes") is a condition, not a grant: the author lives on
 * the route row, and `*_own` keys require the gate to pass `{ condition: () => isAuthor }`.
 */
export const catalog = defineCatalog({
  namespaces: ["bj"],
  scopeTypes: {
    "bj.route": { parent: null },
  },
  permissions: {
    "bj.routes.read": { kind: "read", label: "View routes", description: "Browse and open shared routes." },
    "bj.routes.create": { label: "Share routes", description: "Publish a new route." },
    "bj.routes.update": {
      scopes: ["bj.route"],
      label: "Edit any route",
      description: "Edit routes shared by anyone (moderation).",
    },
    "bj.routes.update_own": {
      scopes: ["bj.route"],
      requiresCondition: true,
      label: "Edit own routes",
      description: "Edit a route you shared.",
    },
    "bj.routes.delete": {
      scopes: ["bj.route"],
      destructive: true,
      label: "Delete any route",
      description: "Delete routes shared by anyone (moderation).",
    },
    "bj.routes.delete_own": {
      scopes: ["bj.route"],
      destructive: true,
      requiresCondition: true,
      label: "Delete own routes",
      description: "Delete a route you shared.",
    },
    "bj.routes.rate_route": {
      scopes: ["bj.route"],
      requiresCondition: true,
      label: "Rate routes",
      description: "Like or dislike a route that isn't yours.",
    },
    "bj.routes.record_activity": {
      scopes: ["bj.route"],
      label: "Count views and downloads",
      description: "Record a page view or share-code copy on a route.",
    },
    "bj.routes.submit_time": {
      scopes: ["bj.route"],
      label: "Post lap times",
      description: "Send lap times from the game to a route's leaderboard.",
    },
    "bj.routes.moderate_times": {
      scopes: ["bj.route"],
      destructive: true,
      label: "Remove lap times",
      description: "Remove anyone's time from a route's leaderboard (moderation).",
    },
    "bj.account.read": { kind: "read", label: "View your account", description: "See your account page and linked games." },
    "bj.account.link_game": { label: "Link the game", description: "Connect BeamNG to your account with a link code." },
    "bj.account.unlink_own": {
      requiresCondition: true,
      label: "Unlink own games",
      description: "Disconnect a game linked to your account.",
    },
    "bj.maps.read": { kind: "read", label: "View road maps", description: "See the road map drawn under routes." },
    "bj.maps.upload_roads": {
      label: "Upload map data",
      description: "Upload a level's road map from the game.",
    },
    "bj.live.read": { kind: "read", label: "Watch live sessions", description: "See servers sharing live player positions." },
    "bj.live.publish": {
      label: "Share live sessions",
      description: "Send a server's live player positions from the game.",
    },
  },
});

export type Catalog = typeof catalog;

/** Built-in roles. Seeding is insert-only, so edits made later through Alfiz are kept. */
export const BUILTIN_ROLES = [
  {
    id: "bj-member",
    name: "Member",
    description: "Everyone: browse, share and rate routes, and manage the routes you shared.",
    patterns: [
      "bj.routes.read",
      "bj.routes.create",
      "bj.routes.update_own",
      "bj.routes.delete_own",
      "bj.routes.rate_route",
      "bj.routes.record_activity",
    ],
  },
  {
    // Its own role (not added to bj-member) because seeding is insert-only: a new role reaches
    // existing deployments, new patterns on an existing role would not.
    id: "bj-driver",
    name: "Driver",
    description: "Everyone: link the game, post lap times, share live sessions and map data.",
    patterns: [
      "bj.account.read",
      "bj.account.link_game",
      "bj.account.unlink_own",
      "bj.routes.submit_time",
      "bj.maps.read",
      "bj.maps.upload_roads",
      "bj.live.read",
      "bj.live.publish",
    ],
  },
  {
    id: "bj-moderator",
    name: "Moderator",
    description: "Edit and delete any route.",
    patterns: ["bj.routes.*"],
  },
  {
    id: "bj-admin",
    name: "Administrator",
    description: "Everything, including access management.",
    patterns: ["*"],
  },
] as const;
