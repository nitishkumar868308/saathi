import type { EmailLocale } from "@/lib/email";

/**
 * Server par user ki chuni hui bhasha — ek hi jagah se.
 *
 * ⚠️ Ye isliye bana kyunki "user ki bhasha" server par teen alag tarikon se
 * nikaali ja rahi thi: reminder cron apna cache banata tha, expiry cron apna,
 * aur baaki jagah (support ticket, contact, delete request) bilkul poochti hi
 * nahi thi — wahan sab kuch hamesha Hinglish me chala jaata tha, chahe user ne
 * app me Hindi ya English hi kyun na chuni ho.
 *
 * Bhasha ka ek hi ghar hai: `profiles.language` (app ka language switcher wahin
 * likhta hai). Kuch bhi galat/khaali mile to Hinglish — wahi app ka default hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Kisi bhi kachhi value ko teen supported bhashaon me se ek banao. */
export function asLocale(v: unknown): EmailLocale {
  return v === "hi" || v === "en" || v === "hinglish" ? v : "hinglish";
}

/**
 * User id se uski bhasha. Kuch bhi gadbad ho (id nahi, row nahi, network) to
 * Hinglish — bhasha ke chakkar me email/notification rukni nahi chahiye.
 */
export async function localeForUser(uid: string | null | undefined): Promise<EmailLocale> {
  if (!uid || !SUPABASE_URL || !SERVICE) return "hinglish";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=language&limit=1`,
      {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return "hinglish";
    const rows = (await res.json()) as { language?: string | null }[];
    return asLocale(rows[0]?.language);
  } catch {
    return "hinglish";
  }
}
