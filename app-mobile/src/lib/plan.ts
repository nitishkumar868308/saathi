import { supabase } from "./supabase";
import { getUserDetails, isDetailsComplete } from "./user-details";
import { getDeviceId, getHardwareId } from "./device";

/**
 * Plan / subscription helpers.
 *
 * Free: 5 active reminders, sabse naye N documents (N admin ke config se).
 * AI + premium locked.
 * Plus: sab unlimited (₹99/mahina, ₹999/saal).
 *
 * Plan Supabase `profiles.plan` mein store hota hai. Limits `app_config` se
 * aate hain (admin badal sakta hai) — ye default fallback hain.
 */

export const FREE_DOC_LIMIT = 3;
export const FREE_REMINDER_LIMIT = 5;

export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://www.apkasaathi.com";

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
 * Limit admin (app_config) se aati hai; getOffers config na mile to default deta
 * hai. 0 bhi valid (koi free document nahi). Admin 3 -> 10 kare to app bhi 10.
 */
export async function canAddDocument(): Promise<boolean> {
  const [{ isPlus }, count, offers] = await Promise.all([
    getPlan(),
    countDocuments(),
    getOffers(),
  ]);
  return isPlus || count < offers.freeDocuments;
}

/** Free reminder limit se aage nahi (admin config se; fallback 5). */
export async function canAddReminder(): Promise<boolean> {
  const [{ isPlus }, count, offers] = await Promise.all([
    getPlan(),
    countReminders(),
    getOffers(),
  ]);
  return isPlus || count < offers.freeReminders;
}

/**
 * Access ko current plan ke hisaab se sync karo (server pe).
 *
 * Plus expire ho gaya to admin ke `free_reminders` se aage ke reminders pause,
 * aur `free_documents` se aage ke documents lock ho jaate hain — documents me
 * sabse NAYE utne khule rehte hain. Plus wapas milte hi sab khul jaata hai.
 * Data delete nahi hota — sirf access badalta hai (spec item 6-14).
 *
 * ⚠️ Ye ab downgrade ka EKMATRA raasta nahi hai. `supabase/cron-plan-expiry.sql`
 * har ghante wahi kaam server par karta hai, taaki jo user app kholta hi nahi
 * uska downgrade bhi waqt par lage.
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
 *
 * Device ki dono pehchaan saath jaati hain, aur ye zaroori hai — yahi wo jagah
 * hai jahan "app hatao, nayi email banao, apna hi purana code daal do" wala
 * raasta band hota hai. Server dekhta hai ki jisne code diya hai wo kabhi isi
 * phone par tha kya, aur ho to `same_device` lauta deta hai.
 *
 * Code daalte hi mana kar dena jaan-boojh ke hai. Reward bahut baad me milta hai
 * (document + reminder ke baad), aur tab tak user 15 din ka intezaar kar chuka
 * hota — us waqt "nahi milega" kehna bahut bura lagta hai.
 *
 * Returns: 'applied' | 'invalid_code' | 'already_referred' | 'self' |
 *          'same_device' | 'disabled' | 'no_auth' | 'error'
 */
export async function applyReferralCode(code: string): Promise<string> {
  try {
    const sb = client();
    const [p_device_id, p_hardware_id] = await Promise.all([
      getDeviceId().catch(() => null),
      getHardwareId().catch(() => null),
    ]);

    const { data, error } = await sb.rpc("apply_referral_code", {
      p_code: code,
      p_device_id,
      p_hardware_id,
    });
    if (!error) return (data as string) ?? "error";

    /**
     * Purana server — 3-arg wala version abhi deploy nahi hua
     * (supabase/device-hardware.sql chalna baaki hai). Bina is fallback ke naye
     * app par referral code lagna hi band ho jaata, jo is fix se kayi guna bura
     * nuksaan hai. Device check nahi hoga, par reward ke waqt wahi check dobara
     * lagta hai — isliye chhed khula nahi rehta.
     */
    const legacy = await sb.rpc("apply_referral_code", { p_code: code });
    if (legacy.error) return "error";
    return (legacy.data as string) ?? "error";
  } catch {
    return "error";
  }
}

/** Kya user pehle se kisi ke referral se juda hai (referred_by set hai)? */
export async function hasBeenReferred(): Promise<boolean> {
  try {
    const sb = client();
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return false;
    const { data } = await sb
      .from("profiles")
      .select("referred_by")
      .eq("id", uid)
      .maybeSingle();
    return Boolean((data as { referred_by?: string } | null)?.referred_by);
  } catch {
    return false;
  }
}

/**
 * Referral reward check karo — ek document upload + ek reminder set, dono hone
 * pe dono users ko din milte hain. Best-effort, baar-baar call karna safe hai.
 *
 * Device ki DO pehchaan jaati hain:
 *
 *   • install id — SecureStore ka UUID. App hatane par mit jaata hai.
 *   • hardware id — is phone ka nishaan (hash). App hatane par bhi wahi rehta.
 *
 * ⚠️ Doosri ID kyun aayi: pehle sirf install id jaati thi, aur usse ye poora
 * check bekaar tha. App uninstall karo → nayi install id → server ko naya phone
 * dikhta → naya email + apna purana code = 15 din phir mil gaye, jitni baar
 * chaaho. Mohar ek aisi ID par lagti thi jo agli baar maujood hi nahi hoti.
 *
 * Returns: 'rewarded' | 'need_document' | 'need_reminder' | 'no_referral' |
 *          'same_device' | 'device_already_rewarded' | 'error'
 */
export async function checkReferralQualification(): Promise<string> {
  try {
    const sb = client();
    const [p_device_id, p_hardware_id] = await Promise.all([
      getDeviceId().catch(() => null),
      getHardwareId().catch(() => null),
    ]);

    const { data, error } = await sb.rpc("check_referral_qualification", {
      p_device_id,
      p_hardware_id,
    });
    if (!error) return (data as string) ?? "error";

    // Purana server: 2-arg wala version abhi deploy nahi hua
    // (supabase/device-hardware.sql chalna baaki hai). Ek-ek seedhi neeche
    // utarte hain — reward pipeline rukni nahi chahiye.
    const oneArg = await sb.rpc("check_referral_qualification", { p_device_id });
    if (!oneArg.error) return (oneArg.data as string) ?? "error";

    const legacy = await sb.rpc("check_referral_qualification");
    if (legacy.error) return "error";
    return (legacy.data as string) ?? "error";
  } catch {
    return "error";
  }
}

// Launch offer hata diya. Referral (bina cap) + Free limits.
//
// ⚠️ Plus ka DAAM yahan nahi hai, aur jaan-boojh ke nahi hai. Wo Google Play
//    Console se aata hai — store se seedha (`priceString`) ya server ke
//    `play_prices` table se (`lib/pricing.ts`). Pehle yahan
//    `plus_price_monthly/_yearly` the jo admin panel se badalte the; wo poora
//    raasta hata diya gaya, kyunki daam do jagah set hone ka natija hamesha ek
//    hi tha: screen ek number dikhati aur Play doosra kaat leta.
export type Offers = {
  referralsEnabled: boolean;
  referralDays: number;
  freeReminders: number;
  freeDocuments: number;
};

export const DEFAULT_OFFERS: Offers = {
  referralsEnabled: true,
  referralDays: 15,
  freeReminders: 5,
  freeDocuments: 3,
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
      // 0 ek valid value hai (jaise free_documents = 0 → koi free document nahi).
      // Sirf missing / negative / NaN pe default lo.
      const raw = m.get(k);
      if (raw === null || raw === undefined || raw === "") return d;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
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
 * Referral tabhi khulta hai jab user: 1 document add kare aur 1 reminder set kare.
 * Yahi anti-fraud proof kaafi hai (real active user). Profile complete karna
 * ZAROORI NAHI — warna referral karne se pehle hi log chhoot jaate. Profile ki
 * zaroorat sirf Plus checkout pe hoti hai (jahan wo natural + expected hai).
 * Reward condition bhi yahi hai (document + reminder), isliye dono match karte.
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
    unlocked: hasDocument && hasReminder,
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
 * Purchase ke baad server ka wo jawab aane ka intezaar karo jisme plan `plus` ho.
 *
 * ⚠️ Yahan pehle app KHUD `profiles` me `plan = 'plus'` likh deti thi — "webhook
 * aane tak bridge" ke naam par. Wo bridge nahi, ek khula darwaza tha.
 *
 * `profiles` ki RLS policy row par lagti hai ("apni row badal sakte ho"), aur
 * `plan` bhi usi row me hai. Yaani ye do line likh sakne ka matlab tha ki koi
 * bhi ye do line likh sakta hai — app ki anon key APK me padi hai aur nikaali ja
 * sakti hai, uske baad ek `PATCH /rest/v1/profiles?id=eq.<apni uid>` bhejna hi
 * kaafi tha:
 *
 *     { "plan": "plus", "plan_expires_at": "2099-01-01" }
 *
 * …bina kuch kharide, hamesha ke liye. Aur uske peeche ki har deewar isi ek
 * column par tiki hai — `is_plus_active()`, free limits, AI ka daily brief,
 * reminder ka email/WhatsApp — to poora paid hissa ek hi request me khul jaata.
 *
 * Ab wo column app se poori tarah band hai (`supabase/column-grants.sql`), aur
 * plan dene ka EK hi raasta bacha hai: RevenueCat ka webhook → `/api/play/webhook`
 * → `activatePlus()` (service_role se). Wahi sahi bhi hai — "kya sach me paisa
 * aaya" ka jawab sirf Play/RevenueCat de sakta hai, app nahi.
 *
 * Isliye ye function ab likhta nahi, POOCHTA hai. Webhook aam taur par kuch hi
 * second me pahunchta hai, isliye thodi der poochte rehna user ko wahi turant
 * "Plus chalu ho gaya" wala ehsaas deta hai — bina kisi bharose ke jise tod
 * kar chura liya ja sake.
 *
 * @returns `true` = server ne Plus maan liya. `false` = abhi tak nahi (kharidari
 *          phir bhi ho chuki hai; webhook der se aaya to agli baar app khulte hi
 *          plan sahi dikhega).
 */
export async function waitForPlusFromServer(
  { tries = 6, gapMs = 2000 }: { tries?: number; gapMs?: number } = {},
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    // Pehli koshish turant — aksar webhook purchase se pehle hi pahunch chuka
    // hota hai (RevenueCat ise app ke jawab ke saath-saath bhejta hai).
    if (i > 0) await new Promise((r) => setTimeout(r, gapMs));
    try {
      if ((await getPlan()).isPlus) return true;
    } catch {
      /* net ka jhatka — agli koshish me phir dekh lenge */
    }
  }
  return false;
}

/**
 * ⚠️ Yahan pehle `buildCheckoutUrl()` tha — website ka Razorpay checkout kholne
 * ke liye. Wo poora raasta hata diya gaya hai.
 *
 * Saathi Plus ek digital subscription hai, aur Play Store ki policy me aise
 * saamaan ke liye Google ke apne billing ke alawa kuch nahi chal sakta. Ab
 * kharidari app ke andar Play Billing se hoti hai (`lib/purchases.ts`), aur
 * server ki taraf ka hissa `web/lib/play-billing.ts` me taiyaar rakha hai
 * (abhi band).
 */
