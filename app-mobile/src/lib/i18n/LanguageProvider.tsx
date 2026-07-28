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

import { supabase } from "@/lib/supabase";
import { registerDevice } from "@/lib/device";
import {
  DEFAULT_LOCALE,
  LOCALES,
  dictionaries,
  type Dict,
  type Locale,
} from "./dictionaries";

const STORAGE_KEY = "saathi-locale";

const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** DB me user ki bhasha padho (cross-device source of truth). */
async function readDbLocale(): Promise<Locale | null> {
  if (!supabase) return null;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return null;
    const { data } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", uid)
      .maybeSingle();
    return isLocale(data?.language) ? (data!.language as Locale) : null;
  } catch {
    return null;
  }
}

/** DB me user ki bhasha likho (best-effort). */
async function writeDbLocale(l: Locale): Promise<void> {
  if (!supabase) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    await supabase.from("profiles").update({ language: l }).eq("id", uid);
  } catch {
    /* best-effort — local to save ho hi chuka hai */
  }
}

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

  // 1) Pehle local (turant) — splash isi tak rukta hai.
  //    Local me kuch na ho to device registry se poochho: ye phone pehle aa
  //    chuka hai kya? Aa chuka hai to uski purani bhasha lagao aur language
  //    screen skip — reinstall par dobara wahi sawaal poochhna bura lagta hai.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
        if (!alive) return;
        if (isLocale(saved)) {
          setLocaleState(saved);
          setChosen(true);
          return;
        }

        const dev = await registerDevice().catch(() => null);
        if (!alive || !dev?.known) return;
        // Purana device — bhasha pata ho to wahi, warna default. Dono soorat me
        // sawaal dobara nahi poochhte.
        if (isLocale(dev.language)) {
          setLocaleState(dev.language);
          AsyncStorage.setItem(STORAGE_KEY, dev.language).catch(() => {});
        }
        setChosen(true);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 2) DB source-of-truth: login hote hi user ki saved bhasha laao (doosre
  //    device par chuni ho to wahi lage). DB khaali ho par local chuni ho to
  //    local ko DB me push kar do.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    const sync = async () => {
      const dbLoc = await readDbLocale();
      if (!alive) return;
      if (dbLoc) {
        setLocaleState(dbLoc);
        setChosen(true);
        AsyncStorage.setItem(STORAGE_KEY, dbLoc).catch(() => {});
      } else {
        const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
        if (isLocale(saved)) writeDbLocale(saved);
      }
    };

    sync();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") sync();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setChosen(true);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
    writeDbLocale(l); // cross-device + emails
    // Device par bhi likh do — reinstall ke baad yahi bhasha wapas lagegi.
    registerDevice(l).catch(() => {});
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
