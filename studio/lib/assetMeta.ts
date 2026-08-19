"use client";

import { secondsToFrames } from "@reel/core";
import { useEffect, useState } from "react";

import type { Asset } from "@/lib/assets";

/**
 * Asset ka naap — khaas kar uski **asli lambai** (8.3).
 *
 * Trim ka daayan kinara source ke ant par rukna chahiye. Uske bina clip source
 * se aage khinch jaati hai aur render me wahan **kaala frame** aata hai — jo
 * timeline me bilkul theek dikhta hai aur sirf final MP4 me pakda jaata hai.
 * Wo lambai `reel_assets.duration_ms` me hai, jo Phase 5 ke asli ffprobe se
 * bhari thi.
 *
 * ⚠️ Ek hi request me poori list aati hai (`GET /api/assets`), har asset ke liye
 * alag nahi. Timeline par 200 clips ho sakti hain; 200 request bhejna sirf
 * pehli baar theek lagta hai.
 *
 * ⚠️ Lambai `null` ho sakti hai — image ka koi ant nahi hota, aur probe fail ho
 * chuka ho to bhi hum jaante nahi. Dono halat me trim par upar ki hadd **nahi**
 * lagti: andaaze se hadd laga dena user ki clip chup-chaap kaat deta.
 */

interface Cached {
  durationMs: number | null;
}

let cache: Map<string, Cached> | null = null;
let inflight: Promise<Map<string, Cached>> | null = null;

async function loadAll(): Promise<Map<string, Cached>> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const next = new Map<string, Cached>();
    try {
      const response = await fetch("/api/assets?tab=all");
      if (response.ok) {
        const data = (await response.json()) as { assets?: Asset[] };
        for (const asset of data.assets ?? []) {
          next.set(asset.id, { durationMs: asset.durationMs });
        }
      }
    } catch {
      // List na aaye to trim bina upar ki hadd ke chalta rahega — ye kaam rokne
      // layak galti nahi hai.
    }
    cache = next;
    inflight = null;
    return next;
  })();

  return inflight;
}

/** Naya asset upload hone par list purani ho jaati hai. */
export function forgetAssetMeta(): void {
  cache = null;
  inflight = null;
}

export interface AssetDurations {
  /** Source ki lambai project ke frames me — `null` = pata nahi / hadd nahi. */
  sourceFrames(assetId: string | null): number | null;
  loaded: boolean;
}

export function useAssetDurations(fps: number): AssetDurations {
  const [map, setMap] = useState<Map<string, Cached> | null>(cache);

  useEffect(() => {
    let alive = true;
    void loadAll().then((next) => {
      if (alive) setMap(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return {
    loaded: map !== null,
    sourceFrames(assetId) {
      if (!assetId || !map) return null;
      const durationMs = map.get(assetId)?.durationMs;
      if (durationMs === undefined || durationMs === null || durationMs <= 0) return null;
      return secondsToFrames(durationMs / 1000, fps);
    },
  };
}
