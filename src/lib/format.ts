export function formatDistance(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`;
  return `${m} m`;
}

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** URL-safe lowercase slug (ASCII letters, digits, hyphens). May be empty for non-Latin text. */
export function slugify(s: string, max = 60) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, max)
    .replace(/^-+|-+$/g, "");
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** Lap time: `1:23.456`, or `23.456` under a minute, `1:02:03.456` past an hour. */
export function formatLap(ms: number) {
  const neg = ms < 0;
  let t = Math.abs(Math.round(ms));
  const msPart = String(t % 1000).padStart(3, "0");
  t = Math.floor(t / 1000);
  const s = t % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  const body = h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${msPart}`
    : m
      ? `${m}:${String(s).padStart(2, "0")}.${msPart}`
      : `${s}.${msPart}`;
  return neg ? `-${body}` : body;
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function formatAgo(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return formatDate(new Date(at));
}
