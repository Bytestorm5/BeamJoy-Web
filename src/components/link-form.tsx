"use client";

import { useActionState } from "react";
import { approveGameLink } from "@/app/link/actions";

export function LinkForm({ code, playerName }: { code: string; playerName: string | null }) {
  const [state, action, pending] = useActionState(approveGameLink, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="link-code" className="label">
          Code from the game
        </label>
        <input
          id="link-code"
          name="code"
          defaultValue={code}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-2345"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "link-error" : undefined}
          className="field font-mono text-2xl tracking-[0.2em] uppercase"
        />
      </div>
      {playerName && (
        <p className="text-sm text-text-2">
          Requested by BeamMP player <span className="font-medium text-text">{playerName}</span>.
        </p>
      )}
      {state.error && (
        <p id="link-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Linking…" : "Link this game"}
      </button>
    </form>
  );
}
