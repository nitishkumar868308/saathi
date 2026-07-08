/**
 * Live offer numbers (`app_config` table se).
 *
 * Ye PUBLIC copy ke liye hai — kabhi throw nahi karta. DB na mile, SQL na chala
 * ho, ya env missing ho to defaults laut aate hain, taaki landing page na toote.
 *
 * Admin `/admin` → Rewards se ye numbers badalta hai; yahan se copy khud badal
 * jaati hai (koi deploy nahi chahiye).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type Offers = {
  firstNEnabled: boolean;
  firstNUsers: number;
  firstNFreeMonths: number;
  referralsEnabled: boolean;
  referralDays: number;
  referralCapMonths: number;
};

export const DEFAULT_OFFERS: Offers = {
  firstNEnabled: true,
  firstNUsers: 1000,
  firstNFreeMonths: 3,
  referralsEnabled: true,
  referralDays: 15,
  referralCapMonths: 6,
};

export async function getOffers(): Promise<Offers> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return DEFAULT_OFFERS;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=key,value`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      // Copy turant badle par har request pe DB na thoke.
      next: { revalidate: 30 },
    });
    if (!res.ok) return DEFAULT_OFFERS;

    const rows = (await res.json()) as { key: string; value: unknown }[];
    const m = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, d: number) => {
      const n = Number(m.get(k));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
    };
    const bool = (k: string, d: boolean) => {
      const v = m.get(k);
      return typeof v === "boolean" ? v : d;
    };

    return {
      firstNEnabled: bool("first_n_enabled", DEFAULT_OFFERS.firstNEnabled),
      firstNUsers: num("first_n_users", DEFAULT_OFFERS.firstNUsers),
      firstNFreeMonths: num("first_n_free_months", DEFAULT_OFFERS.firstNFreeMonths),
      referralsEnabled: bool("referrals_enabled", DEFAULT_OFFERS.referralsEnabled),
      referralDays: num("referral_days", DEFAULT_OFFERS.referralDays),
      referralCapMonths: num("referral_cap_months", DEFAULT_OFFERS.referralCapMonths),
    };
  } catch {
    return DEFAULT_OFFERS;
  }
}

/** "Pehle {n} users ko {m} mahine free" jaisi strings bharne ke liye. */
export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k as keyof typeof vars]) : `{${k}}`,
  );
}
