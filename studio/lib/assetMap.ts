"use client";

import type { Doc } from "@reel/core";
import type { AssetMap } from "@reel/remotion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssetUrl } from "@/lib/assetUrls";

/**
 * Doc ke `assetId` -> asli URL ka naksha, preview ke liye.
 *
 * ⚠️ Doc me URL kabhi nahi hota (Phase 1 ka locked faisla) — sirf `assetId`.
 * URL har baar yahan banta hai aur `inputProps.assets` me player ko jaata hai.
 * Yahi cheez worker bhi karta hai render se pehle, isliye preview aur render
 * dono ko ek jaisa naksha milta hai.
 *
 * Jo asset nahi milta (delete ho gaya, ya kabhi tha hi nahi) wo naksha me aata
 * hi nahi — aur tab composition uske liye `<MissingAsset>` ka bhadkeela card
 * dikhata hai (6.11). Uski wajah `missing` me alag se milti hai taaki UI usse
 * seedhe shabdon me bata sake, chupchaap khaali frame na dikhaye.
 */

/**
 * Naksha dobara banane ka antaraal.
 *
 * Signed URL 15 minute ke hote hain (`/api/assets/[id]/url`). Ek session ghanton
 * chal sakta hai, aur URL beech me marne par preview me media chupchaap toot
 * jaati — isliye TTL se kaafi pehle hi naya maang lete hain. `getAssetUrl` ka
 * apna cache is call ko sasta rakhta hai: jo URL abhi taaza hai wo network par
 * jaata hi nahi.
 */
const REFRESH_INTERVAL_MS = 5 * 60_000;

export interface ResolvedAssets {
  assets: AssetMap;
  /** Jo assetId doc me hain par URL nahi mila. */
  missing: string[];
  loading: boolean;
}

/** Doc me kis-kis asset ki zaroorat hai — sthir kram me, taaki key badalti na rahe. */
export function assetIdsInDoc(doc: Doc): string[] {
  const ids = new Set<string>();
  for (const item of doc.items) {
    if (item.assetId) ids.add(item.assetId);
  }
  return [...ids].sort();
}

export function useAssetMap(doc: Doc): ResolvedAssets {
  const ids = useMemo(() => assetIdsInDoc(doc), [doc]);
  // Key se compare karne par naya doc (har edit par naya object) bekaar me
  // dobara resolve nahi karwata — sirf asset ki list badle tabhi kaam hota hai.
  const key = ids.join(",");

  const [state, setState] = useState<ResolvedAssets>({
    assets: {},
    missing: [],
    loading: ids.length > 0,
  });

  const idsRef = useRef(ids);
  idsRef.current = ids;

  const resolve = useCallback(async () => {
    const wanted = idsRef.current;
    if (wanted.length === 0) {
      setState({ assets: {}, missing: [], loading: false });
      return;
    }

    const results = await Promise.all(
      wanted.map(async (id) => {
        try {
          return { id, url: await getAssetUrl(id) };
        } catch {
          // Wajah yahan nigal li jaati hai aur ye jaan-boojhkar hai: har asset
          // ke liye alag error dikhane se panel bhar jaata. `missing` me naam
          // aata hai, aur frame me card — utna kaafi saaf hai.
          return { id, url: null };
        }
      }),
    );

    // Beech me doc badal gaya ho (asset delete/add) to purana jawab mat likho.
    if (idsRef.current.join(",") !== wanted.join(",")) return;

    const assets: AssetMap = {};
    const missing: string[] = [];
    for (const result of results) {
      if (result.url) assets[result.id] = result.url;
      else missing.push(result.id);
    }
    setState({ assets, missing, loading: false });
  }, []);

  useEffect(() => {
    let alive = true;
    setState((previous) => ({ ...previous, loading: true }));
    void resolve().finally(() => {
      if (!alive) return;
    });

    const timer = setInterval(() => void resolve(), REFRESH_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key, resolve]);

  return state;
}
