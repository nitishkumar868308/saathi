import { tpl, type Locale } from "./i18n/dictionaries";

/**
 * "Roz · 90 din tak" — repeat ko ek line me.
 *
 * Ek hi jagah rakha hai kyunki ye teen screens par dikhta hai: reminder banate
 * waqt (confirm card), list ke card par, aur detail sheet me. Teen jagah alag
 * likha hota to ek jagah "har 7 din" aur doosri jagah "har hafte" dikhta —
 * user ko lagta do alag cheezein hain.
 */

export type RepeatCopy = {
  repeatDaily: string;
  repeatWeekly: string;
  repeatMonthly: string;
  /** {n} */
  repeatEvery: string;
  /** {date} */
  repeatUntil: string;
  repeatForever: string;
  repeatOff: string;
};

/** Sirf "kitni baar" wala hissa — "Roz", "Har hafte", "Har 3 din". */
export function repeatEveryLabel(everyDays: number | null | undefined, c: RepeatCopy): string {
  if (!everyDays || everyDays < 1) return c.repeatOff;
  if (everyDays === 1) return c.repeatDaily;
  if (everyDays === 7) return c.repeatWeekly;
  if (everyDays === 30) return c.repeatMonthly;
  return tpl(c.repeatEvery, { n: everyDays });
}

/**
 * Poori line — "Roz · 12 Oct tak" ya "Har hafte · jab tak band na karo".
 *
 * `until` ko locale ke hisaab se format karte hain (na ki raw YYYY-MM-DD), warna
 * "2026-10-12 tak" jaisa dikhta hai jo padhne me bhaari lagta hai.
 */
export function repeatLine(
  everyDays: number | null | undefined,
  until: string | null | undefined,
  c: RepeatCopy,
  locale: Locale,
): string | null {
  if (!everyDays || everyDays < 1) return null;

  const every = repeatEveryLabel(everyDays, c);
  const when = until ? formatDay(until, locale) : null;
  return when ? `${every} · ${tpl(c.repeatUntil, { date: when })}` : `${every} · ${c.repeatForever}`;
}

/** "2026-10-12" → "12 Oct 2026" (locale ke hisaab se). */
function formatDay(day: string, locale: Locale): string | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
