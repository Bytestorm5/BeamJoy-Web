import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions";
import { currentUser } from "@/auth";

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="BeamJoy Routes home">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-accent" />
        <path
          d="M7 23c3.5 0 4-6 8-6s3.5 4 6.5 4S25 10 25 9"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="7" cy="23" r="2.3" fill="var(--accent-ink)" />
      </svg>
      <span className="font-display text-xl leading-none font-bold tracking-wide whitespace-nowrap uppercase">
        BeamJoy <span className="hidden text-muted group-hover:text-text-2 min-[400px]:inline">Routes</span>
      </span>
    </Link>
  );
}

async function UserMenu() {
  const user = await currentUser();
  if (!user) {
    return (
      <Link href="/signin" className="btn-ghost whitespace-nowrap">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/u/${encodeURIComponent(user.id)}`}
        className="btn-ghost max-w-40 px-2"
        title="Your routes"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-xs font-bold">
            {user.name?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        <span className="hidden truncate sm:inline">{user.name}</span>
      </Link>
      <form action={signOutAction}>
        <button className="btn-ghost px-2 text-xs">Sign out</button>
      </form>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <Link href="/" className="btn-ghost">
            Browse
          </Link>
          <Link href="/maps" className="btn-ghost">
            Maps
          </Link>
          <Link href="/how-it-works" className="btn-ghost">
            How it works
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<span className="h-9 w-20" />}>
            <UserMenu />
          </Suspense>
          <Link href="/submit" className="btn-primary">
            <span aria-hidden className="text-base leading-none">+</span>
            <span>
              Share<span className="hidden sm:inline"> a route</span>
            </span>
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 border-t border-border px-2 py-1 md:hidden">
        <Link href="/" className="btn-ghost px-3 py-1.5">
          Browse
        </Link>
        <Link href="/maps" className="btn-ghost px-3 py-1.5">
          Maps
        </Link>
        <Link href="/how-it-works" className="btn-ghost px-3 py-1.5">
          How it works
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Routes for{" "}
          <a
            className="text-text-2 underline-offset-2 hover:underline"
            href="https://github.com/foodcache3/BeamJoy-Revived"
          >
            BeamJoy-Revived
          </a>
          , the BeamMP server mod. Not affiliated with BeamNG GmbH.
        </p>
        <a className="hover:text-text-2" href="https://github.com/Bytestorm5/BeamJoy-Web">
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
