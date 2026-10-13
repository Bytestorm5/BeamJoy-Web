# BeamJoy Routes: working rules

@AGENTS.md

## URLs use slugs

Every public URL addresses its page by slug, never by database id: `/routes/<slug>`,
`/maps/<slug>`, `/u/<slug>`. Build URLs only with `src/lib/paths.ts`, and allocate new slugs with
`freeSlug` (`src/lib/queries.ts`). Slugs are set once and don't change when a title or name does.
Ids stay on the server: client components and server-action arguments carry slugs, and the server
resolves the id. Use an id in a URL only for a stated reason.

## Authorization goes through Alfiz

- Every permission is a key in `src/lib/alfiz/catalog.ts`. Every decision is a gate in
  `src/lib/access.ts`. Pages, server actions, route handlers and conditional UI call those gates,
  never `user.id === x` comparisons of their own.
- Ownership is a condition on an `*_own` key, not a grant.
- New permission: add the key (and to a built-in role if everyone should have it), add a gate in
  `lib/access.ts`, list the gate in `alfiz-verify.config.json`, then run `npm run authz`.
- `npm run authz` runs before every build. An ungated server action or route handler fails it.
  Authentication-only files opt out with `// alfiz-verify-ignore-file <reason>`.
- Alfiz stores its data in D1 through `src/lib/alfiz/d1-driver.ts`, tested against Alfiz's own
  driver contract suite.

## Copy

Short and plain. Say it once, in as few words as reads naturally. No filler sentences
explaining what the UI already shows.

## Pages and data

- Links use `@/components/link` (hover prefetch). Each dynamic route has a `loading.tsx`, so a
  prefetch never runs the page's D1 queries.
- Never stack two lists that can grow without bound on one page. Paginate, or give each list
  its own page.
- Schema changes: edit `src/db/*.ts`, `npm run db:generate`, check the SQL (SQLite can't add a
  NOT NULL column without a default), `npm run db:migrate:local`, and apply it to production
  before the code that needs it deploys.
