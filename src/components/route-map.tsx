import type { RouteGeometry, Vec2, Vec3 } from "@/lib/sharecode/analyze";

/**
 * Top-down SVG of a route, drawn straight from its gate positions. BeamNG's world is
 * x = east, y = north, so y is flipped for screen space.
 */

type Props = {
  geometry: RouteGeometry;
  /** "thumb" draws only the racing line, for catalog cards. */
  variant?: "thumb" | "full";
  className?: string;
  title?: string;
};

function project(geometry: RouteGeometry, size: number, pad: number) {
  const pts: Vec2[] = [
    ...geometry.gates.map(([x, y]) => [x, y] as Vec2),
    ...geometry.start,
  ];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 50);
  const scale = (size - pad * 2) / span;
  const offX = pad + (size - pad * 2 - (maxX - minX) * scale) / 2;
  const offY = pad + (size - pad * 2 - (maxY - minY) * scale) / 2;
  const p = ([x, y]: Vec2 | Vec3): Vec2 => [
    +(offX + (x - minX) * scale).toFixed(1),
    +(offY + (maxY - y) * scale).toFixed(1),
  ];
  return { p, metersPerUnit: 1 / scale };
}

const path = (pts: Vec2[], close = false) =>
  pts.length ? `M${pts.map((q) => q.join(" ")).join("L")}${close ? "Z" : ""}` : "";

export function RouteMap({ geometry, variant = "full", className, title }: Props) {
  const size = 400;
  const thumb = variant === "thumb";
  const { p, metersPerUnit } = project(geometry, size, thumb ? 28 : 36);
  const primary = geometry.primary.map((i) => p(geometry.gates[i]));
  const primarySet = new Set(
    geometry.primary.slice(1).map((g, k) => `${geometry.primary[k]}>${g}`),
  );

  // Branch alternates: every parent->gate edge not already on the primary line.
  const branchEdges: [Vec2, Vec2][] = [];
  if (!thumb) {
    geometry.parents.forEach((ps, g) =>
      ps.forEach((par) => {
        if (par >= 0 && !primarySet.has(`${par}>${g}`)) {
          branchEdges.push([p(geometry.gates[par]), p(geometry.gates[g])]);
        }
      }),
    );
  }

  const start = primary[0];
  const end = primary[primary.length - 1];
  const scaleBar = niceScale(metersPerUnit * 80);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={title ?? "Route map"}
    >
      {!thumb && (
        <g stroke="var(--chart-grid)" strokeWidth="1">
          {[1, 2, 3].map((k) => (
            <g key={k}>
              <line x1={(size / 4) * k} y1="0" x2={(size / 4) * k} y2={size} />
              <line x1="0" y1={(size / 4) * k} x2={size} y2={(size / 4) * k} />
            </g>
          ))}
        </g>
      )}

      {branchEdges.map(([a, b], i) => (
        <line
          key={i}
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          stroke="var(--route-branch)"
          strokeWidth="3"
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
      ))}

      {/* Casing under the line keeps it legible over the grid in both themes. */}
      <path
        d={path(primary, geometry.loop)}
        fill="none"
        stroke="var(--surface)"
        strokeWidth={thumb ? 11 : 10}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={path(primary, geometry.loop)}
        fill="none"
        stroke="var(--route-line)"
        strokeWidth={thumb ? 6 : 4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {!thumb &&
        geometry.gates.map((g, i) => {
          const [x, y] = p(g);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="var(--surface)"
              stroke="var(--route-line)"
              strokeWidth="1.5"
            >
              <title>{`Gate ${i + 1}`}</title>
            </circle>
          );
        })}

      {!thumb &&
        geometry.start.map((s, i) => {
          const [x, y] = p(s);
          return <rect key={i} x={x - 2} y={y - 2} width="4" height="4" fill="var(--text-2)" />;
        })}

      {/* Finish flag for sprints (circuits finish where they start). */}
      {!geometry.loop && end && (
        <g transform={`translate(${end[0]} ${end[1]})`}>
          <circle r={thumb ? 11 : 8} fill="var(--text)" />
          <path d="M-3 4V-4.5M-3 -4.5h6v4.5h-6" transform={thumb ? "scale(1.35)" : undefined} stroke="var(--surface)" strokeWidth="1.6" fill="none" />
        </g>
      )}
      {start && (
        <g transform={`translate(${start[0]} ${start[1]})`}>
          <circle r={thumb ? 11 : 8} fill="var(--route-line)" stroke="var(--surface)" strokeWidth="3" />
        </g>
      )}

      {!thumb && (
        <g transform={`translate(16 ${size - 18})`} className="text-[11px]">
          <line x1="0" y1="0" x2={scaleBar.m / metersPerUnit} y2="0" stroke="var(--muted)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--muted)" strokeWidth="2" />
          <line
            x1={scaleBar.m / metersPerUnit}
            y1="-4"
            x2={scaleBar.m / metersPerUnit}
            y2="4"
            stroke="var(--muted)"
            strokeWidth="2"
          />
          <text x="0" y="-8" fill="var(--muted)">
            {scaleBar.label}
          </text>
          <text x={size - 32} y="-2" fill="var(--muted)" textAnchor="end" fontWeight="600">
            N ↑
          </text>
        </g>
      )}
    </svg>
  );
}

function niceScale(maxM: number) {
  const steps = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const m = [...steps].reverse().find((s) => s <= maxM) ?? 10;
  return { m, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}
