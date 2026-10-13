import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWith } from "@/app/actions";
import { devLoginEnabled, providerList } from "@/auth";

export const metadata: Metadata = { title: "Sign in" };

const PROVIDER_STYLE: Record<string, string> = {
  discord: "bg-[#5865F2] text-white hover:bg-[#4752c4]",
  github: "bg-[#24292f] text-white hover:bg-[#32383f] dark:border dark:border-border-strong",
};

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <div className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase">Sign in</h1>
      <p className="mt-2 mb-8 text-text-2">Sign in to share routes and edit the ones you&apos;ve posted.</p>
      <Suspense>
        <Providers searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Providers({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/";
  const oauth = providerList.filter((p) => p.id !== "dev");

  return (
    <div className="flex flex-col gap-3">
      {sp.error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}
      {oauth.map((p) => (
        <form key={p.id} action={signInWith.bind(null, p.id, callbackUrl)}>
          <button className={`btn w-full py-2.5 ${PROVIDER_STYLE[p.id] ?? "btn-secondary"}`}>
            Continue with {p.name}
          </button>
        </form>
      ))}
      {devLoginEnabled && (
        <form
          action={signInWith.bind(null, "dev", callbackUrl)}
          className="mt-2 rounded-xl border border-dashed border-border-strong p-4"
        >
          <label htmlFor="dev-name" className="label">
            Dev login (local only)
          </label>
          <div className="flex gap-2">
            <input id="dev-name" name="name" required placeholder="Display name" className="field" />
            <button className="btn-secondary">Go</button>
          </div>
        </form>
      )}
      {!oauth.length && !devLoginEnabled && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          No sign-in providers are configured. Set AUTH_DISCORD_ID and AUTH_DISCORD_SECRET (or the
          GitHub equivalents) on the server.
        </p>
      )}
    </div>
  );
}
