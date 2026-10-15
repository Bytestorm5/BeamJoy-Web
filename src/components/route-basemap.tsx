"use client";

import { useEffect, useState } from "react";
import { cropRoads, loadRoads } from "@/lib/road-layer";
import type { RouteGeometry } from "@/lib/sharecode/analyze";
import { RouteMap, routeView, type AerialLayer, type RoadLayer } from "./route-map";

/**
 * The route page's map with what's under it: the level's road map (when a linked game has
 * uploaded it) or the route's aerial shot from the game. Renders the plain map first, so nothing
 * waits on the download.
 */
export function RouteBasemap({
  geometry,
  level,
  aerial,
  title,
}: {
  geometry: RouteGeometry;
  level: string | null;
  aerial: AerialLayer | null;
  title: string;
}) {
  const [roads, setRoads] = useState<RoadLayer | null>(null);
  const [layer, setLayer] = useState<"roads" | "aerial">(aerial ? "aerial" : "roads");

  useEffect(() => {
    if (!level) return;
    let live = true;
    loadRoads(level).then((map) => {
      if (live && map) setRoads(cropRoads(map, routeView(geometry)));
    });
    return () => {
      live = false;
    };
  }, [level, geometry]);

  return (
    <div>
      <RouteMap
        geometry={geometry}
        className="w-full"
        title={title}
        roads={layer === "roads" ? roads : null}
        aerial={layer === "aerial" ? aerial : null}
      />
      {aerial && (
        <div className="mt-2 inline-flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Map background">
          {(["aerial", "roads"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layer === l}
              onClick={() => setLayer(l)}
              className={`rounded px-2.5 py-1 font-medium ${layer === l ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
            >
              {l === "aerial" ? "Aerial" : "Roads"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
