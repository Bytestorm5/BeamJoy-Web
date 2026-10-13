"use client";

import { useTransition } from "react";
import { deleteRoute } from "@/app/actions";

export function DeleteRouteButton({ slug, title }: { slug: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-ghost text-danger hover:text-danger"
      onClick={() => {
        if (confirm(`Delete “${title}”? This can’t be undone.`)) {
          start(() => deleteRoute(slug));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
