/**
 * Admin ke liye rewards/referral config aur manual grant (service_role se).
 * web/lib/store.ts jaisa hi Supabase REST fetch pattern.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const CONFIG_KEYS = [
  "first_n_enabled",
  "first_n_users",
  "first_n_free_months",
  "referrals_enabled",
  "referral_days",
  "referral_cap_months",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];
export type ConfigMap = Record<ConfigKey, string | number | boolean>;

export function rewardsDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Saara config padho (app_config table). */
export async function getConfig(): Promise<Partial<ConfigMap>> {
  if (!rewardsDbConfigured()) return {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=key,value`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`config read failed: ${res.status}`);
  const rows = (await res.json()) as { key: string; value: unknown }[];
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out as Partial<ConfigMap>;
}

/** Sirf known keys likhta hai (upsert). */
export async function setConfig(patch: Partial<ConfigMap>): Promise<void> {
  if (!rewardsDbConfigured()) return;
  const rows = CONFIG_KEYS.filter((k) => patch[k] !== undefined).map((k) => ({
    key: k,
    value: patch[k],
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
    method: "POST",
    headers: headers({
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`config write failed: ${res.status} ${await res.text()}`);
}

/** Kisi user ko manually N din Plus do (RPC). */
export async function adminGrantDays(email: string, days: number): Promise<string> {
  if (!rewardsDbConfigured()) return "not_configured";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_grant_days`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_email: email, p_days: days }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`grant failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as string; // 'granted' | 'user_not_found'
}

export type RewardStats = {
  totalUsers: number;
  firstNGranted: number;
  referralsTotal: number;
  referralsRewarded: number;
};

/** Dashboard ke numbers. */
export async function getRewardStats(): Promise<RewardStats> {
  if (!rewardsDbConfigured()) {
    return { totalUsers: 0, firstNGranted: 0, referralsTotal: 0, referralsRewarded: 0 };
  }

  async function count(query: string): Promise<number> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      method: "HEAD",
      headers: headers({ Prefer: "count=exact" }),
      cache: "no-store",
    });
    const range = res.headers.get("content-range"); // "*/42"
    const total = range ? Number(range.split("/")[1]) : 0;
    return Number.isFinite(total) ? total : 0;
  }

  const [totalUsers, firstNGranted, referralsTotal, referralsRewarded] = await Promise.all([
    count("profiles?select=id"),
    count("profiles?select=id&first_n_granted=is.true"),
    count("referrals?select=id"),
    count("referrals?select=id&rewarded_at=not.is.null"),
  ]);

  return { totalUsers, firstNGranted, referralsTotal, referralsRewarded };
}
