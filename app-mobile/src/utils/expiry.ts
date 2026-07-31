export type ExpiryStatus = "safe" | "soon" | "expired";

/**
 * Expiry tak kitne DIN bache — calendar ke hisaab se, ghanton ke nahi.
 *
 * ⚠️ Pehle yahan seedha `new Date("2026-08-15")` chalta tha. JavaScript us
 * shakl ko **UTC aadhi raat** maanta hai, jabki `now` device ka LOCAL time
 * hota hai. India me (UTC+5:30) iska matlab tha ki har expiry apne din ki
 * subah 5:30 par baithi hoti thi, aur raat 12 se 5:30 ke beech ginti ek din
 * zyada nikalti thi: jo document KAL expire ho raha hai uske liye app "2 din
 * me" likhti thi.
 *
 * Wo khidki bilkul us waqt par padti hai jab ye app sabse zyada dekhi jaati
 * hai — subah-subah, aur reminder to 6 baje se hi bajne lagte hain.
 *
 * `notifications.ts` ka `expiryDate()` ye date pehle se LOCAL maan ke padhta
 * hai. Yaani ek hi date do jagah do matlab rakhti thi: notification sahi din
 * aati thi aur card uske alag din dikhata tha. Ab dono ek hi hisaab par hain.
 *
 * `Math.round` isliye (floor/ceil nahi): DST ya kisi bhi 23/25-ghante wale din
 * par bhi ginti poore din par tikki rahe.
 */
function daysUntil(expiryDate: string, now: Date): number {
  const [y, m, d] = expiryDate.split("-").map(Number);
  // Aadhi-adhoori shakl (jaise poora ISO timestamp) — tab purane raaste par.
  const target = y && m && d ? new Date(y, m - 1, d) : new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Returns expiry bucket. `soon` = within 14 days (inclusive). */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
): ExpiryStatus {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return "expired";
  if (days <= 14) return "soon";
  return "safe";
}

/** Aaj se N mahine baad ki date, 'YYYY-MM-DD' format mein. */
export function dateAfterMonths(months: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' valid hai ya nahi (simple check). */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/** Labels for {@link expiryLabel} — user ki chuni bhasha se aate hain. */
export type ExpiryLabels = {
  expired: string;
  today: string;
  tomorrow: string;
  /** "{n}" din ki jagah lega */
  inDays: string;
};

/**
 * Human-friendly expiry label, chuni hui bhasha me. Labels caller (doc-card)
 * dict se pass karta hai — is util ko koi hardcoded text nahi rakhna.
 */
export function expiryLabel(
  expiryDate: string,
  labels: ExpiryLabels,
  now: Date = new Date(),
): string {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return labels.expired;
  if (days === 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  return labels.inDays.replace("{n}", String(days));
}
