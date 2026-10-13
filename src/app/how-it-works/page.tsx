import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-3">
      <span className="font-display text-3xl leading-none font-bold text-accent tabular-nums">{n}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 text-text-2">{children}</div>
      </div>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">How it works</h1>
      <p className="mt-2 text-text-2">
        BeamJoy-Revived can pack a whole race (every gate, the starting grid, branches and sectors) into
        a single line of text. This site is a catalog of those codes.
      </p>

      <section className="mt-10">
        <h2 className="mb-5 font-display text-2xl font-semibold uppercase">Play a route</h2>
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Find one">
            Filter the <Link href="/" className="text-accent hover:underline">catalog</Link> by map, length,
            gates, corners or grid size. If it&apos;s on a mod map, install that map on your server first.
          </Step>
          <Step n={2} title="Copy the code">
            Each route page has a <strong className="text-text">Copy share code</strong> button.
          </Step>
          <Step n={3} title="Import it in-game">
            On your BeamJoy server, open <strong className="text-text">Server Configuration → Races</strong>,
            click <strong className="text-text">New race</strong>, then{" "}
            <strong className="text-text">Import from Code</strong>. Paste, check it over and save.
          </Step>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-semibold uppercase">Share your own</h2>
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Export from the race editor">
            Open your race in the editor and click <strong className="text-text">Copy Share Code</strong>.
          </Step>
          <Step n={2} title="Paste it here">
            On <Link href="/submit" className="text-accent hover:underline">Share a route</Link>, paste the code.
            You&apos;ll see the layout and stats right away.
          </Step>
          <Step n={3} title="Add the map and some screenshots">
            Pick the base-game map, or name the mod map and link its download. Screenshots and a short
            description help people choose.
          </Step>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">Where the numbers come from</h2>
        <dl className="grid gap-4 text-text-2">
          <div>
            <dt className="font-semibold text-text">Length / lap length</dt>
            <dd>
              Straight-line distance gate to gate along the route. Circuits include the run from the last
              gate back to the first, so it&apos;s a true lap. Roads curve between gates, so the real
              driving distance is a bit longer. Branching routes show the shortest and longest way through.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Corners and hairpins</dt>
            <dd>
              Estimated from how sharply the route turns at each gate. Turns of 35° or more count as a
              corner (130°+ is a hairpin). Bends right after one another count as one corner. Authors
              can override the number if gates are sparse.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Gates, grid slots, sectors, laps</dt>
            <dd>Read straight from the code: the race&apos;s gates, starting positions, sector count and default laps.</dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Climb</dt>
            <dd>Total height gained gate to gate over one run or lap.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
