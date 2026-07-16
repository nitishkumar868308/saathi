import { useEffect, useState } from "react";

import { getPlan, type PlanInfo } from "./plan";
import { useAuth } from "@/components/auth-provider";

const FREE: PlanInfo = { plan: "free", isPlus: false, expiresAt: null, source: null };

/**
 * Current plan, har screen ke liye. `rewardsVersion` badalne pe (referral/
 * purchase/enforce ke baad) khud refresh ho jaata hai — isliye upgrade banner
 * turant gayab ho jaata hai jab Plus mil jaaye.
 */
export function usePlan(): PlanInfo & { loading: boolean } {
  const { session, rewardsVersion } = useAuth();
  const [info, setInfo] = useState<PlanInfo>(FREE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!session) {
      setInfo(FREE);
      setLoading(false);
      return;
    }
    getPlan()
      .then((p) => alive && setInfo(p))
      .catch(() => alive && setInfo(FREE))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session, rewardsVersion]);

  return { ...info, loading };
}
