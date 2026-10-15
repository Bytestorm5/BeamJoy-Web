# BeamJoy Routes

A catalog for sharing race routes built with [BeamJoy-Revived](https://github.com/foodcache3/BeamJoy-Revived),
the BeamMP server mod. Players paste a race **share code** from the in-game editor, pick the map (a
base-game level, or a mod map with a download link), add screenshots and a description, and everyone
else can browse, filter and copy the code back into their own server.

Built with Next.js 16 and Tailwind CSS 4, deployed to Cloudflare Workers with
[OpenNext](https://opennext.js.org/cloudflare): **D1** holds the data, **R2** holds the screenshots.

## What it does

- **Catalog** (`/`): paginated grid of routes, filterable by map, layout (circuit/sprint), surface,
  length, gates, corners, grid size, branching and tags, with sorting. Every filter lives in the URL,
  so filtered views can be linked.
- **Route pages** (`/routes/<slug>`): screenshot gallery, a top-down route map drawn from the gate
  positions, an elevation profile, stats, the share code with a copy button, and the map download.
- **Submitting** (`/submit`): paste a code and the route is previewed and measured live in the
  browser. The server decodes and measures it again on submit and never trusts numbers sent by the
  browser. Screenshots are downscaled in the browser before upload.
- **Maps** (`/maps`, `/maps/<slug>`): base-game maps and every mod map with routes; each map page
  is the catalog filtered to that map.
- **URLs use slugs**, never database ids: routes, maps and user profiles. A slug comes from the
  first title or display name (`-2`, `-3`… on collisions) and doesn't change later, so links stay
  valid. Screenshot keys are random, and server actions take slugs and resolve ids on the server.
- **Metrics**: per-route views and downloads (share-code copies) bucketed by UTC day, with a
  30-day chart on each route page; like/dislike voting. Catalog cards show views, downloads
  and like %, and the catalog can sort by "Top rated" (Wilson lower bound, so one lucky vote
  doesn't top the list), "Most downloaded" and "Most viewed". Views and downloads count once per
  browser per route per day and skip obvious bots. Voting needs an account; authors can't rate
  their own routes.
- **Props**: each route's prop count, weighed like the game's prop budget (a line counts each
  prop, a curb or painted line one per 20 segments), shown on the route page and filterable.
- **BeamJoy Live** ([BeamJoy-Revived-Live](https://github.com/Bytestorm5/BeamJoy-Revived-Live),
  a mod for BeamJoy-Revived servers) talks to the game API under `/api/game/*`:
  - **Linking** (`/link`, `/account`): device-code style. The game asks for a code, the player
    approves it while signed in, the game gets a token (`bjl_…`, stored hashed in `game_tokens`).
    No password in game, revocable from the Game page.
  - **Uploads** (`POST /api/game/routes`): same validation as the form; the map comes from the
    game's level, screenshots and an aerial shot arrive as base64 JPEGs.
  - **Leaderboards** (`POST /api/game/laps`, `/routes/<slug>/leaderboard`): each driver's best
    lap and best theoretical lap (sum of their best sectors) per route, matched to the race by
    its gates (same map, same gate count, every gate within 3 m). Laps faster than 150 m/s on
    average are refused. The page polls for new times; moderators can remove one.
  - **Road maps** (`POST /api/game/levels/<level>/roads`): a level's road graph, uploaded once by
    the first linked player on it, stored gzipped in R2 (`levels/`), drawn under route and live
    maps. Routes can also carry an aerial shot from the game.
  - **Live** (`/live`): servers whose host opted in send their player list every few seconds.
- Accounts via Discord (Auth.js), with profiles at `/u/<slug>`.
- **Authorization with [Alfiz](https://docs.alfiz.dev/)**: permissions are declared in
  `src/lib/alfiz/catalog.ts` and checked through the gates in `src/lib/access.ts`. Everyone holds
  the member role (browse, share, rate, manage your own routes) and the driver role (link the game,
  post lap times, share live sessions and road maps); `bj-moderator` can edit and
  delete any route; `bj-admin` has everything. `ADMIN_USER_IDS` (internal user ids, e.g.
  `discord:1234`) are granted `bj-admin` on startup. Alfiz data lives in D1 via a custom driver
  that passes Alfiz's storage contract suite. `npm run authz` (run before every build) fails on
  any server action or route handler without a gate.

## Share codes

The format comes from BeamJoy-Revived's race editor
(`BeamJoyClient/ui/modModules/beamjoy/windows/config/races/editor/app.js`):

```
BJRACE1:<base64(gzip(JSON))>
```

The JSON holds the race's gates (position, direction, size, `parents` for branching, `isFinish`),
start positions, mode, loop flag, sector settings and default options. `src/lib/sharecode/` decodes
it (with a cap on decompressed size) and derives:

| Stat | How |
| --- | --- |
| Length / lap length | Gate-to-gate distance along the route. Circuits include the closing stretch back to the first gate. Branching routes get the shortest and longest way through the gate graph. |
| Gates, grid slots, sectors, default laps | Read directly from the code. |
| Corners, hairpins | Estimated from the turn at each gate: ≥35° is a corner, ≥130° a hairpin. Nearby same-direction turns merge into one corner. Authors can override the count. |
| Climb, elevation range | From gate heights along the route. |

Other activity types can be added to `ACTIVITY_TYPES` in `codec.ts` once BeamJoy exports codes for
them.

## Development

```bash
npm install
cp .env.example .env.local      # then set AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate:local        # applies drizzle/*.sql to the local D1 in .wrangler/state
npm run dev
```

`next dev` gets the D1 and R2 bindings from `wrangler.jsonc` (local copies under
`.wrangler/state`) via `initOpenNextCloudflareForDev`. With `AUTH_DEV_LOGIN=true`, the sign-in page
has a name-only login for local testing (always off in production builds).

To fill the catalog with sample data, seed it from BeamJoy-Revived's bundled races. They're
GPL-licensed, so they aren't copied into this repo; the script reads them from a checkout. It also
adds synthetic views, downloads and votes so the metrics UI has something to show:

```bash
git clone --depth 1 https://github.com/foodcache3/BeamJoy-Revived ../BeamJoy-Revived
npm run db:seed -- ../BeamJoy-Revived
```

To run the real Worker build locally in workerd, copy `.dev.vars.example` to `.dev.vars`, then
run `npm run preview`.

Checks:

```bash
npm run lint && npm run typecheck && npm test && npm run authz && npm run build
```

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new migration in
`drizzle/`. After changing bindings in `wrangler.jsonc`, run `npm run cf-typegen`.

## Deploying to Cloudflare

One-time setup:

```bash
npx wrangler d1 create beamjoy-web-db              # put the printed database_id in wrangler.jsonc
npx wrangler r2 bucket create beamjoy-web-storage
npm run db:migrate:remote
npx wrangler secret put AUTH_SECRET                # plus AUTH_DISCORD_ID / AUTH_DISCORD_SECRET
```

Then either run `npm run deploy` locally, or connect the repo to **Workers Builds** with:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

`npm run build` runs `next build` and then, as `postbuild`, `opennextjs-cloudflare build
--skipNextBuild` (from the `output: "standalone"` build), so it always leaves a deployable
`.open-next/`. `wrangler deploy` detects the OpenNext project and hands off to
`opennextjs-cloudflare deploy`, which needs that compiled output. A plain `next build` without the
postbuild step fails there with "Could not find compiled Open Next config".

`keep_vars` is on in `wrangler.jsonc`, so variables and secrets set in the dashboard survive
deploys. Run `npm run db:migrate:remote` whenever a new migration lands.

OAuth callback URLs are `<site>/api/auth/callback/<provider>`.

### Bundled races

BeamJoy-Revived's bundled races are listed in production under the
BeamJoy-Revived account (`/u/beamjoy-revived`), with no made-up metrics. To load them (or add
races upstream has added since), run the **Import bundled races** workflow from the Actions tab.
It needs repository secrets `CLOUDFLARE_API_TOKEN` (D1 edit) and `CLOUDFLARE_ACCOUNT_ID`. Or, from
a machine logged in to wrangler:

```bash
npm run db:import-bundled -- ../BeamJoy-Revived bundled.sql
npx wrangler d1 execute DB --remote --file bundled.sql
```

Races already listed are skipped, so re-running is safe.

### Backfilling new columns

Columns added after routes were listed (`prop_count`, `level_id`) are filled by:

```bash
npm run db:backfill -- --remote backfill.sql
npx wrangler d1 execute DB --remote --file backfill.sql
```

Notes:

- Next.js is pinned to 16.3.x: OpenNext's Cloudflare adapter (1.20.11) doesn't yet load the
  `preview-props.json` manifest that Next 16.4 added, so a 16.4 build crashes on Workers.
- Links prefetch on hover, and every dynamic route has a `loading.tsx`, so a prefetch renders only
  the layout and skeleton and never touches D1. The flip side of streaming is that a missing route
  renders "Page not found" (with `noindex`) under a 200 status instead of a 404.
- Cache Components (partial prerendering) is off. It hangs in the Workers runtime, and every page
  here reads D1 or the session per request anyway. Prerendered output is served from static
  assets (`open-next.config.ts`), so no cache bucket is needed.
- Every Cloudflare resource shares the `beamjoy-web-` prefix: Worker `beamjoy-web`, D1
  `beamjoy-web-db`, R2 `beamjoy-web-storage`. The bucket is general-purpose; screenshots live
  under `screenshots/`, and only that prefix is served publicly.
- Screenshots go through the Worker at `/uploads/...` with immutable cache headers. To serve them
  straight from R2 instead, give the bucket a public domain and set `STORAGE_PUBLIC_URL`.
