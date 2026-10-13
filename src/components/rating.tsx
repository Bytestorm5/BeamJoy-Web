"use client";

import Link from "@/components/link";
import { useState, useTransition } from "react";
import { voteRoute } from "@/app/actions";

type Props = {
  slug: string;
  likes: number;
  dislikes: number;
  myVote: -1 | 0 | 1;
  viewer: "signed-out" | "author" | "denied" | "voter";
};

function Thumb({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`size-4 ${down ? "rotate-180" : ""}`} aria-hidden fill="currentColor">
      <path d="M2 9.5A1.5 1.5 0 0 1 3.5 8H5v9H3.5A1.5 1.5 0 0 1 2 15.5v-6ZM7 17V8.4l3.6-5.9a1.3 1.3 0 0 1 2.4.9L12.3 7h3.9a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.4A1.8 1.8 0 0 1 15.1 17H7Z" />
    </svg>
  );
}

export function RatingButtons({ slug, likes, dislikes, myVote, viewer }: Props) {
  const [state, setState] = useState({ likes, dislikes, myVote });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = state.likes + state.dislikes;
  const pct = total ? Math.round((state.likes / total) * 100) : null;

  const vote = (v: 1 | -1) => {
    const next = state.myVote === v ? 0 : v;
    // Optimistic: adjust counts locally, then settle on the server's numbers.
    const prev = state;
    const adj = (n: number, side: 1 | -1) => n + (next === side ? 1 : 0) - (prev.myVote === side ? 1 : 0);
    setState({ likes: adj(prev.likes, 1), dislikes: adj(prev.dislikes, -1), myVote: next });
    setError(null);
    start(async () => {
      const res = await voteRoute(slug, next);
      setState({ likes: res.likes, dislikes: res.dislikes, myVote: res.myVote });
      if (res.error) setError(res.error);
    });
  };

  const btn = (v: 1 | -1) => {
    const active = state.myVote === v;
    const count = v === 1 ? state.likes : state.dislikes;
    const label = v === 1 ? "Like" : "Dislike";
    const cls = `btn border px-3 py-1.5 tabular-nums ${
      active
        ? v === 1
          ? "border-circuit bg-circuit/15 text-text"
          : "border-danger bg-danger/15 text-text"
        : "border-border bg-surface text-text-2 hover:border-border-strong hover:text-text"
    }`;
    if (viewer === "signed-out") {
      return (
        <Link href={`/signin?callbackUrl=/routes/${slug}`} className={cls} title={`Sign in to ${label.toLowerCase()}`}>
          <Thumb down={v === -1} /> {count}
          <span className="sr-only">{label}s. Sign in to rate.</span>
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => vote(v)}
        disabled={pending || viewer !== "voter"}
        aria-pressed={active}
        aria-label={`${label} (${count})`}
        title={viewer === "author" ? "You can't rate your own route" : viewer === "denied" ? "You can't rate routes" : label}
        className={cls}
      >
        <Thumb down={v === -1} /> {count}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {btn(1)}
        {btn(-1)}
        <span className="text-sm text-muted">
          {pct == null ? "No ratings" : `${pct}% liked`}
        </span>
      </div>
      {error && (
        <p role="status" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
