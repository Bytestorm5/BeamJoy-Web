"use client";

import { useState } from "react";

/** Main image plus a thumbnail strip. Capped at LIMITS.images, so the strip never runs long. */
export function Gallery({ images, title }: { images: { id: string; url: string }[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  if (!current) return null;
  return (
    <div className="flex flex-col gap-2">
      <a
        href={current.url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-border bg-surface-2"
        title="Open full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={`${title}, screenshot ${active + 1} of ${images.length}`}
          className="aspect-video w-full object-cover"
        />
      </a>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="tablist" aria-label="Screenshots">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Screenshot ${i + 1}`}
              onClick={() => setActive(i)}
              className={`overflow-hidden rounded-md border-2 transition-opacity ${
                i === active ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
