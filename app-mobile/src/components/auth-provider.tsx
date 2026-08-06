import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import {
  checkReferralQualification,
  applyReferralCode,
  enforcePlanLimits,
} from "@/lib/plan";
import { takePendingReferral } from "@/lib/referral-pending";
import { clearPlanCache, getPlanSnapshot, refreshPlan } from "@/lib/plan-store";
import { useDataChanged } from "@/lib/data-events";
import { clearUserDetailsCache } from "@/lib/user-details";
import { clearRenewalMemo } from "@/lib/renewal";
import { loadAlertMode, setAlertUserName } from "@/lib/alert-mode";
import { sendWelcomeEmail } from "@/lib/welcome";
import { useLocale } from "@/lib/i18n/LanguageProvider";

type AuthValue = {
  session: Session | null;
  loading: boolean;
  /**
   * Reward pipeline chalne ke baad badhta hai. Plan dikhane wali screens isko
   * useEffect dep me rakhein — warna grant hone ke baad bhi purana "Free" hi
   * dikhta rahega.
   */
  rewardsVersion: number;
  /** Dobara check karo (pull-to-refresh, upgrade ke baad, waghera). */
  refreshRewards: () => Promise<void>;
};

/**
 * Do data-change ke beech kam se kam itni der.
 *
 * `emitDataChanged()` ek hi kaam par kai jagah se chalta hai (reminder bana +
 * alarm laga + list refresh). 15 second ki chhut se reward ka check apna kaam
 * turant kar leta hai aur server par ek hi call jaati hai.
 */
const RECHECK_GAP_MS = 15_000;

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: true,
  rewardsVersion: 0,
  refreshRewards: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** User ka pehla naam (greetings ke liye). Na ho toh "". */
export function useUserName(): string {
  const { session } = useAuth();
  const meta = session?.user?.user_metadata;
  const full = (meta?.full_name || meta?.name || "") as string;
  return full.trim().split(" ")[0];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewardsVersion, setRewardsVersion] = useState(0);
  const { locale } = useLocale();

  // Ek hi user ke liye pipeline baar-baar na chale (TOKEN_REFRESHED har ghante
  // aata hai). Manual refresh isko bypass karta hai.
  const doneFor = useRef<string | null>(null);
  const running = useRef(false);
  // Locale ref — runRewards ko stable rakhne ke liye (dep me na daalna pade).
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  /**
   * Referral reward pipeline.
   *
   * Sab kuch `app_config` se decide hota hai, hardcoded kuch nahi — admin
   * referral din badle to agli call pe naya rule lag jaata hai. Har session pe
   * chalti hai (sirf signup pe nahi), taaki referral qualify hote hi grant ho.
   */
  const runRewards = useCallback(async (force = false) => {
    // ⚠️ Guard pehle set karo, kisi bhi await se pehle. Cold-start pe ye do baar
    // call hoti hai (getSession + INITIAL_SESSION); pehle guard `await getUser()`
    // ke baad tha, isliye dono call pass ho jaati thi aur referral do baar apply
    // ho sakta tha. Ab synchronous check-and-set race-safe hai.
    if (!supabase || running.current) return;
    running.current = true;
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      if (!force && doneFor.current === uid) return;

      // Signup pe diya gaya referral code ab apply karo (ek hi baar).
      const pending = await takePendingReferral();
      if (pending) await applyReferralCode(pending).catch(() => "error");
      // Referral reward — document + reminder dono ho chuke hon to grant ho jaye.
      // (Launch offer hata diya gaya — ab koi first-N claim nahi.)
      await checkReferralQualification().catch(() => "error");
      // Plan ke hisaab se access sync — Plus expire hua to extra reminders
      // pause + extra documents lock; Plus wapas mila to sab khul jaaye.
      await enforcePlanLimits().catch(() => {});
      // Naye user ko welcome email (server ek hi baar bhejta hai — welcomed_at).
      await sendWelcomeEmail(localeRef.current).catch(() => {});
      doneFor.current = uid;
      // Plan DB me badal chuka ho sakta hai — screens ko dobara padhne ka signal.
      setRewardsVersion((v) => v + 1);
    } finally {
      running.current = false;
    }
  }, []);

  const refreshRewards = useCallback(async () => {
    await runRewards(true);
  }, [runRewards]);

  /**
   * Naya document ya reminder bana — referral ab qualify ho sakta hai.
   *
   * ⚠️ Ye hissa poori reward pipeline ka sabse zaroori aur sabse missing tukda
   * tha. Referral ka reward do shartein poori hone par milta hai: ek document
   * upload + ek reminder set. Dono aksar user PEHLE SESSION me hi kar leta hai —
   * par `runRewards` sirf app khulne par chalti thi (SIGNED_IN / INITIAL_SESSION).
   * Yaani grant agli baar app kholne tak rukta tha, aur us beech user ke saamne
   * "Plus lo" wala banner baitha rehta tha jabki uske 15 din ban chuke the.
   *
   * Yahan poori pipeline nahi chalate — sirf wo do call jo is lamhe maayne rakhti
   * hain. Welcome email aur pending-code apply pehle ho chuke hote hain, aur unhe
   * har document par dobara chalana bekaar hai.
   *
   * Version tabhi badhta hai jab sach me kuch mila. Warna har document/reminder
   * par poora app dobara render hota — bina kisi wajah ke.
   */
  const recheck = useRef(false);
  const lastRecheck = useRef(0);
  const onDataChanged = useCallback(() => {
    if (!supabase || recheck.current) return;

    /**
     * Do rok — dono zaroori hain, warna ye ek fizool RPC-pump ban jaata hai.
     *
     * 1. Plus pehle se chalu hai → paane ko kuch nahi. Referral ka reward ek hi
     *    baar milta hai, aur uske baad har "reminder done" par do RPC bhejna
     *    sirf kharcha hai.
     * 2. Thodi der ki chhut — `emitDataChanged()` kai jagah se ek saath chalta
     *    hai (reminder bana + alarm laga + list refresh), aur har call par
     *    server tak jaana bekaar hai.
     */
    if (getPlanSnapshot().isPlus) return;
    if (Date.now() - lastRecheck.current < RECHECK_GAP_MS) return;

    recheck.current = true;
    lastRecheck.current = Date.now();
    void (async () => {
      try {
        const res = await checkReferralQualification().catch(() => "error");
        await enforcePlanLimits().catch(() => {});
        if (res === "rewarded") {
          setRewardsVersion((v) => v + 1);
        } else {
          // Grant nahi hua par limits badal sakti hain (naya document lock hua ya
          // khula) — plan ka sach dobara padh lena sasta hai aur screen ko sahi
          // rakhta hai.
          void refreshPlan();
        }
      } finally {
        recheck.current = false;
      }
    })();
  }, []);

  useDataChanged(onDataChanged);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      // ⚠️ App restart pe supabase-js `SIGNED_IN` nahi bhejta. Pehle pipeline
      // sirf SIGNED_IN pe chalti thi, isliye jiska pehla claim fail hua ya jo
      // offer chalu hone se pehle bana tha, usko kabhi Plus nahi milta tha.
      if (data.session?.user) void runRewards();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void runRewards();
      }
      if (event === "SIGNED_OUT") {
        doneFor.current = null;
        // Profile cache saaf — agla user purane ka naam/photo na dekhe.
        clearUserDetailsCache();
        // Aur plan bhi. Iske bina agla user ek pal ke liye pichhle wale ka plan
        // dekh leta: free ko Plus wali screen, ya Plus wale ko upgrade banner.
        clearPlanCache();
        /**
         * Renewal guides ka memo bhi.
         *
         * ⚠️ `clearRenewalMemo` `renewal.ts` me bana pada tha par use kabhi
         * kahin se BULAYA hi nahi jaata tha — yaani wo module-level memo poore
         * app-session tak zinda rehta tha.
         *
         * Ye koi bada bug nahi tha (memo me teeno bhashaon ka content ek saath
         * hota hai, aur locale/country har call par chunte hain — to bhasha
         * badalne se kuch galat nahi dikhta tha). Par uska matlab ye tha ki
         * admin ke update kiye hue guide app band karne tak nahi aate the.
         * Logout ek saaf mauka hai use taaza karne ka.
         */
        clearRenewalMemo();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [runRewards]);

  /**
   * Alert system ko user ka naam aur chuna hua mode pata ho.
   *
   * Alert (internet popup, reminder popup) kisi bhi waqt khul sakta hai, aur us
   * waqt storage padhne ka intezaar saaf sunayi deta hai — popup dikh jaata hai
   * aur awaaz aadha second baad aati hai. Isliye dono cheezein yahin, login ke
   * saath hi, memory me daal dete hain.
   */
  useEffect(() => {
    void loadAlertMode();
    const meta = session?.user?.user_metadata as
      | { full_name?: string; name?: string }
      | undefined;
    setAlertUserName(meta?.full_name || meta?.name || null);
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, loading, rewardsVersion, refreshRewards }}>
      {children}
    </AuthContext.Provider>
  );
}
