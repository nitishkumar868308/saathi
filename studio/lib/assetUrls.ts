"use client";

import { useEffect, useState } from "react";

/**
 * Signed URL ka client-side cache (checklist 5.10).
 *
 * ⚠️ **URL kabhi doc me nahi jaata** — Phase 1 ka locked rule. Doc me sirf
 * `assetId` rehti hai; URL yahan se milta hai aur marne se pehle apne aap naya
 * bhi ho jaata hai.
 *
 * Cache ki asli zaroorat scroll par dikhti hai: 200 assets ke grid me har
 * re-render par 200 request bhejna bilkul aam galti hai. Yahan ek hi request
 * chalti hai (`inflight` map), aur uska jawab sab ke saath baant diya jaata hai.
 *
 * URL apni maut se **thoda pehle** hi purana maan liya jaata hai (`SAFETY_MS`) —
 * warna ek image theek us waqt load hoti hai jab URL do second baad marne wala
 * ho, aur wo kabhi-kabhi toot jaati hai. Wo kism ka bug pakadna sabse mushkil hota hai.
 */

interface CacheEntry {
  url: string;
  /** epoch ms — iske baad naya maangna hai. */
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

/** URL ko marne se itna pehle hi purana maan lo. */
const SAFETY_MS = 60_000;

function cacheKey(assetId: string, thumb: boolean): string {
  return thumb ? `${assetId}:thumb` : assetId;
}

export async function getAssetUrl(assetId: string, options: { thumb?: boolean } = {}): Promise<string> {
  const thumb = options.thumb ?? false;
  const key = cacheKey(assetId, thumb);

  const hit = cache.get(key);
  if (hit && hit.expiresAt - SAFETY_MS > Date.now()) return hit.url;

  const running = inflight.get(key);
  if (running) return running;

  const request = (async () => {
    const response = await fetch(`/api/assets/${assetId}/url${thumb ? "?thumb=1" : ""}`);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { reason?: string };
      throw new Error(data.reason ?? `URL nahi mila (${response.status})`);
    }
    const data = (await response.json()) as { url: string; expiresAt: string };
    cache.set(key, { url: data.url, expiresAt: new Date(data.expiresAt).getTime() });
    return data.url;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

/** Asset badla ya mit gaya — uska URL bhool jao. */
export function forgetAssetUrl(assetId: string): void {
  cache.delete(cacheKey(assetId, false));
  cache.delete(cacheKey(assetId, true));
}

/**
 * Component me use karne ka tarika.
 *
 * Asset gayab ho jaaye (delete) to `error` aata hai aur UI placeholder dikhata
 * hai — chupchaap tooti hui image dikhane se behtar hai saaf batana.
 */
export function useAssetUrl(
  assetId: string | null,
  options: { thumb?: boolean } = {},
): { url: string | null; error: string | null } {
  const thumb = options.thumb ?? false;
  const [state, setState] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null,
  });

  useEffect(() => {
    if (!assetId) {
      setState({ url: null, error: null });
      return;
    }

    let alive = true;
    getAssetUrl(assetId, { thumb })
      .then((url) => {
        if (alive) setState({ url, error: null });
      })
      .catch((error: unknown) => {
        if (alive) {
          setState({
            url: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      alive = false;
    };
  }, [assetId, thumb]);

  return state;
}
