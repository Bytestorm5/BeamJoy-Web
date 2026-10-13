"use client";

import { useTransition } from "react";
import { deleteRoute } from "@/app/actions";

export function DeleteRouteButton({ routeId, title }: { routeId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-ghost text-danger hover:text-danger"
      onClick={() => {
        if (confirm(`Delete “${title}”? This removes the route and its screenshots for good.`)) {
          start(() => deleteRoute(routeId));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
