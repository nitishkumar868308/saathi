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

  // Ek hi user ke liye pipeline baar-baar na chale (TOKEN_REFRESHED har ghante
  // aata hai). Manual refresh isko bypass karta hai.
  const doneFor = useRef<string | null>(null);
  const running = useRef(false);

  /**
   * Signup reward + referral reward.
   *
   * Sab kuch `app_config` se decide hota hai, hardcoded kuch nahi — admin
   * 1000 → 100 ya 3 mahine → 1 kar de to agli call pe naya rule lag jaata hai.
   * Isliye ye har session pe chalti hai, sirf pehle signup pe nahi: offer band
   * tha aur baad me chalu hua, to purana user bhi le paayega.
   */
  const runRewards = useCallback(async (force = false) => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid || running.current) return;
    if (!force && doneFor.current === uid) return;

    running.current = true;
    try {
      // Signup pe diya gaya referral code ab apply karo (ek hi baar).
      const pending = await takePendingReferral();
      if (pending) await applyReferralCode(pending).catch(() => "error");
      // Referral reward — document + chat dono ho chuke hon to grant ho jaye.
      // (Launch offer hata diya gaya — ab koi first-N claim nahi.)
      await checkReferralQualification().catch(() => "error");
      // Plan ke hisaab se access sync — Plus expire hua to extra reminders
      // pause + extra documents lock; Plus wapas mila to sab khul jaaye.
      await enforcePlanLimits().catch(() => {});
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
