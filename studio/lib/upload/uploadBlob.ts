"use client";

import { sha256HexFromStream } from "@reel/core";

import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Browser me bani hui file ko library me daal do (26.26).
 *
 * ⚠️ Ye `useUploader` ka duplicate nahi hai, uska chhota bhai hai. Wo hook aadmi
 * ki chuni hui files ke liye hai: progress bar, cancel, kai file ek saath, har
 * ek ka apna card. Yahan ek hi file hai, wo humne khud banayi hai, aur wo 300KB
 * ki hai — uske liye wo poora tantr sirf bojh hai.
 *
 * Par raasta **bilkul wahi** hai: presign → PUT → complete. Alag raasta banane
 * par ek din wo dono alag ho jaate: ek me duplicate ki jaanch hoti aur doosre me
 * nahi, ya ek probe chalata aur doosra nahi — aur us farak ka pata bahut baad me
 * chalta.
 *
 * ⚠️ Duplicate ki jaanch **muft me mil jaati hai**, aur yahan wo khaas kaam ki
 * hai. Canvas ka nateeja usi input par har baar wahi bytes deta hai, isliye wahi
 * tasveer wahi harkat ke saath dobara fit karne par checksum mil jaata hai aur
 * server pehle wali file hi lauta deta hai — na naya upload, na gallery me ek aur
 * copy.
 */

export interface UploadedBlob {
  assetId: string;
  /** Wahi file pehle se thi (checksum mil gaya) — naya upload hua hi nahi. */
  duplicate: boolean;
}

export async function uploadBlob(args: {
  blob: Blob;
  filename: string;
  tags?: readonly string[];
  /** Browser pehle se jaanta hai ki naap kya hai — probe aane tak yahi dikhta hai. */
  width?: number;
  height?: number;
}): Promise<UploadedBlob> {
  const checksum = await sha256HexFromStream(args.blob.stream());

  const presign = (await postJson("/api/assets/presign", {
    filename: args.filename,
    mime: args.blob.type || "application/octet-stream",
    bytes: args.blob.size,
    checksum,
  })) as {
    duplicate?: boolean;
    asset?: { id: string };
    assetId?: string;
    upload?: { url: string; method: string; headers: Record<string, string> };
  };

  if (presign.duplicate && presign.asset) {
    return { assetId: presign.asset.id, duplicate: true };
  }

  const assetId = presign.assetId;
  const upload = presign.upload;
  if (!assetId || !upload) throw new Error("presign se upload ka raasta nahi mila");

  const put = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: args.blob,
  });
  if (!put.ok) {
    /*
     * ⚠️ Yahan sabse aam wajah CORS hoti hai, aur uska message bilkul kuch aur
     * dikhta hai. Isliye wo saaf likhi jaati hai — warna aadmi apni file ko
     * kharab samajhta hai, jabki file bilkul theek hoti hai aur bucket ki setting
     * galat hoti hai.
     */
    throw new Error(
      `File storage par chadh nahi paayi (HTTP ${put.status}). ` +
        `R2 par CORS me is site ka pata aur PUT allowed hona chahiye.`,
    );
  }

  const completed = (await postJson(`/api/assets/${assetId}/complete`, {
    filename: args.filename,
    mime: args.blob.type || "application/octet-stream",
    checksum,
    ...(args.width ? { width: args.width } : {}),
    ...(args.height ? { height: args.height } : {}),
    ...(args.tags && args.tags.length > 0 ? { tags: [...args.tags] } : {}),
  })) as { asset?: { id: string }; duplicate?: boolean };

  if (!completed.asset) throw new Error("upload complete hua par asset wapas nahi aayi");

  // Nayi asset library me aa gayi — list taaza karo, warna wo dikhegi hi nahi.
  forgetAssetMeta();

  return { assetId: completed.asset.id, duplicate: Boolean(completed.duplicate) };
}

/**
 * JSON bhejo aur JSON lo — **par jawab pehle text ki tarah padho**.
 *
 * ⚠️ Wahi wajah jo `voiceGen` me likhi hai: server ka function timeout ho jaaye
 * to Vercel HTML ka error page lautata hai, aur `response.json()` uspar
 * "Unexpected token 'A'" ke saath phat'ta hai — ek aisa message jisse na wajah
 * pata chalti hai na ilaaj.
 */
async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = null;
  }

  if (!json) {
    throw new Error(
      `Server ne aisa jawab diya jo samajh nahi aaya (HTTP ${response.status}) — ` +
        `aksar iska matlab hota hai ki request beech me hi kat gayi.`,
    );
  }
  if (!response.ok) {
    throw new Error(String(json.reason ?? json.error ?? `HTTP ${response.status}`));
  }
  return json;
}
