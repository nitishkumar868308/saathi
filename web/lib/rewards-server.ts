/**
 * Admin ke liye rewards/referral config aur manual grant (service_role se).
 * web/lib/store.ts jaisa hi Supabase REST fetch pattern.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Launch offer (first_n_*) hata diya gaya. Referral + plan limits + price.
export const CONFIG_KEYS = [
  "referrals_enabled",
  "referral_days",
  "free_reminders",
  "free_documents",
  "plus_price_monthly",
  "plus_price_yearly",
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
  referralDaysEarned: number;
  referralCode: string | null;
  createdAt: string;
};

/** Sab users, naye pehle. Admin dashboard ke Users tab ke liye. */
export async function getUsers(limit = 500): Promise<AdminUser[]> {
  assertConfigured();
  const cols =
    "id,email,full_name,plan,plan_expires_at,plan_source,referral_days_earned,referral_code,created_at";
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
    referralDaysEarned: Number(r.referral_days_earned ?? 0),
    referralCode: (r.referral_code as string) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type UserReferral = {
  id: string;
  email: string | null;
  name: string | null;
  joined_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  /** Grant ke waqt jitne din diye the — config baad me badle to bhi yahi. */
  days: number;
};

export type UserDocument = {
  id: string;
  name: string;
  type: string;
  expiry: string | null;
  file_size: number | null;
  in_storage: boolean;
  created_at: string;
};

export type UserDetail = {
  id: string;
  email: string | null;
  full_name: string | null;
  joined_at: string;
  plan: "free" | "plus";
  plan_expires_at: string | null;
  plan_source: string | null;
  referral_code: string | null;
  referral_days_earned: number;
  referred_by: { email: string | null; code: string | null } | null;
  referrals: UserReferral[];
  documents: UserDocument[];
  documents_count: number;
  storage_bytes: number;
};

/** Ek user ka poora record — kisko refer kiya, kab, kitne din. */
export async function getUserDetail(uid: string): Promise<UserDetail | null> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_user_detail`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_uid: uid }),
    cache: "no-store",
  });
  if (!res.ok) await fail("user detail", res);
  return (await res.json()) as UserDetail | null;
}

/* ------------------------------ reviews ------------------------------ */

export type AdminReview = {
  id: string;
  rating: number;
  text: string | null;
  allowDisplay: boolean;
  createdAt: string;
  email: string | null;
  name: string | null;
};

/** Sab reviews (naye pehle) + user ka email/naam. Admin "Reviews" tab. */
export async function getReviews(limit = 500): Promise<AdminReview[]> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reviews?select=id,user_id,rating,text,allow_display,created_at&order=created_at.desc&limit=${limit}`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) await fail("reviews read (supabase/reviews.sql run kiya?)", res);
  const rows = (await res.json()) as Record<string, unknown>[];

  // reviews.user_id -> profiles.id embed FK declared nahi, isliye alag fetch.
  const ids = Array.from(new Set(rows.map((r) => String(r.user_id)).filter(Boolean)));
  const profMap = new Map<string, { email: string | null; name: string | null }>();
  if (ids.length) {
    const inList = ids.map((id) => `"${id}"`).join(",");
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name&id=in.(${inList})`,
      { headers: headers(), cache: "no-store" },
    );
    if (pr.ok) {
      for (const p of (await pr.json()) as Record<string, unknown>[]) {
        profMap.set(String(p.id), {
          email: (p.email as string) ?? null,
          name: (p.full_name as string) ?? null,
        });
      }
    }
  }

  return rows.map((r) => {
    const prof = profMap.get(String(r.user_id));
    return {
      id: String(r.id),
      rating: Number(r.rating ?? 0),
      text: (r.text as string) ?? null,
      allowDisplay: Boolean(r.allow_display),
      createdAt: String(r.created_at),
      email: prof?.email ?? null,
      name: prof?.name ?? null,
    };
  });
}

/* --------------------------- country pricing --------------------------- */

export type CountryPricingRow = {
  country_code: string;
  country_name: string;
  currency: string;
  symbol: string;
  conversion_rate: number;
  multiplier: number;
  enabled: boolean;
};

/** Saari country pricing rows (admin). */
export async function getCountryPricing(): Promise<CountryPricingRow[]> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/country_pricing?select=country_code,country_name,currency,symbol,conversion_rate,multiplier,enabled&order=country_name.asc`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) await fail("pricing read (supabase/country-pricing.sql run kiya?)", res);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    country_code: String(r.country_code),
    country_name: String(r.country_name),
    currency: String(r.currency),
    symbol: String(r.symbol),
    conversion_rate: Number(r.conversion_rate ?? 1),
    multiplier: Number(r.multiplier ?? 1),
    enabled: Boolean(r.enabled),
  }));
}

/** Rows upsert (country_code pe merge). */
export async function upsertCountryPricing(rows: CountryPricingRow[]): Promise<void> {
  assertConfigured();
  if (!rows.length) return;
  const payload = rows.map((r) => ({
    country_code: r.country_code.toUpperCase(),
    country_name: r.country_name,
    currency: r.currency,
    symbol: r.symbol,
    conversion_rate: r.conversion_rate,
    multiplier: r.multiplier,
    enabled: r.enabled,
    updated_at: new Date().toISOString(),
  }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/country_pricing?on_conflict=country_code`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) await fail("pricing write", res);
}

export type CountryOption = {
  /** Hamesha ISO2 — IP-country isi se match hota hai. */
  code: string;
  name: string;
  currency?: string;
  symbol?: string;
};

/**
 * DB `countries` table se list — admin pricing picker ke liye.
 * `add-country-currency.sql` chal chuka ho to currency/symbol/iso2 bhi aate hain
 * (tab pricing form apne aap bhar jaata hai). Na chala ho to sirf code + naam.
 */
export async function getCountriesList(): Promise<CountryOption[]> {
  assertConfigured();
  const base = `${SUPABASE_URL}/rest/v1/countries`;
  let rows: Record<string, unknown>[];

  const full = await fetch(`${base}?select=code,iso2,name,currency,currency_symbol&order=name.asc`, {
    headers: headers(),
    cache: "no-store",
  });
  if (full.ok) {
    rows = (await full.json()) as Record<string, unknown>[];
  } else {
    const basic = await fetch(`${base}?select=code,name&order=name.asc`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!basic.ok) await fail("countries read (locations-billing.sql run kiya?)", basic);
    rows = (await basic.json()) as Record<string, unknown>[];
  }

  return rows
    .map((r) => {
      const iso2 = String(r.iso2 ?? "").toUpperCase();
      const code = String(r.code ?? "").toUpperCase();
      return {
        code: /^[A-Z]{2}$/.test(iso2) ? iso2 : code,
        name: String(r.name ?? ""),
        currency: r.currency ? String(r.currency).toUpperCase() : undefined,
        symbol: r.currency_symbol ? String(r.currency_symbol) : undefined,
      };
    })
    // Sirf ISO2 — 3-letter code pricing me daala to IP se kabhi match nahi hoga.
    .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name);
}

/** Ek country hatao (India ke alawa). */
export async function deleteCountryPricing(code: string): Promise<void> {
  assertConfigured();
  const c = code.toUpperCase();
  if (c === "IN") throw new Error("India base row nahi hataya jaa sakta");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/country_pricing?country_code=eq.${c}`,
    { method: "DELETE", headers: headers({ Prefer: "return=minimal" }), cache: "no-store" },
  );
  if (!res.ok) await fail("pricing delete", res);
}

/* ------------------------------- usage ------------------------------- */

export type UsageRow = {
  id: string;
  email: string | null;
  name: string | null;
  plan: "free" | "plus";
  joinedAt: string;
  documents: number;
  reminders: number;
  messages: number;
  lastActive: string | null;
};

/** Per-user usage (#10) — admin_usage() RPC se. Date range optional. */
export async function getUsage(range: { from?: string; to?: string } = {}): Promise<UsageRow[]> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_usage`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_from: range.from ?? null, p_to: range.to ?? null }),
    cache: "no-store",
  });
  if (!res.ok) await fail("usage read (supabase/admin-usage.sql run kiya?)", res);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    email: (r.email as string) ?? null,
    name: (r.full_name as string) ?? null,
    plan: (r.plan as "free" | "plus") ?? "free",
    joinedAt: String(r.created_at),
    documents: Number(r.documents ?? 0),
    reminders: Number(r.reminders ?? 0),
    messages: Number(r.messages ?? 0),
    lastActive: (r.last_active as string) ?? null,
  }));
}

export type ActivityRow = {
  kind: "document" | "reminder" | "chat";
  itemId: string;
  title: string;
  detail: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
  at: string;
};

/**
 * Kaun sa document/reminder/chat, kab — asli items (naya pehle).
 * uid do to sirf us user ka, warna poore app ki activity feed.
 */
export async function getActivity(opts: {
  uid?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<ActivityRow[]> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_activity`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      p_uid: opts.uid ?? null,
      p_from: opts.from ?? null,
      p_to: opts.to ?? null,
      p_limit: opts.limit ?? 300,
    }),
    cache: "no-store",
  });
  if (!res.ok) await fail("activity read (supabase/admin-usage-detail.sql run kiya?)", res);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    kind: (r.kind as ActivityRow["kind"]) ?? "document",
    itemId: String(r.item_id),
    title: String(r.title ?? ""),
    detail: (r.detail as string) ?? null,
    userId: (r.user_id as string) ?? null,
    email: (r.email as string) ?? null,
    name: (r.full_name as string) ?? null,
    at: String(r.at),
  }));
}

export type RewardStats = {
  totalUsers: number;
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

  const [totalUsers, referralsTotal, referralsRewarded] = await Promise.all([
    count("profiles?select=id"),
    count("referrals?select=id"),
    count("referrals?select=id&rewarded_at=not.is.null"),
  ]);

  return { totalUsers, referralsTotal, referralsRewarded };
}
