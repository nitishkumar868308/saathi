import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { claimFirstNReward, checkReferralQualification } from "@/lib/plan";

const AuthContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
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

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" && s?.user) {
        // Pehle N signups → X mahine Plus free. Idempotent.
        claimFirstNReward().catch(() => {});
        // Referral reward — document + chat dono ho chuke hon to grant ho jaye.
        checkReferralQualification().catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
  );
}
