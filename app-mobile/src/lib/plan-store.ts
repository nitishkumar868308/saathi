import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { getPlan, type PlanInfo } from "./plan";

/**
 * Plan ek jagah — poore app ke liye ek hi sach.
 *
 * ⚠️ Pehle `usePlan()` sidha ek hook tha jo HAR component me apni alag copy
 * rakhta tha aur apni alag `getPlan()` call karta tha. Do dikkatein isse aati
 * thin, aur dusri wali wahi shikayat hai ki "referral se Plus mil gaya par
 * upgrade wala hat hi nahi raha":
 *
 *  1. **Har jagah alag jawab.** Home, Documents, Reminders aur Chat — chaaron
 *     tab ek saath mounted rehte hain (tab navigator unhe chhodta nahi), aur
 *     chaaron ki apni copy thi. Ek refresh ho jaati, doosri purani pade rehti.
 *     Isliye ek tab par banner gayab hota tha aur baaki teen par baitha rehta.
 *
 *  2. **Refresh ka mauka bahut kam.** Purana hook sirf do cheezon par dobara
 *     padhta tha: session badle ya `rewardsVersion` badle. `rewardsVersion` sirf
 *     app khulne par badalta hai. Yaani jis user ko Plus BEECH SESSION me mila
 *     (referral qualify hote hi, ya Play se kharidte hi) uske screen par upgrade
 *     ka upsell app band-khol-ne tak baitha rehta tha — usi cheez ka, jo usne
 *     abhi le liya hai.
 *
 * Ab ek hi cache, ek hi call, aur refresh ke chaar mauke: session/rewards badle,
 * app foreground me aaye, data badle (document/reminder ban gaya — yahi referral
 * qualify karta hai), ya kisi ne khud `refreshPlan()` bulaya.
 */

const FREE: PlanInfo = { plan: "free", isPlus: false, expiresAt: null, source: null };

type Snapshot = PlanInfo & { loading: boolean };

/** Pehli baar tak "loading" — warna Plus user ko ek pal ke liye upsell jhalakta. */
let snapshot: Snapshot = { ...FREE, loading: true };

const listeners = new Set<() => void>();

/** Ek waqt me ek hi network call — chaar screens ek saath poochein to bhi. */
let inflight: Promise<void> | null = null;

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Ek screen ka re-render fail ho to baaki na ruken.
    }
  });
}

/**
 * Plan dobara padho.
 *
 * Fail hone par purana jawab RAKHA jaata hai, `free` par nahi girta. Wajah: net
 * ek pal ke liye toot jaana bahut aam hai, aur us pal me Plus user ko "Plus lo"
 * dikha dena sabse bura anubhav hai — usne paise diye hain. Sirf pehli baar,
 * jab kuch pata hi nahi, `free` maante hain.
 */
export function refreshPlan(): Promise<void> {
  if (inflight) return inflight;
  inflight = getPlan()
    .then((p) => publish({ ...p, loading: false }))
    .catch(() => {
      publish({ ...snapshot, loading: false });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Logout — cache saaf.
 *
 * Iske bina agla user (ya wahi user dobara login karke) ek pal ke liye pichhle
 * wale ka plan dekh leta: free user ko Plus wali screen, ya ulta.
 */
export function clearPlanCache(): void {
  publish({ ...FREE, loading: true });
}

/**
 * Abhi ka plan, bina hook ke.
 *
 * Un jagahon ke liye jahan React ka render chal hi nahi raha — jaise reward
 * pipeline, jo ek event handler se chalti hai aur sirf ye jaanna chahti hai ki
 * "kuch paane ko bacha hai kya".
 */
export function getPlanSnapshot(): Snapshot {
  return snapshot;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Current plan, poore app me ek jaisa.
 *
 * `useSyncExternalStore` isliye, apna `useState`-force-render nahi: React ko ye
 * batana zaroori hai ki data BAHAR rehta hai. Warna concurrent render me kuch
 * screens purana snapshot aur kuch naya padh sakti hain (tearing) — aur is store
 * ka poora maqsad hi ye hai ki sab jagah ek hi jawab dikhe.
 *
 * ⚠️ `publish()` hamesha ek NAYA object banata hai. Ye is API ki shart hai: wo
 * `Object.is` se purane-naye snapshot ko milata hai, aur usi object ko mutate
 * karte to badlaav kabhi dikhta hi nahi.
 */
export function usePlanSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/**
 * App wapas saamne aayi — plan dobara poochho.
 *
 * ⚠️ Ye chhota sa hook sabse zyada kaam ka hai. Play Store ki kharidari app ke
 * BAHAR poori hoti hai (Google ka sheet, aur kabhi Play app), aur webhook server
 * par baad me pahunchta hai. User wapas aata hai — aur pehle wahi purana "Plus
 * lo" banner uska swagat karta tha.
 *
 * Ek hi baar mount hota hai (root `_layout` se), har screen se nahi — warna
 * chaar tab foreground par chaar call karte.
 */
export function usePlanForegroundRefresh(): void {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPlan();
    });
    return () => sub.remove();
  }, []);
}
