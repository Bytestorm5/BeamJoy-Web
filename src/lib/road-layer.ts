import type { Vec2 } from "@/lib/sharecode/analyze";
import type { RoadLayer } from "@/components/route-map";

/**
 * Client-side half of level road maps (server half: lib/roads.ts): fetch a level's road graph
 * once per page and crop it to the box a map shows. Roads are grouped by width so a map draws a
 * handful of paths, not thousands of lines.
 */

type RoadMap = { v: 1; nodes: [number, number, number, number][]; edges: [number, number][] };

const cache = new Map<string, Promise<RoadMap | null>>();

export function loadRoads(level: string): Promise<RoadMap | null> {
  let p = cache.get(level);
  if (!p) {
    p = fetch(`/api/levels/${encodeURIComponent(level)}/roads`)
      .then((r) => (r.ok ? (r.json() as Promise<RoadMap>) : null))
      .catch(() => null);
    cache.set(level, p);
  }
  return p;
}

/** Edges touching `box` (plus a margin), joined into polylines and grouped by rounded width. */
export function cropRoads(map: RoadMap, box: [number, number, number, number], margin = 50): RoadLayer {
  const [minX, minY, maxX, maxY] = [box[0] - margin, box[1] - margin, box[2] + margin, box[3] + margin];
  const inside = (i: number) => {
    const [x, y] = map.nodes[i];
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };
  const groups = new Map<number, Vec2[][]>();
  for (const [a, b] of map.edges) {
    if (!inside(a) && !inside(b)) continue;
    const na = map.nodes[a];
    const nb = map.nodes[b];
    // Road radius at each end; the drawn width is the full road, rounded to 2 m steps.
    const width = Math.max(2, Math.round(na[3] + nb[3]) & ~1);
    const line: Vec2[] = [
      [na[0], na[1]],
      [nb[0], nb[1]],
    ];
    const list = groups.get(width);
    if (list) list.push(line);
    else groups.set(width, [line]);
  }
  // Wide roads first, so narrow ones draw on top where they meet.
  return [...groups.entries()].sort((x, y) => y[0] - x[0]).map(([width, d]) => ({ width, d }));
}
