"use client";

import { secondsToFrames } from "@reel/core";
import { useEffect, useState } from "react";

import type { Asset } from "@/lib/assets";

/**
 * Asset ka naap — uski **asli lambai** aur **asli pixels**.
 *
 * Do jagah ye zaroori hai:
 *  - trim ka daayan kinara source ke ant par ruke (8.3). Uske bina clip source
 *    se aage khinch jaati hai aur render me wahan **kaala frame** aata hai — jo
 *    timeline me bilkul theek dikhta hai aur sirf final MP4 me pakda jaata hai.
 *  - effective resolution ka readout (9.6c) — "480p ko 1080p frame me 2.2x bada
 *    kiya ja raha hai" wali baat asli source pixels ke bina ho hi nahi sakti.
 *
 * Dono numbers Phase 5 ke asli ffprobe se aaye the, andaaze se nahi.
 *
 * ⚠️ Ek hi request me poori list aati hai (`GET /api/assets`), har asset ke liye
 * alag nahi. Timeline par 200 clips ho sakti hain; 200 request bhejna sirf
 * pehli baar theek lagta hai.
 *
 * ⚠️ Sab kuch `null` ho sakta hai — image ki koi lambai nahi hoti, audio ke koi
 * pixels nahi, aur probe fail ho chuka ho to hum kuch bhi nahi jaante. Aise me
 * **koi hadd aur koi warning nahi** lagti: andaaze se hadd laga dena user ki
 * clip chup-chaap kaat deta, aur andaaze se warning dena chetavni ka matlab hi
 * khatam kar deta hai.
 */

interface Cached {
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

let cache: Map<string, Cached> | null = null;
let inflight: Promise<Map<string, Cached>> | null = null;

/**
 * Jo log is list par tike hue hain — taaki list badalne par unhe **bataya** ja sake.
 *
 * WARNING: Sirf `cache = null` kar dena kaafi nahi tha, aur us bharam ne ek asli
 * bug kaee din chhupaye rakha. Har hook apni copy `useState` me rakhta hai aur
 * uska effect `[]` par hai — yaani wo dobara padhta hi nahi. Module ka cache
 * saaf karne se sirf **agla** mount taaza hota hai; jo pehle se khule hain wo
 * purani list par ateke rehte hain.
 *
 * Nateeja kya dikhta tha: wizard ne 8 awaaz banayi, doc me daal di, aur Export
 * ka button chup-chaap band ho gaya — "asset nahi mila", jabki asset DB me
 * maujood thi. Us halat me na koi error aata hai na koi wajah; user ko lagta hai
 * ki Export dabane par kuch hota hi nahi. Isliye ab list badalne ki khabar
 * har sune wale tak jaati hai.
 */
const listeners = new Set<() => void>();

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
          next.set(asset.id, {
            durationMs: asset.durationMs,
            width: asset.width,
            height: asset.height,
          });
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

/**
 * Naya asset bana / mit gaya — list purani ho gayi, sabko taaza karo.
 *
 * Jahan bhi asset banti ya mitti hai wahin se ye bulao (upload, TTS, delete).
 * Bhool jaane par galti chup rehti hai aur bahut door jaakar dikhti hai.
 */
export function forgetAssetMeta(): void {
  cache = null;
  inflight = null;
  for (const listener of listeners) listener();
}

export interface AssetSize {
  width: number;
  height: number;
}

export interface AssetMeta {
  /** Source ki lambai project ke frames me — `null` = pata nahi / hadd nahi. */
  sourceFrames(assetId: string | null): number | null;
  /** Source ke asli pixels — `null` = pata nahi (ya audio hai). */
  sourceSize(assetId: string | null): AssetSize | null;
  loaded: boolean;
}

export function useAssetDurations(fps: number): AssetMeta {
  const [map, setMap] = useState<Map<string, Cached> | null>(cache);

  useEffect(() => {
    let alive = true;
    const pull = (): void => {
      void loadAll().then((next) => {
        if (alive) setMap(next);
      });
    };
    pull();
    listeners.add(pull);
    return () => {
      alive = false;
      listeners.delete(pull);
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
    sourceSize(assetId) {
      if (!assetId || !map) return null;
      const entry = map.get(assetId);
      if (!entry?.width || !entry.height) return null;
      return { width: entry.width, height: entry.height };
    },
  };
}
