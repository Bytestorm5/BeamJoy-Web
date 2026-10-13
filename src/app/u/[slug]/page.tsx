import { notFound } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { RouteCard } from "@/components/route-card";
import { parseFilters } from "@/lib/filters";
import { pluralize } from "@/lib/format";
import { userPath } from "@/lib/paths";
import { getUser, searchRoutes } from "@/lib/queries";

export default async function UserPage({ params, searchParams }: PageProps<"/u/[slug]">) {
  const user = await getUser((await params).slug);
  if (!user) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <UserRoutes user={user} searchParams={searchParams} />
    </div>
  );
}

async function UserRoutes({
  user,
  searchParams,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  searchParams: PageProps<"/u/[slug]">["searchParams"];
}) {
  const filters = { ...parseFilters(await searchParams), author: user.slug };
  const result = await searchRoutes(filters);
  const base = userPath(user.slug);

  return (
    <>
      <header className="mb-8 flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-14 rounded-full" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 font-display text-2xl font-bold">
            {user.name[0]?.toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight uppercase">{user.name}</h1>
          <p className="text-text-2">
            {pluralize(result.total, "route")}
          </p>
        </div>
      </header>
      {result.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-muted">
          No routes yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((r) => (
            <RouteCard key={r.slug} route={r} />
          ))}
        </div>
      )}
      <div className="mt-10">
        <Pagination
          page={Math.min(filters.page, result.pages)}
          pages={result.pages}
          href={(p) => (p > 1 ? `${base}?page=${p}` : base)}
        />
      </div>
    </>
  );
}
