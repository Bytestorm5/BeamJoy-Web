import { countProps } from "./props";
import type { RacePayload } from "./race";

/**
 * Everything the catalog knows about a route is derived here from the decoded share code, on the
 * server at submit time (client-side for the live preview only, never trusted). Mirrors the
 * game's own gate-graph semantics from BeamJoyServer/services/races.lua:
 *  - with branching off, gates are a plain line (parents = previous gate, last gate = finish);
 *  - with branching on, `parents` (1-based gate indices, 0 = the start grid) define a DAG, the
 *    step of a gate is 1 + the highest step among its parents, and `isFinish` flags finish gates;
 *  - a loopable race's lap ends by re-crossing the step-1 gate.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type RouteGeometry = {
  /** Gate centres, rounded to 0.1 m. */
  gates: Vec3[];
  /** Per gate, 0-based indices of the gates it can be reached from (-1 = start grid). */
  parents: number[][];
  /** 0-based gate indices of the shortest full route (one lap for circuits). */
  primary: number[];
  start: Vec2[];
  loop: boolean;
};

export type RouteStats = {
  /** Shortest full route (one lap for circuits), meters. */
  distanceM: number;
  /** Longest full route when branches differ, meters. */
  maxDistanceM: number;
  checkpoints: number;
  /** Ordinal steps per lap (differs from checkpoints only on branching routes). */
  steps: number;
  corners: number;
  hairpins: number;
  gridSlots: number;
  loopable: boolean;
  branching: boolean;
  sectors: number;
  defaultLaps: number | null;
  mode: string;
  elevationGainM: number;
  elevationRangeM: number;
  /** Weighted like the game's prop budget (see props.ts). */
  props: number;
};

export type RouteAnalysis = { stats: RouteStats; geometry: RouteGeometry };

const round1 = (n: number) => Math.round(n * 10) / 10;

function dist3(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Normalize the gate graph exactly as the game's sanitizeRace does. */
function buildGraph(race: RacePayload) {
  const n = race.gates.length;
  const branching = !!race.branchingEnabled;
  const loop = !!race.loopable;
  const parents: number[][] = race.gates.map((g, i) => {
    if (!branching) return [i - 1];
    const raw = (g.parents ?? [i]).filter((p) => Number.isInteger(p) && p >= 0 && p <= n && p !== i + 1);
    const mapped = [...new Set(raw.map((p) => p - 1))];
    return mapped.length ? mapped : [i - 1];
  });

  // Steps: 1 + max parent step. Iterate to a fixed point (bounded, so a malformed cyclic graph
  // can't hang the server).
  const steps = new Array<number>(n).fill(1);
  for (let iter = 0; iter < n + 1; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let s = 1;
      for (const p of parents[i]) if (p >= 0) s = Math.max(s, steps[p] + 1);
      if (s > n) s = n;
      if (s !== steps[i]) {
        steps[i] = s;
        changed = true;
      }
    }
    if (!changed) break;
  }

  let finish: number[];
  if (!branching) {
    finish = [n - 1];
  } else if (loop) {
    // A lap closes from the end of the gate graph back to step 1: every gate nothing follows.
    const hasChild = new Array<boolean>(n).fill(false);
    parents.forEach((ps) => ps.forEach((p) => p >= 0 && (hasChild[p] = true)));
    finish = [...Array(n).keys()].filter((i) => !hasChild[i]);
  } else {
    finish = race.gates.flatMap((g, i) => (g.isFinish ? [i] : []));
  }
  if (!finish.length) finish = [n - 1];

  return { parents, steps, finish, loop, branching };
}

/**
 * Shortest and longest start-to-finish routes through the gate DAG. The grid-to-first-gate run
 * isn't counted (matching the game's own distance figure); for circuits the closing stretch back
 * to the step-1 gate is, so the result is a true lap length.
 */
function routeExtremes(gates: Vec3[], graph: ReturnType<typeof buildGraph>) {
  const n = gates.length;
  const order = [...Array(n).keys()].sort((a, b) => graph.steps[a] - graph.steps[b] || a - b);
  const sources = order.filter((i) => graph.parents[i].includes(-1));
  const best = new Array<number>(n).fill(Infinity);
  const worst = new Array<number>(n).fill(-Infinity);
  const prev = new Array<number>(n).fill(-2);

  for (const i of order) {
    for (const p of graph.parents[i]) {
      if (p === -1) {
        if (0 < best[i]) {
          best[i] = 0;
          prev[i] = -1;
        }
        worst[i] = Math.max(worst[i], 0);
      } else if (graph.steps[p] < graph.steps[i] && Number.isFinite(best[p])) {
        const d = dist3(gates[p], gates[i]);
        if (best[p] + d < best[i]) {
          best[i] = best[p] + d;
          prev[i] = p;
        }
        worst[i] = Math.max(worst[i], worst[p] + d);
      }
    }
  }

  const closing = (i: number) =>
    graph.loop && sources.length && !sources.includes(i)
      ? Math.min(...sources.map((s) => dist3(gates[i], gates[s])))
      : 0;

  let minTotal = Infinity;
  let maxTotal = 0;
  let end = -1;
  for (const f of graph.finish) {
    if (!Number.isFinite(best[f])) continue;
    const c = closing(f);
    if (best[f] + c < minTotal) {
      minTotal = best[f] + c;
      end = f;
    }
    maxTotal = Math.max(maxTotal, worst[f] + c);
  }

  const primary: number[] = [];
  if (end >= 0) {
    for (let i = end, guard = 0; i >= 0 && guard <= n; i = prev[i], guard++) primary.push(i);
    primary.reverse();
  } else {
    // Unreachable finish (malformed graph): fall back to array order so we still show something.
    primary.push(...Array(n).keys());
    minTotal = 0;
    for (let i = 1; i < n; i++) minTotal += dist3(gates[i - 1], gates[i]);
    maxTotal = minTotal;
  }
  return { minTotal, maxTotal: Math.max(maxTotal, minTotal), primary };
}

const MIN_VERTEX_TURN = (5 * Math.PI) / 180;
const MIN_CORNER_TURN = (35 * Math.PI) / 180;
const MIN_HAIRPIN_TURN = (130 * Math.PI) / 180;
/** Same-direction turns closer than this are one corner (a hairpin authored with several gates). */
const MERGE_GAP_M = 40;
/** Gentle bends further apart can still add up to one long sweeper. */
const SWEEPER_GAP_M = 100;

/**
 * Corner estimate from the top-down racing line through the gates. Same-direction turns close
 * together merge into one corner (so a hairpin authored with three gates still counts once), as do
 * gentle bends that only add up to a corner together (a long sweeper); opposite turns always split.
 * Only an estimate: gates only sample the line, so authors can override it.
 */
export function countCorners(points: Vec2[], closed: boolean) {
  const pts: Vec2[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.5) pts.push(p);
  }
  if (closed && pts.length > 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1.5) pts.pop();
  }
  const n = pts.length;
  if (n < 3) return { corners: 0, hairpins: 0 };

  const segLen = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const heading = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };

  // Turn at each vertex, with the path distance travelled since the previous vertex.
  type Turn = { angle: number; gapBefore: number };
  const turns: Turn[] = [];
  if (closed) {
    // Start right after the longest segment so no corner straddles the wrap-around.
    let longest = 0;
    for (let i = 1; i < n; i++) if (segLen(i) > segLen(longest)) longest = i;
    for (let k = 1; k <= n; k++) {
      const v = (longest + k) % n;
      const before = (v - 1 + n) % n;
      let a = heading(v) - heading(before);
      a = Math.atan2(Math.sin(a), Math.cos(a));
      turns.push({ angle: a, gapBefore: segLen(before) });
    }
  } else {
    for (let v = 1; v < n - 1; v++) {
      let a = heading(v) - heading(v - 1);
      a = Math.atan2(Math.sin(a), Math.cos(a));
      turns.push({ angle: a, gapBefore: segLen(v - 1) });
    }
  }

  let corners = 0;
  let hairpins = 0;
  let groupSum = 0;
  let sinceLast = Infinity;
  const flush = () => {
    if (Math.abs(groupSum) >= MIN_CORNER_TURN) corners++;
    if (Math.abs(groupSum) >= MIN_HAIRPIN_TURN) hairpins++;
    groupSum = 0;
  };
  for (const t of turns) {
    sinceLast += t.gapBefore;
    if (Math.abs(t.angle) < MIN_VERTEX_TURN) continue;
    const sameDir = groupSum !== 0 && Math.sign(t.angle) === Math.sign(groupSum);
    const sweeper = Math.abs(t.angle) < MIN_CORNER_TURN && sinceLast <= SWEEPER_GAP_M;
    if (!sameDir || (sinceLast > MERGE_GAP_M && !sweeper)) flush();
    groupSum += t.angle;
    sinceLast = 0;
  }
  flush();
  return { corners, hairpins };
}

export function analyzeRace(race: RacePayload): RouteAnalysis {
  const gates: Vec3[] = race.gates.map((g) => [round1(g.pos.x), round1(g.pos.y), round1(g.pos.z)]);
  const graph = buildGraph(race);
  const { minTotal, maxTotal, primary } = routeExtremes(gates, graph);

  const line = primary.map((i) => gates[i]);
  const { corners, hairpins } = countCorners(
    line.map(([x, y]) => [x, y] as Vec2),
    graph.loop,
  );

  let gain = 0;
  let zMin = Infinity;
  let zMax = -Infinity;
  const loopLine = graph.loop && line.length > 1 ? [...line, line[0]] : line;
  for (let i = 0; i < loopLine.length; i++) {
    const z = loopLine[i][2];
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
    if (i > 0 && z > loopLine[i - 1][2]) gain += z - loopLine[i - 1][2];
  }

  const laps = race.defaults?.laps;
  return {
    stats: {
      distanceM: Math.round(minTotal),
      maxDistanceM: Math.round(maxTotal),
      checkpoints: race.gates.length,
      steps: Math.max(...graph.steps),
      corners,
      hairpins,
      gridSlots: race.startPositions.length,
      loopable: graph.loop,
      // "Branching" in the catalog means the route really offers alternates, not just that the
      // editor's branching toggle was left on for a linear layout.
      branching:
        graph.branching &&
        (Math.max(...graph.steps) < race.gates.length || graph.parents.some((p) => p.length > 1)),
      sectors: Math.max(1, Math.round(race.sectorCount ?? 1)),
      defaultLaps: graph.loop && typeof laps === "number" ? Math.round(laps) : null,
      mode: race.mode === "passive" ? "passive" : "grid",
      elevationGainM: Math.round(gain),
      elevationRangeM: Number.isFinite(zMax) ? Math.round(zMax - zMin) : 0,
      props: countProps(race.props),
    },
    geometry: {
      gates,
      parents: graph.parents,
      primary,
      start: race.startPositions.map((s) => [round1(s.pos.x), round1(s.pos.y)] as Vec2),
      loop: graph.loop,
    },
  };
}
