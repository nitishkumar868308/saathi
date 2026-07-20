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
      if (event === "SIGNED_OUT") doneFor.current = null;
    });
    return () => sub.subscription.unsubscribe();
  }, [runRewards]);

  return (
    <AuthContext.Provider value={{ session, loading, rewardsVersion, refreshRewards }}>
      {children}
    </AuthContext.Provider>
  );
}
