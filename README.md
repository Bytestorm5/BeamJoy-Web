# BeamJoy Routes

A catalog for sharing race routes built with [BeamJoy-Revived](https://github.com/foodcache3/BeamJoy-Revived),
the BeamMP server mod. Players paste a race **share code** from the in-game editor, pick the map (a
base-game level, or a mod map with a download link), add screenshots and a description, and everyone
else can browse, filter and copy the code back into their own server.

Built with Next.js 16 (App Router, Cache Components) and Tailwind CSS 4.

## What it does

- **Catalog** (`/`): paginated grid of routes, filterable by map, layout (circuit/sprint), surface,
  length, gates, corners, grid size, branching and tags, with sorting. Every filter lives in the URL,
  so filtered views can be linked.
- **Route pages** (`/routes/[id]`): screenshot gallery, a top-down route map drawn from the gate
  positions, an elevation profile, stats, the share code with a copy button, and the map download.
- **Submitting** (`/submit`): paste a code and the route is previewed and measured live in the
  browser. The server decodes and measures it again on submit and never trusts numbers sent by the
  browser. Screenshots are downscaled in the browser before upload.
- **Maps** (`/maps`): base-game maps and every mod map routes have been shared on, with download
  links.
- Accounts via Discord or GitHub (Auth.js). Authors can edit or delete their routes; `ADMIN_USER_IDS`
  can moderate any.

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
npm run db:migrate              # creates .data/beamjoy.db
npm run dev
```

With `AUTH_DEV_LOGIN=true`, the sign-in page has a name-only login for local testing (always off
in production).

To fill the catalog with sample data, seed it from BeamJoy-Revived's bundled races. They're
GPL-licensed, so they aren't copied into this repo; the script reads them from a checkout:

```bash
git clone --depth 1 https://github.com/foodcache3/BeamJoy-Revived ../BeamJoy-Revived
npm run db:seed -- ../BeamJoy-Revived
```

Checks:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new migration in
`drizzle/`.

## Deploying

The app needs a database and somewhere to put screenshots:

- **Database**: any libSQL URL. Locally that's a SQLite file; in production use
  [Turso](https://turso.tech) (`DATABASE_URL=libsql://…`, `DATABASE_AUTH_TOKEN=…`). Run
  `npm run db:migrate` against it once per schema change.
- **Screenshots**: set `BLOB_READ_WRITE_TOKEN` to store them in Vercel Blob. Without it they're
  written to `UPLOAD_DIR` (default `.data/uploads`), which only suits a server with a persistent
  disk.
- **Auth**: `AUTH_SECRET`, plus Discord and/or GitHub OAuth credentials. The callback URL is
  `<site>/api/auth/callback/<provider>`.

On Vercel, set those environment variables and deploy as usual. A self-hosted `next start` behind
a reverse proxy also works (set `AUTH_TRUST_HOST=true`).
