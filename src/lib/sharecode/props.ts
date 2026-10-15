/**
 * Prop count of a race's `props`, weighed exactly as BeamJoy-Revived's own budget does it
 * (client `beamjoy_props.weight`, server `services/props.lua`; limit 1000 per race):
 *  - a single prop counts 1, plus 1 per extra mesh of a prefab (`parts`);
 *  - a line counts each of its `count` props that way, plus its end caps;
 *  - a curb, wall (`sweep`) or painted line (`paint`) counts 1 per 20 segments, at least 1.
 */

/** Segments of a curb, wall or painted line that count as one prop. */
const SWEEP_WEIGHT_SEGMENTS = 20;

type Entry = {
  kind?: unknown;
  count?: unknown;
  parts?: unknown;
  capA?: unknown;
  capB?: unknown;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v));

export function propWeight(entry: unknown): number {
  if (!entry || typeof entry !== "object") return 0;
  const e = entry as Entry;
  if (e.kind === "sweep" || e.kind === "paint") {
    const count = num(e.count);
    return Math.max(1, Math.ceil((Number.isFinite(count) ? count : 1) / SWEEP_WEIGHT_SEGMENTS));
  }
  const each = 1 + (Array.isArray(e.parts) ? e.parts.length : 0);
  if (e.kind !== "line") return each;
  const count = num(e.count);
  const props = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const caps = (typeof e.capA === "string" ? 1 : 0) + (typeof e.capB === "string" ? 1 : 0);
  return props * each + caps;
}

export function countProps(props: unknown): number {
  if (!Array.isArray(props)) return 0;
  let n = 0;
  for (const p of props) n += propWeight(p);
  return n;
}
