"use client";

import {
  BUILTIN_FONTS,
  fontEntryForAsset,
  mergeFonts,
  missingFonts,
  parseFontsJson,
  type Doc,
  type FontEntry,
} from "@reel/core";

import { getAssetUrl } from "@/lib/assetUrls";
import { useEffect, useState } from "react";

/**
 * Studio ka font loader (9.10).
 *
 * List do hisson me banti hai: built-in system fonts (`@reel/core`) + jo
 * `studio/public/fonts/fonts.json` me likhe hon. Wahi mili hui list `<Player>`
 * ke `inputProps.fonts` me jaati hai, aur composition uske `@font-face` khud
 * lagati hai — isliye preview aur render me **ek hi** font chalta hai.
 *
 * Font jodne ke **do** raaste hain, aur dono ek hi list me milte hain:
 *
 *   1. **Upload** — library ke "Fonts" tab me `.woff2/.ttf/.otf` daalo. Wo asset
 *      ban jaata hai aur font-picker me apne aap aa jaata hai. Aam user ke liye
 *      yahi raasta hai.
 *   2. **Repo me file** — `studio/public/fonts/` + `fonts.json`. Ye un fonts ke
 *      liye hai jo har machine par saath chahiye (build me jaate hain).
 *
 * ⚠️ Upload wale font ka `@font-face` uske **signed URL** par banta hai, aur wahi
 * entry `inputProps.fonts` me jaati hai. Render ke waqt worker usi file ko apne
 * `publicDir` me utaar kar entry ka raasta badal deta hai (`worker/src/fonts.ts`)
 * — isliye MP4 me bhi wahi font aata hai jo preview me dikha tha.
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
        const parsed = parseFontsJson(await response.json());
        if (parsed === null) {
          /*
           * File thi, JSON bhi theek tha — par shakl samajh nahi aayi. Isko
           * chup-chaap chhod dena hi wo jaal hai jisme ghante jaate hain:
           * dropdown me font nahi aata aur kahin kuch likha bhi nahi hota.
           */
          console.warn(
            "[fonts] public/fonts/fonts.json padhi to gayi par usme font ki list nahi mili. " +
              'Chahiye: [{ "id": "...", "label": "...", "files": [...] }] ya { "fonts": [ ... ] }.',
          );
        } else {
          extra = parsed;
        }
      }
    } catch {
      // fonts.json hai hi nahi — bilkul aam halat, upar wala ⚠️ dekho.
    }
    /*
     * Upload kiye hue font bhi usi list me. Ye fail ho jaye to sirf wo fonts
     * nahi milte — baaki editor chalta rehna chahiye, isliye poora try/catch.
     */
    let uploaded: FontEntry[] = [];
    try {
      const response = await fetch("/api/assets?tab=fonts", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { assets?: { id: string; filename: string }[] };
        const rows = data.assets ?? [];
        uploaded = await Promise.all(
          rows.map(async (row) =>
            fontEntryForAsset({
              id: row.id,
              filename: row.filename,
              src: await getAssetUrl(row.id),
            }),
          ),
        );
      }
    } catch {
      // Net gaya ya route nahi hai — system fonts se kaam chalta rahega.
    }

    // Kram maayne rakhta hai: baad wali entry pehli ko dhak deti hai
    // (`mergeFonts`), aur upload kiya hua font `fonts.json` par bhaari hona
    // chahiye — user ne use abhi chuna hai.
    cache = mergeFonts([...extra, ...uploaded]);
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
