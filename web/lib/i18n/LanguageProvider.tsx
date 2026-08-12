"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  dictionaries,
  type Dict,
  type Locale,
} from "./dictionaries";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "saathi-locale";

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/**
 * `<html lang>` bhi bhasha ke saath chale.
 *
 * ⚠️ Ye pehle sirf `setLocale` me set hota tha — yaani jab user is visit me
 * bhasha BADALTA tha. Page load par saved bhasha lag jaati thi par `lang`
 * attribute HTML me likha hua purana hi rehta tha. Screen reader usi ko padh
 * kar galat lehje me bolta hai, aur crawler bhi wahi bhasha darj karta hai.
 */
function markHtmlLang(l: Locale): void {
  document.documentElement.lang = l === "en" ? "en" : "hi";
}

/**
 * Website ki bhasha SIRF is browser ki hai.
 *
 * ⚠️ Ise account se jodne ki koshish mat karna. Web par login/signup hai hi
 * nahi — yahan aane wala aksar wo hota hai jisne app dekhi bhi nahi. Jo bhasha
 * wo yahan chunta hai, wahi is browser me chalti rehti hai; app aur uske
 * email/WhatsApp ki bhasha alag jagah se aati hai (`profiles.language`, jise app
 * ka switcher likhta hai aur server `localeForUser` se padhta hai). Dono ka
 * apna-apna ghar hai, aur yahi theek hai.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Load saved preference on mount (default stays Hinglish for SSR).
  useEffect(() => {
    let saved: Locale | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(raw)) {
        saved = raw;
        setLocaleState(raw);
      }
    } catch {
      /* ignore */
    }
    markHtmlLang(saved ?? DEFAULT_LOCALE);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    markHtmlLang(l);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ locale, setLocale, t: dictionaries[locale] }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

/** Shortcut: just the current dictionary. */
export function useT(): Dict {
  return useLanguage().t;
}
