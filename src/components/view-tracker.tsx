"use client";

import { useEffect, useRef } from "react";
import { trackRouteEvent } from "@/app/actions";

/** Records one page view after hydration, so prefetches and crawlers don't count. */
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackRouteEvent(slug, "view").catch(() => {});
  }, [slug]);
  return null;
}
