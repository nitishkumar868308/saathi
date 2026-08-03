import { useEffect } from "react";

import { type PlanInfo } from "./plan";
import { refreshPlan, usePlanSnapshot } from "./plan-store";
import { useDataChanged } from "./data-events";
import { useAuth } from "@/components/auth-provider";

/**
 * Current plan, har screen ke liye — aur poore app me ek hi jawab.
 *
 * Asli data `plan-store.ts` me ek jagah rehta hai (wahan wajah bhi likhi hai);
 * ye hook usse jodne aur "kab dobara padhna hai" tay karne ka kaam karta hai.
 *
 * Dobara padhne ke mauke:
 *
 *   • session badla — login/logout.
 *   • `rewardsVersion` badla — referral/first-N grant ke baad.
 *   • data badla — naya document ya reminder bana. Yahi wo do cheezein hain jo
 *     referral ko qualify karti hain, isliye Plus theek isi lamhe mil sakta hai.
 *     ⚠️ Iske bina banner app band-khol-ne tak baitha rehta tha.
 *
 * (App foreground me aane par refresh root `_layout` se hota hai — wo har screen
 * ka kaam nahi, warna chaar tab char call karte.)
 */
export function usePlan(): PlanInfo & { loading: boolean } {
  const { session, rewardsVersion } = useAuth();
  const snapshot = usePlanSnapshot();

  useEffect(() => {
    // Bina session kuch poochna hi nahi hai. Cache saaf karne ka kaam
    // AuthProvider ka hai (SIGNED_OUT par, ek hi baar) — yahan karte to har
    // consumer apna alag clear chalata aur logout par store kai baar bejah
    // badalta.
    if (!session) return;
    void refreshPlan();
  }, [session, rewardsVersion]);

  useDataChanged(() => {
    // Sirf tab jab kuch paane ko bacha ho. Plus wale ke liye ye call bekaar hai,
    // aur document/reminder banna sabse aam kaam hai — har baar ek fizool query
    // bhejna theek nahi.
    if (!snapshot.isPlus) void refreshPlan();
  });

  return snapshot;
}
