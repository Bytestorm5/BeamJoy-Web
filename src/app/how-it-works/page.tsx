import type { Metadata } from "next";
import Link from "@/components/link";

export const metadata: Metadata = { title: "How it works" };

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[2rem_1fr] items-baseline gap-2 text-text-2">
          <span className="font-display text-2xl leading-none font-bold text-accent tabular-nums">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-medium text-text">{children}</strong>;

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">How it works</h1>
      <p className="mt-2 text-text-2">
        BeamJoy-Revived packs a whole race into one share code. This site collects them.
      </p>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">Play a route</h2>
        <Steps
          items={[
            <>
              Find one in the <Link href="/" className="text-accent hover:underline">catalog</Link>. Mod maps
              need installing first.
            </>,
            <>
              Click <B>Copy share code</B>.
            </>,
            <>
              In-game: <B>Server Configuration → Races → New race → Import from Code</B>, paste, save.
            </>,
          ]}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">Share one</h2>
        <Steps
          items={[
            <>
              In the race editor, click <B>Copy Share Code</B>.
            </>,
            <>
              Paste it on <Link href="/submit" className="text-accent hover:underline">Share a route</Link>.
            </>,
            <>Pick the map and add screenshots.</>,
          ]}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">The numbers</h2>
        <dl className="grid gap-3 text-text-2">
          <div>
            <dt className="font-medium text-text">Length</dt>
            <dd>Gate to gate in straight lines, so roads run a little longer. Circuits show one lap.</dd>
          </div>
          <div>
            <dt className="font-medium text-text">Corners</dt>
            <dd>Turns of 35°+ at the gates (130°+ is a hairpin). An estimate; authors can correct it.</dd>
          </div>
          <div>
            <dt className="font-medium text-text">Gates, grid, sectors, laps</dt>
            <dd>Straight from the code.</dd>
          </div>
          <div>
            <dt className="font-medium text-text">Props</dt>
            <dd>Counted like the game&apos;s prop budget: a line counts each prop, a curb or painted line one per 20 segments.</dd>
          </div>
        </dl>
      </section>

      <section id="live" className="mt-10 scroll-mt-24">
        <h2 className="mb-4 font-display text-2xl font-semibold uppercase">BeamJoy Live</h2>
        <p className="mb-4 text-text-2">
          A mod that connects your server&apos;s BeamJoy-Revived to this site. The host installs it; players just link
          their account once.
        </p>
        <Steps
          items={[
            <>
              Host: drop <B>BeamJoyLive.zip</B> next to BeamJoy in <B>Resources/Client</B>, and the
              <B> BeamJoyLive</B> folder in <B>Resources/Server</B>. Get them from{" "}
              <a href="https://github.com/Bytestorm5/BeamJoy-Revived-Live/releases" className="text-accent hover:underline">
                GitHub
              </a>
              .
            </>,
            <>
              Player: press <B>Shift+F4</B>, pick <B>Link account</B>, approve the code in the browser that opens.
            </>,
            <>
              Upload a race with every detail from the <B>Upload</B> tab, aerial shot included. Laps you drive on listed
              routes go to their leaderboards.
            </>,
            <>
              Hosts can share where everyone is on <Link href="/live" className="text-accent hover:underline">Live</Link>
              {" "}(off by default).
            </>,
          ]}
        />
      </section>
    </div>
  );
}
