import type { Metadata } from "next";
import Link from "@/components/link";
import { Suspense } from "react";
import { LinkForm } from "@/components/link-form";
import { getViewer, isAccessDenied, requireLinkGame } from "@/lib/access";
import { normalizeUserCode, pendingLink } from "@/lib/game/link";

export const metadata: Metadata = { title: "Link the game", robots: { index: false } };

export default function LinkPage({ searchParams }: PageProps<"/link">) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase">Link the game</h1>
      <p className="mt-2 mb-8 text-text-2">
        Lets BeamJoy Live upload routes and post lap times as you.
      </p>
      <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-surface" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/link">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="font-display text-2xl font-semibold uppercase">Linked</p>
        <p className="mt-1 text-text-2">Back to the game. It picks this up in a few seconds.</p>
        <Link href="/account" className="btn-secondary mt-5">
          Linked games
        </Link>
      </div>
    );
  }

  const raw = typeof sp.code === "string" ? sp.code : "";
  const code = normalizeUserCode(raw) ?? "";
  try {
    await requireLinkGame(await getViewer());
  } catch (e) {
    if (!isAccessDenied(e)) throw e;
    if (e.reason !== "unauthenticated") {
      return <p className="rounded-xl border border-border bg-surface p-6">Your account can&apos;t link the game.</p>;
    }
    const back = `/link${code ? `?code=${code}` : ""}`;
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-text-2">Sign in to the account the game should use.</p>
        <Link href={`/signin?callbackUrl=${encodeURIComponent(back)}`} className="btn-primary mt-5 w-full">
          Sign in
        </Link>
      </div>
    );
  }

  const pending = code ? await pendingLink(code) : null;
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <LinkForm code={code} playerName={pending?.playerName || null} />
    </div>
  );
}
