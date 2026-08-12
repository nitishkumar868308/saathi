import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/components/auth-provider";
import { LockScreen } from "@/components/lock-screen";
import { ScreenLoader } from "@/components/loader";
import {
  getLockState,
  needsUnlock,
  markUnlocked,
  markBackgrounded,
  resetGrace,
  syncAppLock,
} from "@/lib/app-lock";

/**
 * App ke saamne khada pehredaar.
 *
 * Lock chalu ho to bacche (poora app) ki jagah lock screen dikhti hai. Ye
 * `_layout.tsx` me sabse andar lagta hai — Providers ke NEECHE (taaki lock
 * screen ko bhasha aur session mile) par Stack ke UPAR.
 *
 * Kab lock lagta hai:
 *   • App poori tarah band hokar dobara khule (`unlocked` memory me hai, so
 *     wo false se shuru hota hai).
 *   • Background se wapas aane par, agar khidki (60s) nikal chuki ho.
 *   • Naye phone / naye install par login karte hi — agar us ACCOUNT par lock
 *     chalu hai (neeche `syncAppLock` dekho).
 *
 * ⚠️ Wo khidki hi is feature ko zinda rakhti hai. Har baar poochne wala lock
 * theek do din chalta hai: reminder ki notification par tap karo — lock; camera
 * se document scan karo — wapas aate hi lock; SMS me OTP dekhne jao — phir
 * lock. Uske baad log lock band kar dete hain, aur phir koi lock hai hi nahi.
 */

/** "Is install par is user ka lock server se ek baar padha ja chuka hai." */
const SYNCED_PREFIX = "saathi-lock-synced:";

export function LockGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id;

  /** `null` = abhi pata nahi (SecureStore/server padha ja raha hai). */
  const [locked, setLocked] = useState<boolean | null>(null);

  /**
   * Pehli baar server se poochha ja raha hai — tab tak KUCH nahi dikhate.
   *
   * ⚠️ Ye is component ka sabse zaroori hissa hai. Naye phone par (ya uninstall
   * ke baad) phone par koi PIN hota hi nahi, isliye local jaanch hamesha "lock
   * nahi hai" kehti hai. Bina is intezaar ke user ke saare documents ek pal ke
   * liye — ya poori tarah — khul jaate, jabki usne lock laga rakha hai. Wahi
   * poora chhed tha jise ye feature band karta hai.
   *
   * Ye intezaar ek hi baar hota hai: kaamyaab hone par is install par is user ke
   * naam ek nishaan chhod dete hain, aur uske baad har launch turant chalta hai
   * (server sync peeche chupchaap hota rehta hai).
   */
  const [gateReady, setGateReady] = useState(false);

  /** Kis uid ka server sync is session me ho chuka hai — dobara na chale. */
  const syncedFor = useRef<string | null>(null);

  const evaluate = useCallback(async () => {
    const st = await getLockState();
    if (!st.enabled) {
      setLocked(false);
      return;
    }
    setLocked(needsUnlock());
  }, []);

  /**
   * Account ka lock is phone par le aao.
   *
   * Pehli baar (is install par is user ke liye) hum ISKA INTEZAAR karte hain.
   * Uske baad ye peeche chalta hai — user ko har launch par network ka intezaar
   * karana lock ko dheema aur chidhchida bana deta hai.
   */
  const pull = useCallback(
    async (blocking: boolean) => {
      if (!uid) return;
      try {
        await syncAppLock();
        // Nishaan sirf KAAMYAAB sync par. Fail (net nahi) par nahi — warna
        // pehli baar offline khulne se lock hamesha ke liye chhoot jaata.
        await AsyncStorage.setItem(`${SYNCED_PREFIX}${uid}`, "1").catch(() => {});
      } catch {
        /* net nahi — local jo hai wahi chalega */
      }
      await evaluate();
      if (blocking) setGateReady(true);
    },
    [uid, evaluate],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Logged out — server se poochne ko kuch hai hi nahi.
      if (!uid) {
        if (!alive) return;
        setGateReady(true);
        await evaluate();
        return;
      }
      if (syncedFor.current === uid) return;
      syncedFor.current = uid;

      const seen = await AsyncStorage.getItem(`${SYNCED_PREFIX}${uid}`).catch(() => null);
      if (!alive) return;

      if (seen === "1") {
        // Pehle se pata hai — turant local jaanch, sync peeche.
        setGateReady(true);
        await evaluate();
        void pull(false);
        return;
      }
      // Naya phone / naya install — yahan intezaar zaroori hai (upar wajah).
      await pull(true);
    })();
    return () => {
      alive = false;
    };
  }, [uid, evaluate, pull]);

  // Logout — khidki band. Lock khud neeche render me hat jaata hai (`uid` na ho
  // to lock dikhana bekaar hai: bina session ke andar kuch hai hi nahi).
  useEffect(() => {
    if (!uid) {
      resetGrace();
      syncedFor.current = null;
    }
  }, [uid]);

  /**
   * Background se wapas — khidki nikal gayi ho to phir se poocho.
   *
   * ⚠️ Background me JAATE waqt bhi ek kaam hota hai: `markBackgrounded()`.
   * Uske bina khidki KHOLNE ke waqt se naapi jaati thi — yaani ghadi tab bhi
   * chal rahi hoti thi jab user app ke andar hi kaam kar raha ho. Isliye 5
   * minute app chalane ke baad camera 10 second ke liye kholne par bhi lock lag
   * jaata tha. Ab ghadi sirf tab chalti hai jab app sach me bahar ho.
   *
   * `setLocked(true)` yahan phir bhi nahi karte — wo app switcher me lock
   * screen ki jhalak dikha deta, jo bhadda lagta hai.
   */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        void evaluate();
        // Doosre phone par PIN badla ho sakta hai — chupchaap mila lo.
        if (uid) void syncAppLock().catch(() => {});
      } else markBackgrounded();
    });
    return () => sub.remove();
  }, [evaluate, uid]);

  /**
   * Jab tak pata na chale tab tak KUCH bhi nahi dikhate.
   *
   * ⚠️ Yahan children dikha dena poora lock bekaar kar deta: jitni der me pata
   * chalta hai, utni der ke liye documents khule dikh jaate hain — aur
   * screenshot lene ke liye utna hi kaafi hai.
   */
  if (!gateReady || locked === null) return <ScreenLoader />;
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
