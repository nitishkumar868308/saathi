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

/**
 * Chup-chaap fail mat hone do. Pehle ye galti thi: env na hone pe setConfig
 * kuch nahi karta tha par route `ok: true` lauta deta tha — "save hua" dikhta
 * tha, hota kuch nahi tha.
 */
export class RewardsNotConfigured extends Error {
  constructor() {
    super(
      "Supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Web ke env me set karo.",
    );
    this.name = "RewardsNotConfigured";
  }
}

function assertConfigured() {
  if (!rewardsDbConfigured()) throw new RewardsNotConfigured();
}

/** Supabase ki asli error message aage bhejo — "read failed" se kuch pata nahi chalta. */
async function fail(what: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  if (res.status === 404 || /does not exist|schema cache/i.test(body)) {
    throw new Error(
      `${what}: table/function nahi mila. Supabase me 'supabase/rewards-referrals.sql' run kiya?`,
    );
  }
  throw new Error(`${what}: ${res.status} ${body.slice(0, 300)}`);
}

/** Saara config padho (app_config table). */
export async function getConfig(): Promise<Partial<ConfigMap>> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=key,value`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) await fail("config read", res);
  const rows = (await res.json()) as { key: string; value: unknown }[];
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out as Partial<ConfigMap>;
}

/** Sirf known keys likhta hai (upsert). Kuch na likhe to error. */
export async function setConfig(patch: Partial<ConfigMap>): Promise<void> {
  assertConfigured();
  const rows = CONFIG_KEYS.filter((k) => patch[k] !== undefined).map((k) => ({
    key: k,
    value: patch[k],
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) throw new Error("koi valid config key nahi mili");

  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
    method: "POST",
    headers: headers({
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) await fail("config write", res);
}

/** Kisi user ko manually N din Plus do (RPC). */
export async function adminGrantDays(email: string, days: number): Promise<string> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_grant_days`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_email: email, p_days: days }),
    cache: "no-store",
  });
  if (!res.ok) await fail("grant", res);
  return (await res.json()) as string; // 'granted' | 'user_not_found'
}

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: "free" | "plus";
  planExpiresAt: string | null;
  planSource: string | null;
  firstNGranted: boolean;
  referralDaysEarned: number;
  referralCode: string | null;
  createdAt: string;
};

/** Sab users, naye pehle. Admin dashboard ke Users tab ke liye. */
export async function getUsers(limit = 500): Promise<AdminUser[]> {
  assertConfigured();
  const cols =
    "id,email,full_name,plan,plan_expires_at,plan_source,first_n_granted,referral_days_earned,referral_code,created_at";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=${cols}&order=created_at.desc&limit=${limit}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) await fail("users read", res);

  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    email: (r.email as string) ?? null,
    fullName: (r.full_name as string) ?? null,
    plan: (r.plan as "free" | "plus") ?? "free",
    planExpiresAt: (r.plan_expires_at as string) ?? null,
    planSource: (r.plan_source as string) ?? null,
    firstNGranted: Boolean(r.first_n_granted),
    referralDaysEarned: Number(r.referral_days_earned ?? 0),
    referralCode: (r.referral_code as string) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type RewardStats = {
  totalUsers: number;
  firstNGranted: number;
  referralsTotal: number;
  referralsRewarded: number;
};

/** Dashboard ke numbers. */
export async function getRewardStats(): Promise<RewardStats> {
  assertConfigured();

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
