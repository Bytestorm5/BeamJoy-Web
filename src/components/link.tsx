"use client";

import NextLink, { type LinkProps } from "next/link";
import { useState, type AnchorHTMLAttributes, type ReactNode } from "react";

export type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "prefetch"> & { children?: ReactNode };

/**
 * `next/link` that prefetches on hover/touch instead of when it scrolls into view.
 *
 * Every page here is rendered per request. Viewport prefetching would fire one server render per
 * visible link (24 route cards, pagination, chips…) the moment the catalog loads; hover caps that
 * to the link the user is actually about to click. And because each dynamic segment has a
 * loading.tsx, an auto prefetch only renders the layout and skeleton, never the page's D1
 * queries. Same pattern as ASL-LMS's PrefetchLink (Next's documented fix for viewport fan-out,
 * docs: app/guides/prefetching#preventing-too-many-prefetches).
 */
export default function Link({ onMouseEnter, onTouchStart, ...rest }: PrefetchLinkProps) {
  const [active, setActive] = useState(false);
  return (
    <NextLink
      {...rest}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
