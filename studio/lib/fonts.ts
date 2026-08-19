"use client";

import { BUILTIN_FONTS, mergeFonts, missingFonts, type Doc, type FontEntry } from "@reel/core";
import { useEffect, useState } from "react";

/**
 * Studio ka font loader (9.10).
 *
 * List do hisson me banti hai: built-in system fonts (`@reel/core`) + jo
 * `studio/public/fonts/fonts.json` me likhe hon. Wahi mili hui list `<Player>`
 * ke `inputProps.fonts` me jaati hai, aur composition uske `@font-face` khud
 * lagati hai — isliye preview aur render me **ek hi** font chalta hai.
 *
 * Apna font jodna do kadam ka kaam hai:
 *   1. file `studio/public/fonts/` me rakho
 *   2. `fonts.json` me ek entry jodo
 * Code me kahin kuch nahi badalta.
 *
 * ⚠️ `fonts.json` na ho to ye **error nahi** hai — repo me koi font file commit
 * nahi hai (font ki apni licensing hoti hai). Us halat me sirf system fonts
 * chalte hain, jo har machine par hote hain.
 */

let cache: FontEntry[] | null = null;
let inflight: Promise<FontEntry[]> | null = null;

async function loadFonts(): Promise<FontEntry[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    let extra: FontEntry[] = [];
    try {
      const response = await fetch("/fonts/fonts.json");
      if (response.ok) {
        const data = (await response.json()) as { fonts?: FontEntry[] };
        if (Array.isArray(data.fonts)) extra = data.fonts;
      }
    } catch {
      // fonts.json hai hi nahi — bilkul aam halat, upar wala ⚠️ dekho.
    }
    cache = mergeFonts(extra);
    inflight = null;
    return cache;
  })();

  return inflight;
}

export interface LoadedFonts {
  fonts: readonly FontEntry[];
  /** Doc ne jo font maange par list me nahi hain — panel me chetavni ke liye. */
  missing: string[];
}

export function useFonts(doc: Doc): LoadedFonts {
  const [fonts, setFonts] = useState<readonly FontEntry[]>(cache ?? BUILTIN_FONTS);

  useEffect(() => {
    let alive = true;
    void loadFonts().then((next) => {
      if (alive) setFonts(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const requested = doc.items
    .map((item) => item.text?.fontFamily)
    .filter((name): name is string => Boolean(name));

  return { fonts, missing: missingFonts(fonts, requested) };
}
