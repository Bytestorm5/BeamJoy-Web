import type { Metadata } from "next";
import Link from "@/components/link";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { UnlinkButton } from "@/components/unlink-button";
import { getViewer, isAccessDenied, requireReadAccount } from "@/lib/access";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Linked games", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">Linked games</h1>
      <p className="mt-2 mb-8 text-text-2">
        Games with <span className="font-medium text-text">BeamJoy Live</span> that act for your account.
      </p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface" />}>
        <Links />
      </Suspense>
    </div>
  );
}

/** A player links a handful of installs at most; the cap only guards the page. */
const MAX_SHOWN = 50;

async function Links() {
  let user;
  try {
    user = await requireReadAccount(await getViewer());
  } catch (e) {
    if (!isAccessDenied(e)) throw e;
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <Link href="/signin?callbackUrl=/account" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }
  const links = await getDb()
    .select({
      id: schema.gameTokens.id,
      playerName: schema.gameTokens.playerName,
      createdAt: schema.gameTokens.createdAt,
      lastUsedAt: schema.gameTokens.lastUsedAt,
    })
    .from(schema.gameTokens)
    .where(eq(schema.gameTokens.userId, user.id))
    .orderBy(desc(schema.gameTokens.createdAt))
    .limit(MAX_SHOWN);

  if (!links.length) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center text-muted">
        None yet. In game, open BeamJoy Live (Shift+F4) and pick Link account.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {links.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{l.playerName || "BeamNG"}</p>
            <p className="text-sm text-muted">
              Linked {formatDate(l.createdAt)}
              {l.lastUsedAt ? ` · last used ${formatDate(l.lastUsedAt)}` : ""}
            </p>
          </div>
          <UnlinkButton id={l.id} />
        </li>
      ))}
    </ul>
  );
}
