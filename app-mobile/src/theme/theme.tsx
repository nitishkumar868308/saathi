import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { darkColors, lightColors, type Colors } from "./colors";

/**
 * App ki theme — light, dark, ya phone ke hisaab se.
 *
 * ⚠️ React Native me `StyleSheet.create({...})` module load par EK BAAR chalta
 * hai aur rang us waqt ke value se pakde jaate hain. Isliye ek "colors" object
 * ko chupchaap badal dena kaam nahi karta: purani styles wahi purane rang leke
 * baithi rehti hain, aur theme badalne par aadhi screen light aur aadhi dark ho
 * jaati hai.
 *
 * Iska ek hi saaf hal hai — styles ko ek FUNCTION banao jo rang leta ho, aur
 * use component ke andar se bulao. Wahi `makeStyles` karta hai.
 */

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const KEY = "saathi-theme";
export const DEFAULT_MODE: ThemeMode = "system";

function isMode(v: unknown): v is ThemeMode {
  return typeof v === "string" && (THEME_MODES as readonly string[]).includes(v);
}

type Ctx = {
  colors: Colors;
  mode: ThemeMode;
  /** `system` ko suljha kar — abhi sach me kaunsi theme chal rahi hai. */
  scheme: "light" | "dark";
  setMode: (m: ThemeMode) => void;
};

const ThemeCtx = createContext<Ctx>({
  colors: lightColors,
  mode: DEFAULT_MODE,
  scheme: "light",
  setMode: () => {},
});

/**
 * Phone ne kya kaha.
 *
 * Apna type isliye (RN ka `ColorSchemeName` nahi): `Appearance.getColorScheme()`
 * `undefined` bhi de sakta hai (app abhi background me ho) par RN ke type me
 * undefined hai hi nahi — yaani unka apna type unke apne function ke saath
 * nahi baithta. `null` = "abhi pata nahi", aur wo light ki tarah hi bartaa
 * jaata hai.
 */
type SystemScheme = "light" | "dark" | null;

/**
 * RN ka `ColorSchemeName` teen se zyada cheezein de sakta hai — `"unspecified"`
 * aur `undefined` bhi. Dono ka matlab ek hi hai: "phone ne kuch nahi bataya".
 * Unhe `null` bana ke aage ka poora code sirf teen soorat sambhalta hai.
 */
function normalize(v: string | null | undefined): SystemScheme {
  return v === "dark" ? "dark" : v === "light" ? "light" : null;
}

function resolve(mode: ThemeMode, system: SystemScheme): "light" | "dark" {
  if (mode !== "system") return mode;
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  // `?? null` — kuch RN versions par `getColorScheme()` undefined bhi de sakta
  // hai (app abhi background me ho), aur ColorSchemeName me undefined nahi hai.
  const [system, setSystem] = useState<SystemScheme>(
    normalize(Appearance.getColorScheme()),
  );

  // Save ki hui pasand — app start par ek baar.
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(KEY)
      .then((v) => {
        if (alive && isMode(v)) setModeState(v);
      })
      .catch(() => {
        /* storage na chale to default hi theek hai */
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Phone ki apni theme badle to turant follow karo.
   *
   * Ye listener `mode` par nirbhar nahi hai (aur jaan-boojh ke): `system` ka
   * matlab hi hai "phone jo kahe". Listener har waqt chalta rehta hai aur bas
   * `system` ki value taaza rakhta hai; use lagana hai ya nahi, wo `resolve`
   * tay karta hai.
   */
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystem(normalize(colorScheme)),
    );
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const scheme = resolve(mode, system);
    return {
      scheme,
      mode,
      setMode,
      colors: scheme === "dark" ? darkColors : lightColors,
    };
  }, [mode, system, setMode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Abhi ke rang — JSX me seedhe use karne ke liye (icon color, etc.). */
export function useColors(): Colors {
  return useContext(ThemeCtx).colors;
}

/** Settings screen ke liye — mode padho aur badlo. */
export function useThemeMode(): Ctx {
  return useContext(ThemeCtx);
}

/**
 * Theme-aware StyleSheet.
 *
 * Use karne ka tareeka — module ke aakhir me:
 *
 *     const useStyles = makeStyles((c) => ({
 *       safe: { flex: 1, backgroundColor: c.cream },
 *     }));
 *
 * ...aur component ke andar:
 *
 *     const styles = useStyles();
 *
 * Har theme ka StyleSheet ek hi baar banta hai aur cache me reh jaata hai —
 * isliye ye har render par naya object nahi banata, aur purane
 * `StyleSheet.create` jitna hi halka rehta hai.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: Colors) => T,
): () => T {
  const cache = new Map<Colors, T>();

  return function useStyles(): T {
    const c = useColors();
    let s = cache.get(c);
    if (!s) {
      s = StyleSheet.create(factory(c));
      cache.set(c, s);
    }
    return s;
  };
}
