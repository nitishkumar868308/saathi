import type { ReactNode } from "react";

import { useNetworkStatus } from "@/lib/network";
import { useAuth } from "@/components/auth-provider";
import { OfflineScreen } from "@/components/offline-screen";

/**
 * Net na ho to poori app ki jagah sirf offline screen.
 *
 * ⚠️ Pehle offline me app poori khuli rehti thi aur sirf upar ek patli patti
 * aati thi ("Internet nahi hai"). Us patti ko log padhte hi nahi the — wo tap
 * karte rehte the aur har jagah ek alag tarah se fail hota tha: Documents ki
 * list khaali, chat ka jawab nahi, reminder "save ho gaya" par kahin dikhta
 * nahi, upgrade ka page adha khula. Har screen apna alag adhoora roop dikhati
 * thi, aur user ko lagta tha ki app hi tooti hui hai — internet ki baat uske
 * dimaag me aati hi nahi thi.
 *
 * Ab ek hi saaf baat hoti hai, aur uske saath wahi EK cheez jo sach me bina net
 * ke chalti hai: pehle se save kiye hue documents (dekhna / download / share).
 *
 * ── Kahan lagta hai, aur kahan JAAN-BOOJH KE nahi ─────────────────────
 *
 * `_layout.tsx` me ye `LockGate` ke ANDAR hai. Tarteeb maayne rakhti hai: lock
 * pehle, offline baad me. Ulta karne par net na hone par lock poori tarah bypass
 * ho jaata — koi bhi phone uthata, flight mode on karta, aur offline screen se
 * saare documents dekh leta. Lock ka matlab hi khatam.
 *
 * Aur ye sirf LOGGED-IN user par lagta hai. Logged out hone par offline screen
 * dikhane ka koi matlab nahi (dikhane ko koi document hai hi nahi) aur wo login
 * screen ko dhak deti — user ko lagta app khul hi nahi rahi. Us soorat me login
 * screen apni purani patli patti ke saath hi theek hai.
 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const { offline } = useNetworkStatus();
  const { session, loading } = useAuth();

  // Session abhi pata hi nahi — kuch faisla mat lo, warna app start hote hi ek
  // pal ke liye offline screen chamak jaati hai.
  if (loading) return <>{children}</>;
  if (offline && session?.user?.id) return <OfflineScreen />;
  return <>{children}</>;
}

export default OfflineGate;
