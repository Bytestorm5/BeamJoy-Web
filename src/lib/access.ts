import "server-only";
import { AccessDeniedError, isAccessDenied, type PrincipalRef } from "@alfiz/core";
import { cache } from "react";
import { currentUser } from "@/auth";
import { alfizClient } from "@/lib/alfiz/app";

/**
 * Every authorization decision in the app, backed by Alfiz (catalog: lib/alfiz/catalog.ts).
 * Pages, server actions and conditional UI all ask these functions, so a page never shows a
 * control its action would refuse. Gate names are registered in alfiz-verify.config.json.
 *
 * Signing in (authentication) is separate: a gate that needs an author refuses signed-out
 * visitors with `reason: "unauthenticated"` before asking Alfiz.
 */

/** Signed-out visitors check as this principal; they still get `everyone` grants. */
const ANONYMOUS: PrincipalRef = { userId: "anonymous" };

export type Viewer = {
  user: Awaited<ReturnType<typeof currentUser>>;
  principal: PrincipalRef;
};

/** Who is asking, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await currentUser();
  return { user, principal: user ? { userId: user.id } : ANONYMOUS };
});

/** What a route gate needs to know about the route. */
export type RouteRef = { id: string; authorId: string };

const routeScope = (route: RouteRef) => `bj.route:${route.id}` as const;
const isAuthor = (viewer: Viewer, route: RouteRef) => !!viewer.user && viewer.user.id === route.authorId;

function requireSignedIn(viewer: Viewer, permission: string): asserts viewer is Viewer & { user: NonNullable<Viewer["user"]> } {
  if (!viewer.user) throw new AccessDeniedError({ reason: "unauthenticated", permission });
}

export { isAccessDenied };

export async function requireReadRoutes(viewer: Viewer) {
  await (await alfizClient()).require(viewer.principal, "bj.routes.read");
}

export async function requireCreateRoute(viewer: Viewer) {
  requireSignedIn(viewer, "bj.routes.create");
  await (await alfizClient()).require(viewer.principal, "bj.routes.create");
  return viewer.user;
}

export async function requireUpdateRoute(viewer: Viewer, route: RouteRef) {
  requireSignedIn(viewer, "bj.routes.update");
  const alfiz = await alfizClient();
  const scope = routeScope(route);
  const allowed =
    (await alfiz.can(viewer.principal, "bj.routes.update", scope)) ||
    (await alfiz.can(viewer.principal, "bj.routes.update_own", scope, { condition: () => isAuthor(viewer, route) }));
  if (!allowed) throw new AccessDeniedError({ reason: "forbidden", permission: "bj.routes.update", scope });
}

/** Destructive, so both checks bypass the caches. */
export async function requireDeleteRoute(viewer: Viewer, route: RouteRef) {
  requireSignedIn(viewer, "bj.routes.delete");
  const alfiz = await alfizClient();
  const scope = routeScope(route);
  const allowed =
    (await alfiz.can.fresh(viewer.principal, "bj.routes.delete", scope)) ||
    (await alfiz.can.fresh(viewer.principal, "bj.routes.delete_own", scope, {
      condition: () => isAuthor(viewer, route),
    }));
  if (!allowed) throw new AccessDeniedError({ reason: "forbidden", permission: "bj.routes.delete", scope });
}

/** Signed-in, and not your own route. */
export async function requireRateRoute(viewer: Viewer, route: RouteRef) {
  requireSignedIn(viewer, "bj.routes.rate_route");
  await (await alfizClient()).require(viewer.principal, "bj.routes.rate_route", routeScope(route), {
    condition: () => !isAuthor(viewer, route),
  });
}

/** Views and share-code copies; open to everyone by default. */
export async function requireRecordActivity(viewer: Viewer) {
  await (await alfizClient()).require(viewer.principal, "bj.routes.record_activity");
}

/** Which controls a route page shows. One snapshot, so every answer comes from the same instant. */
export async function routeControls(viewer: Viewer, route: RouteRef) {
  if (!viewer.user) return { edit: false, delete: false, rate: false };
  const scope = routeScope(route);
  const snap = await (await alfizClient()).snapshot(viewer.principal);
  const own = isAuthor(viewer, route);
  return {
    edit:
      snap.can("bj.routes.update", scope) || snap.can("bj.routes.update_own", scope, { condition: () => own }),
    delete:
      snap.can("bj.routes.delete", scope) || snap.can("bj.routes.delete_own", scope, { condition: () => own }),
    rate: snap.can("bj.routes.rate_route", scope, { condition: () => !own }),
  };
}
