"use client";

import { useState } from "react";
import { trackRouteEvent } from "@/app/actions";

export function CopyCode({ slug, code }: { slug: string; code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
      trackRouteEvent(slug, "copy").catch(() => {});
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        readOnly
        value={code}
        rows={4}
        aria-label="Share code"
        onFocus={(e) => e.currentTarget.select()}
        className="field resize-none font-mono text-xs leading-relaxed break-all text-text-2"
      />
      <button type="button" onClick={copy} className="btn-primary w-full py-2.5">
        {state === "copied" ? "Copied!" : state === "failed" ? "Copy failed. Select and copy." : "Copy share code"}
      </button>
      <p className="sr-only" aria-live="polite">
        {state === "copied" ? "Share code copied to clipboard" : ""}
      </p>
    </div>
  );
}
