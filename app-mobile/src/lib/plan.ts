import { supabase } from "./supabase";

/**
 * Plan / subscription helpers.
 *
 * Free: max 10 documents, basic reminders.
 * Plus: unlimited docs, family sharing, daily brief, priority reminders.
 *
 * Plan Supabase `profiles.plan` mein store hota hai. Payment web checkout se
 * hota hai (Razorpay) — dekho landing `/checkout`.
 */

export const FREE_DOC_LIMIT = 10;

export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://apkasaathi.com";

export type PlanId = "plus_monthly" | "plus_yearly";

export type PlanInfo = {
  plan: "free" | "plus";
  isPlus: boolean;
  expiresAt: string | null;
  source: string | null;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/** Current user ka plan Supabase se. */
export async function getPlan(): Promise<PlanInfo> {
  const sb = client();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { plan: "free", isPlus: false, expiresAt: null, source: null };

  const { data } = await sb
    .from("profiles")
    .select("plan, plan_expires_at, plan_source")
    .eq("id", uid)
    .single();

  const plan = (data?.plan as "free" | "plus") ?? "free";
  const expiresAt = (data?.plan_expires_at as string | null) ?? null;
  const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now();
  return {
    plan,
    isPlus: plan === "plus" && notExpired,
    expiresAt,
    source: (data?.plan_source as string | null) ?? null,
  };
}

/**
 * Kitne documents hain (sirf apne).
 *
 * ⚠️ Pehle yahan user filter nahi tha — free-plan limit SAB users ke documents
 * gin leti thi, to 10 documents ke baad har naya user block ho jaata.
 */
export async function countDocuments(): Promise<number> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return 0;

  const { count } = await sb
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);
  return count ?? 0;
}

/** Free user document limit se aage nahi jaa sakta. */
export async function canAddDocument(): Promise<boolean> {
  const [{ isPlus }, count] = await Promise.all([getPlan(), countDocuments()]);
  return isPlus || count < FREE_DOC_LIMIT;
}

/**
 * Pehle N signups ko X mahine Plus free (config: app_config).
 * Idempotent — ek hi baar grant hota hai. Login ke baad call karo.
 * Returns: 'granted' | 'already' | 'not_eligible' | 'disabled' | 'no_auth' | 'error'
 */
export async function claimFirstNReward(): Promise<string> {
  try {
    const { data, error } = await client().rpc("claim_first_n_reward");
    if (error) return "error";
    return (data as string) ?? "error";
  } catch {
    return "error";
  }
}

/**
 * Kisi ka referral code apply karo (signup ke turant baad).
 * Returns: 'applied' | 'invalid_code' | 'already_referred' | 'self' | 'disabled' | 'no_auth' | 'error'
 */
export async function applyReferralCode(code: string): Promise<string> {
  try {
    const { data, error } = await client().rpc("apply_referral_code", {
      p_code: code,
    });
    if (error) return "error";
    return (data as string) ?? "error";
  } catch {
    return "error";
  }
}

/**
 * Referral reward check karo — document upload + Saathi se chat dono hone pe
 * dono users ko din milte hain. Best-effort, baar-baar call karna safe hai.
 * Returns: 'rewarded' | 'need_document' | 'need_chat' | 'no_referral' | 'error'
 */
export async function checkReferralQualification(): Promise<string> {
  try {
    const { data, error } = await client().rpc("check_referral_qualification");
    if (error) return "error";
    return (data as string) ?? "error";
  } catch {
    return "error";
  }
}

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

/**
 * Live offer numbers (`app_config`, public read).
 * Admin se badalne pe app ka text bhi khud badal jaata hai.
 * Kabhi throw nahi karta — fail ho to defaults.
 */
export async function getOffers(): Promise<Offers> {
  if (!supabase) return DEFAULT_OFFERS;
  try {
    const { data, error } = await supabase.from("app_config").select("key, value");
    if (error || !data) return DEFAULT_OFFERS;

    const m = new Map(data.map((r) => [r.key as string, r.value]));
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

export type ReferralInfo = {
  code: string | null;
  daysEarned: number;
  capDays: number;
  referralDays: number;
  totalReferrals: number;
  rewardedReferrals: number;
};

/** Apna referral code + kitne referral/din — referral screen ke liye. */
export async function getReferralInfo(): Promise<ReferralInfo> {
  const sb = client();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  const empty: ReferralInfo = {
    code: null,
    daysEarned: 0,
    capDays: 180,
    referralDays: 15,
    totalReferrals: 0,
    rewardedReferrals: 0,
  };
  if (!uid) return empty;

  const [{ data: prof }, { data: refs }, { data: cfg }] = await Promise.all([
    sb.from("profiles").select("referral_code, referral_days_earned").eq("id", uid).single(),
    sb.from("referrals").select("rewarded_at").eq("referrer_id", uid),
    sb.from("app_config").select("key, value"),
  ]);

  const conf = new Map((cfg ?? []).map((r) => [r.key as string, r.value]));
  const num = (k: string, d: number) => Number(conf.get(k) ?? d) || d;
  const list = refs ?? [];

  return {
    code: (prof?.referral_code as string) ?? null,
    daysEarned: (prof?.referral_days_earned as number) ?? 0,
    capDays: num("referral_cap_months", 6) * 30,
    referralDays: num("referral_days", 15),
    totalReferrals: list.length,
    rewardedReferrals: list.filter((r) => r.rewarded_at).length,
  };
}

export type MyReferral = {
  id: string;
  name: string | null;
  /** Masked — `ni••••@gmail.com`. Poora email server bhejta hi nahi. */
  email: string | null;
  joined_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  /** Grant ke waqt jitne din mile the (config baad me badle to bhi yahi). */
  days: number;
  /** Cap pe pahunch chuke the, isliye din nahi mile. */
  cap_skipped: boolean;
};

export type MyRewards = {
  joined_at: string;
  plan: "free" | "plus";
  plan_expires_at: string | null;
  plan_source: string | null;
  first_n_granted: boolean;
  first_n_rank: number | null;
  first_n_days: number | null;
  first_n_granted_at: string | null;
  referral_code: string | null;
  referral_days_earned: number;
  referred_by_code: string | null;
  referral_days_now: number;
  cap_days: number;
  referrals_enabled: boolean;
  referrals: MyReferral[];
};

/**
 * "Meri membership" screen ka poora data — ek RPC call me.
 * Kab aaye, plan kya hai, kab tak, kis wajah se, aur kis-kis ko refer kiya
 * (kisse din mile, kisse abhi nahi).
 */
export async function getMyRewards(): Promise<MyRewards | null> {
  try {
    const { data, error } = await client().rpc("my_rewards");
    if (error || !data) return null;
    return data as MyRewards;
  } catch {
    return null;
  }
}

/**
 * Purchase success ke baad profiles.plan = plus (webhook aane tak bridge).
 *
 * @param expiresAt  RevenueCat entitlement ki expiry (ISO).
 *                   `null` = lifetime. `undefined` = pata nahi, mat chhedo.
 *
 * Expiry kabhi CHHOTI nahi karte — user ke paas referral/first-N ke din pehle se
 * subscription se aage ke ho sakte hain.
 */
export async function markProfilePlus(expiresAt?: string | null): Promise<void> {
  const sb = client();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const patch: Record<string, unknown> = { plan: "plus", plan_source: "google_play" };

  if (expiresAt === null) {
    patch.plan_expires_at = null; // lifetime
  } else if (expiresAt) {
    const { data } = await sb
      .from("profiles")
      .select("plan_expires_at")
      .eq("id", uid)
      .single();
    const current = data?.plan_expires_at as string | null | undefined;
    patch.plan_expires_at =
      current && new Date(current) > new Date(expiresAt) ? current : expiresAt;
  }

  await sb.from("profiles").update(patch).eq("id", uid);
}

/** Web Razorpay checkout URL (app in-app browser mein kholega). */
export function buildCheckoutUrl(
  plan: PlanId,
  opts: { uid?: string; email?: string; name?: string; returnUrl?: string },
): string {
  const q = new URLSearchParams();
  q.set("plan", plan);
  if (opts.uid) q.set("uid", opts.uid);
  if (opts.email) q.set("email", opts.email);
  if (opts.name) q.set("name", opts.name);
  if (opts.returnUrl) q.set("return", opts.returnUrl);
  return `${WEB_URL}/checkout?${q.toString()}`;
}
