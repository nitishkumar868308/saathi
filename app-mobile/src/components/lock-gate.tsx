import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAuth } from "@/components/auth-provider";
import { LockScreen } from "@/components/lock-screen";
import { getLockState, needsUnlock, markUnlocked, resetGrace } from "@/lib/app-lock";

/**
 * App ke saamne khada pehredaar.
 *
 * Lock chalu ho to bacche (poora app) ki jagah lock screen dikhti hai. Ye
 * `_layout.tsx` me sabse andar lagta hai — Providers ke NEECHE (taaki lock
 * screen ko bhasha aur session mile) par Stack ke UPAR.
 *
 * Kab lock lagta hai:
 *   • App poori tarah band hokar dobara khule (`unlockedAt` memory me hai, so
 *     wo 0 se shuru hota hai).
 *   • Background se wapas aane par, agar khidki (60s) nikal chuki ho.
 *
 * ⚠️ Wo khidki hi is feature ko zinda rakhti hai. Har baar poochne wala lock
 * theek do din chalta hai: reminder ki notification par tap karo — lock; camera
 * se document scan karo — wapas aate hi lock; SMS me OTP dekhne jao — phir
 * lock. Uske baad log lock band kar dete hain, aur phir koi lock hai hi nahi.
 *
 * ⚠️ Logout par lock hata dena zaroori hai: PIN is PHONE ka hai, us user ka
 * nahi. Bina iske doosra user login karke bhi pehle wale ka PIN maangta rehta —
 * jo use pata hi nahi hoga.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id;

  /** `null` = abhi pata nahi (SecureStore padha ja raha hai). */
  const [locked, setLocked] = useState<boolean | null>(null);

  const evaluate = useCallback(async () => {
    const st = await getLockState();
    if (!st.enabled) {
      setLocked(false);
      return;
    }
    setLocked(needsUnlock());
  }, []);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  // Logout — khidki band. Lock khud neeche render me hat jaata hai (`uid` na ho
  // to lock dikhana bekaar hai: PIN is PHONE ka hai, us user ka nahi, aur agla
  // user pehle wale ka PIN jaanta hi nahi hoga).
  useEffect(() => {
    if (!uid) resetGrace();
  }, [uid]);

  // Background se wapas — khidki nikal gayi ho to phir se poocho.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") void evaluate();
      // Background me jaate waqt kuch nahi karte: `needsUnlock()` khud waqt se
      // hisaab lagata hai. Yahan `setLocked(true)` karna app switcher me lock
      // screen ki jhalak dikha deta, jo bhadda lagta hai.
    });
    return () => sub.remove();
  }, [evaluate]);

  /**
   * Jab tak pata na chale tab tak KUCH bhi nahi dikhate.
   *
   * ⚠️ Yahan children dikha dena poora lock bekaar kar deta: SecureStore padhne
   * me jitni der lagti hai, utni der ke liye documents khule dikh jaate hain —
   * aur screenshot lene ke liye utna hi kaafi hai.
   */
  if (locked === null) return null;
  // Logged out ho to login screen tak pahunchna hi chahiye — lock uske aage
  // khada ho to naya user app me ghus hi nahi sakta.
  if (locked && uid) {
    return (
      <LockScreen
        onUnlocked={() => {
          markUnlocked();
          setLocked(false);
        }}
      />
    );
  }
  return <>{children}</>;
}
