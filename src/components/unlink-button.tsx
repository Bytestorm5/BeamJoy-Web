"use client";

import { useTransition } from "react";
import { unlinkGame } from "@/app/account/actions";

export function UnlinkButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-ghost shrink-0 text-danger hover:text-danger"
      onClick={() => start(() => unlinkGame(id))}
    >
      {pending ? "Unlinking…" : "Unlink"}
    </button>
  );
}
