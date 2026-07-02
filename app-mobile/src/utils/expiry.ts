export type ExpiryStatus = "safe" | "soon" | "expired";

/** Returns expiry bucket. `soon` = within 14 days (inclusive). */
export function expiryStatus(
  expiryDate: string,
  now: Date = new Date(),
): ExpiryStatus {
  const expiry = new Date(expiryDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
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

/** Human-friendly label like "3 din mein expire" / "expire ho gaya". */
export function expiryLabel(expiryDate: string, now: Date = new Date()): string {
  const expiry = new Date(expiryDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
  if (days < 0) return "Expire ho gaya";
  if (days === 0) return "Aaj expire";
  if (days === 1) return "Kal expire";
  return `${days} din mein expire`;
}
