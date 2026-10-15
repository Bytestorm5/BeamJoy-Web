import type { Metadata } from "next";
import Link from "@/components/link";
import { notFound } from "next/navigation";
import { LiveMap } from "@/components/live-map";
import { getViewer, requireReadLive } from "@/lib/access";
import { getLive } from "@/lib/live";

export async function generateMetadata({ params }: PageProps<"/live/[slug]">): Promise<Metadata> {
  const session = await getLive((await params).slug);
  return { title: session ? `${session.serverName} · Live` : "Session not found", robots: { index: false } };
}

export default async function LiveSessionPage({ params }: PageProps<"/live/[slug]">) {
  await requireReadLive(await getViewer());
  const session = await getLive((await params).slug);
  if (!session) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/live" className="hover:text-text">
          Live
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight break-words uppercase sm:text-5xl">{session.serverName}</h1>
        <p className="mt-1 text-text-2">{session.mapName}</p>
      </header>
      <LiveMap initial={session} />
    </div>
  );
}
