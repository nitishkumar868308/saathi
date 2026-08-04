"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { resolveTheme, useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Har page par mila hua theme switch.
 *
 * ⚠️ Ye root layout me lagta hai, kisi header me nahi — aur wahi iski poori
 * wajah hai. Site ke aadhe se zyada pages ka apna header hai hi nahi (about,
 * privacy, terms, contact, referral, /r/[code], aur poora admin). Header me
 * daalne par un pages par switch milta hi nahi, aur "har screen par" wali baat
 * adhoori reh jaati.
 *
 * Bottom-right isliye ki content upar se neeche bahta hai; wahan koi control
 * nahi hota. `pointer-events-none` wale wrapper ke andar rakha hai taaki iske
 * aas-paas ki khaali jagah page ke click na khaye.
 */
export default function ThemeFab() {
  const [theme, setTheme] = useTheme();
  const t = useT();

  /**
   * Server par theme pata nahi hoti, isliye pehla render hamesha "light" maanta
   * hai. Us halat me icon dikhana galat ho sakta hai (dark wale user ko ek pal
   * ke liye ulta icon), isliye mount hone tak kuch nahi dikhate.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  // Icon wo KAAM dikhata hai jo hoga, abhi ka haal nahi — ye button hai, batti
  // nahi. Chaand = "gehra kar do".
  const goingDark = resolveTheme(theme) === "light";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={() => setTheme(goingDark ? "dark" : "light")}
        aria-label={goingDark ? t.theme.dark : t.theme.light}
        title={goingDark ? t.theme.dark : t.theme.light}
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-terracotta shadow-soft transition hover:bg-cream-deep"
      >
        {goingDark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  );
}
