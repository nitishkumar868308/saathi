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

/** Kitne documents hain (count). */
export async function countDocuments(): Promise<number> {
  const { count } = await client()
    .from("documents")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Free user document limit se aage nahi jaa sakta. */
export async function canAddDocument(): Promise<boolean> {
  const [{ isPlus }, count] = await Promise.all([getPlan(), countDocuments()]);
  return isPlus || count < FREE_DOC_LIMIT;
}

/**
 * Waitlist reward claim karo — pehle 1000 waitlist users ko 1 saal Plus free.
 * Idempotent hai (ek hi baar grant hota hai). Login ke baad call karo.
 * Returns: 'granted' | 'not_eligible' | 'not_in_waitlist' | 'no_email' | 'error'
 */
export async function claimWaitlistReward(): Promise<string> {
  try {
    const { data, error } = await client().rpc("claim_waitlist_reward");
    if (error) return "error";
    return (data as string) ?? "error";
  } catch {
    return "error";
  }
}

/** Purchase success ke baad profiles.plan = plus set karo (webhook aane tak bridge). */
export async function markProfilePlus(): Promise<void> {
  const sb = client();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await sb
    .from("profiles")
    .update({ plan: "plus", plan_source: "google_play" })
    .eq("id", uid);
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
