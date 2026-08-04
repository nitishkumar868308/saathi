"use client";

import { useEffect, useState } from "react";

/**
 * Light / dark / system — website aur admin, dono ke liye.
 *
 * Teen chunav hain, do nahi. "System" ka hona zaroori hai: bahut log apna phone
 * shaam ko apne aap dark karte hain, aur unke liye website ka din bhar light
 * rehna hi galat lagta hai. Par jis din wo khud ek theme chun lete hain, wo
 * chunav OS ke faisle se upar rehna chahiye — isliye Tailwind me `darkMode:
 * "class"` hai, media query nahi.
 */

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_KEY = "saathi-theme";

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/** Abhi jo save hai. Server par kuch nahi hota, isliye wahan "system". */
export function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    // Private mode me localStorage throw karta hai — default se kaam chalega.
    return "system";
  }
}

/** `system` ko asli light/dark me badlo. */
export function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** `<html>` par class lagao — Tailwind isi ko dekhta hai. */
export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(t) === "dark");
}

/**
 * Page load par theme lagane wala script.
 *
 * ⚠️ Ye `<head>` me, React se PEHLE chalna zaroori hai. React ke baad lagane par
 * dark mode wale user ko pehli render par poori safed screen dikhti hai aur phir
 * wo kaali hoti hai — wahi jhatka jise "flash of wrong theme" kehte hain, aur wo
 * dark mode ki sabse aam shikayat hai.
 *
 * Isliye ye jaan-boojh ke ek chhota, blocking, inline script hai.
 */
export const THEME_SCRIPT = `(function(){try{
var k=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var d=k==="dark"||((k===null||k==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
}catch(e){}})();`;

/** Theme padhne aur badalne ka hook. */
export function useTheme(): [Theme, (t: Theme) => void] {
  // Server aur pehle client render — dono par "system", warna hydration mismatch.
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(readTheme());
  }, []);

  // "system" chuna ho to OS ke badalne par turant badle — user ne yahi maanga hai.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* save na ho to is session me to laga hi rahega */
    }
  }

  return [theme, setTheme];
}
