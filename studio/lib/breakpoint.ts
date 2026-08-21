"use client";

import { useEffect, useState } from "react";

/**
 * Screen ka naap — phone / tablet / desktop.
 *
 * ⚠️ **Ye Tailwind ke breakpoints se alag hai, aur jaan-boojhkar.** Tailwind ka
 * `md` 768px par hai kyunki wo aam page ke liye theek hai. Yahan sawaal alag
 * hai: **timeline editor kis chaudai par sach me chalta hai?** Wo 1280px se
 * neeche nahi chalta — teen column (media + preview + properties) aur neeche
 * timeline, sab ek saath. 1024px par bhi wo ghut jaata hai. Isliye editor ka
 * apna paimana hai, aur wo yahan ek hi jagah likha hai.
 *
 * ⚠️ Faisla **chaudai** se hota hai, "mobile device" se nahi. User-agent dekhna
 * hamesha galat nikalta hai: tablet ko phone samajh liya jaata hai, laptop ke
 * chhote window ko desktop, aur phone ko landscape ghumane par kuch nahi badalta.
 * Chaudai wahi cheez hai jo layout sach me tay karti hai.
 */

export type Screen = "phone" | "tablet" | "desktop";

/** Editor ka teen-column layout isse neeche ghut jaata hai. */
export const DESKTOP_MIN = 1280;
/** Isse neeche do pane bhi saath nahi aate — ek waqt me ek hi pane. */
export const TABLET_MIN = 768;

export function screenFor(width: number): Screen {
  if (!Number.isFinite(width) || width <= 0) return "desktop";
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "phone";
}

/**
 * Abhi kaun sa naap chal raha hai.
 *
 * ⚠️ Pehla render **hamesha `desktop`** hota hai, aur ye zaroori hai. Server ke
 * paas chaudai hoti hi nahi; agar client pehle render me hi asli naap laga de to
 * React hydration mismatch chillata hai aur poora tree dobara banta hai. Isliye
 * asli naap ek effect me aata hai — ek frame ka halka jhatka, par console saaf.
 */
export function useScreen(): Screen {
  const [screen, setScreen] = useState<Screen>("desktop");

  useEffect(() => {
    const update = () => setScreen(screenFor(window.innerWidth));
    update();

    /*
     * `resize` hi kaafi hai aur do media query se saaf bhi. Phone ghumane par
     * bhi yahi chalta hai, aur laptop par window kheenchne par bhi — dono ek hi
     * raaste se, isliye dono kabhi alag nahi ho sakte.
     */
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return screen;
}
