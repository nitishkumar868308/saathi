import { supabase } from "./supabase";
import { getUserDetails, isDetailsComplete } from "./user-details";

/**
 * Plan / subscription helpers.
 *
 * Free: 5 active reminders, 3 documents. AI + premium locked.
 * Plus: sab unlimited (₹99/mahina, ₹999/saal).
 *
 * Plan Supabase `profiles.plan` mein store hota hai. Limits `app_config` se
 * aate hain (admin badal sakta hai) — ye default fallback hain.
 */

export const FREE_DOC_LIMIT = 3;
export const FREE_REMINDER_LIMIT = 5;

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
  return countOwn("documents");
}

/** Kitne reminders hain (sirf apne). */
export async function countReminders(): Promise<number> {
  return countOwn("reminders");
}

async function countOwn(table: "documents" | "reminders"): Promise<number> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return 0;
  const { count } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid);
  return count ?? 0;
}

/**
 * Free document limit se aage nahi jaa sakta.
 * Limit admin (app_config) se aati hai — FREE_DOC_LIMIT sirf fallback hai.
 * Warna admin 3 -> 10 kar de to bhi app 3 pe hi block karta rehta (server 10 pe).
 */
export async function canAddDocument(): Promise<boolean> {
  const [{ isPlus }, count, offers] = await Promise.all([
    getPlan(),
    countDocuments(),
    getOffers(),
  ]);
  return isPlus || count < (offers.freeDocuments || FREE_DOC_LIMIT);
}

/** Free reminder limit se aage nahi (admin config se; fallback 5). */
export async function canAddReminder(): Promise<boolean> {
  const [{ isPlus }, count, offers] = await Promise.all([
    getPlan(),
    countReminders(),
    getOffers(),
  ]);
  return isPlus || count < (offers.freeReminders || FREE_REMINDER_LIMIT);
}

/**
 * Access ko current plan ke hisaab se sync karo (server pe).
 * Plus expire ho gaya to 5 se aage ke reminders pause + 3 se aage ke documents
 * lock ho jaate hain; Plus wapas milte hi sab khul jaata hai. Data delete nahi
 * hota — sirf access badalta hai (spec item 6-14).
 *
 * Login ke baad aur plan badalne pe call karo. Best-effort.
 */
export async function enforcePlanLimits(): Promise<void> {
  try {
    await client().rpc("enforce_my_limits");
  } catch {
    /* best-effort — fail ho to app na ruke */
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

// Launch offer hata diya. Referral (bina cap) + Free limits + Plus price.
export type Offers = {
  referralsEnabled: boolean;
  referralDays: number;
  freeReminders: number;
  freeDocuments: number;
  plusPriceMonthly: number;
  plusPriceYearly: number;
};

export const DEFAULT_OFFERS: Offers = {
  referralsEnabled: true,
  referralDays: 15,
  freeReminders: 5,
  freeDocuments: 3,
  plusPriceMonthly: 99,
  plusPriceYearly: 999,
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
      referralsEnabled: bool("referrals_enabled", DEFAULT_OFFERS.referralsEnabled),
      referralDays: num("referral_days", DEFAULT_OFFERS.referralDays),
      freeReminders: num("free_reminders", DEFAULT_OFFERS.freeReminders),
      freeDocuments: num("free_documents", DEFAULT_OFFERS.freeDocuments),
      plusPriceMonthly: num("plus_price_monthly", DEFAULT_OFFERS.plusPriceMonthly),
      plusPriceYearly: num("plus_price_yearly", DEFAULT_OFFERS.plusPriceYearly),
    };
  } catch {
    return DEFAULT_OFFERS;
  }
}

export type ReferralGate = {
  hasDocument: boolean;
  hasReminder: boolean;
  profileComplete: boolean;
  /** Teeno poore ho tabhi code/share dikhta hai. */
  unlocked: boolean;
};

/**
 * Referral tabhi khulta hai jab user: 1 document add kare, 1 reminder set kare,
 * aur apni profile complete kare. Tab tak na code na share — sirf conditions.
 * (Fake/khali accounts se referral abuse rokne ke liye.)
 */
export async function getReferralGate(): Promise<ReferralGate> {
  const [docs, rems, details] = await Promise.all([
    countDocuments(),
    countReminders(),
    getUserDetails().catch(() => null),
  ]);
  const hasDocument = docs > 0;
  const hasReminder = rems > 0;
  const profileComplete = isDetailsComplete(details);
  return {
    hasDocument,
    hasReminder,
    profileComplete,
    unlocked: hasDocument && hasReminder && profileComplete,
  };
}

export type ReferralInfo = {
  code: string | null;
  daysEarned: number;
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
};

export type MyRewards = {
  joined_at: string;
  plan: "free" | "plus";
  plan_expires_at: string | null;
  plan_source: string | null;
  referral_code: string | null;
  referral_days_earned: number;
  referred_by_code: string | null;
  referral_days_now: number;
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
