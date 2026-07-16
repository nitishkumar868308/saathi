import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_LOCALE,
  LOCALES,
  dictionaries,
  type Dict,
  type Locale,
} from "./dictionaries";

const STORAGE_KEY = "saathi-locale";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** true jab tak saved preference load nahi hui — app splash isi tak rukta hai. */
  ready: boolean;
  /** false = user ne abhi tak bhasha choose nahi ki (pehli baar). */
  chosen: boolean;
  t: Dict;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!alive) return;
        if (saved && (LOCALES as readonly string[]).includes(saved)) {
          setLocaleState(saved as Locale);
          setChosen(true);
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setChosen(true);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({ locale, setLocale, ready, chosen, t: dictionaries[locale] }),
    [locale, setLocale, ready, chosen],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT/useLocale ko LanguageProvider ke andar use karo");
  return ctx;
}

/** Poora dictionary (current bhasha ka). `const t = useT();  t.home.greeting` */
export function useT(): Dict {
  return useCtx().t;
}

/** Bhasha padho/set karo + status. */
export function useLocale() {
  const { locale, setLocale, ready, chosen } = useCtx();
  return { locale, setLocale, ready, chosen };
}
