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
  const expiry = new Date(expiryDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
  if (days < 0) return labels.expired;
  if (days === 0) return labels.today;
  if (days === 1) return labels.tomorrow;
  return labels.inDays.replace("{n}", String(days));
}
