/** Pure helpers for engagement metrics (shared by server code and tests). */

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * Lower bound of the Wilson score interval for the like ratio (95%). Ranks "9 likes, 0 dislikes"
 * above "1 like, 0 dislikes" without letting a single vote put a route on top.
 */
export function wilsonScore(likes: number, dislikes: number) {
  const n = likes + dislikes;
  if (n === 0) return 0;
  const z = 1.96;
  const p = likes / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);
}

/** Last `days` UTC days ending today, oldest first, with zero-filled gaps. */
export function fillDays<T extends { day: string }>(rows: T[], days: number, empty: (day: string) => T, today = new Date()) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = utcDay(new Date(today.getTime() - i * 86_400_000));
    out.push(byDay.get(d) ?? empty(d));
  }
  return out;
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embed|headless|lighthouse/i;
export const isBot = (ua: string | null) => !ua || BOT_UA.test(ua);
