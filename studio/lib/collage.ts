"use client";

import { collageSlots, coverCrop, type CollageLayout } from "@reel/core";

/**
 * Kai tasveerein jod kar ek — **browser me, canvas par**.
 *
 * ⚠️ Server par nahi, aur wo jaan-boojhkar hai. Studio Vercel par bhi chalti hai
 * aur wahan ffmpeg hai hi nahi; canvas har jagah hai. Yahi soch `fitInBrowser.ts`
 * ki bhi hai — wo bhi tasveer ka fit isi wajah se browser me karta hai.
 *
 * ⚠️ **Faisla yahan nahi hota.** Kaunsi tasveer kahan baithegi wo `collageSlots()`
 * (@reel/core) tay karta hai, aur har tasveer apne khaane me kaise katagi wo
 * `coverCrop()`. Yahan sirf `drawImage` hai. Do jagah hisaab likhne par screen
 * kuch aur dikhati aur bani hui file kuch aur hoti.
 */

export class CollageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollageError";
  }
}

/**
 * Asset ki tasveer — **apne hi origin se** (`/raw`).
 *
 * ⚠️ Signed URL (`/url`) R2 ka hota hai, yaani doosra origin, aur usse canvas
 * "taint" ho jaata hai — uske baad `toBlob()` `SecurityError` deta hai, chahe
 * tasveer screen par bilkul theek dikh rahi ho. Yahi galti bolti-tasveer wale
 * kaam me ho chuki hai, isliye yahan shuru se hi sahi raasta.
 */
async function loadAsset(assetId: string): Promise<ImageBitmap> {
  const response = await fetch(`/api/assets/${assetId}/raw`);
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { reason?: string };
    throw new CollageError(data.reason ?? `tasveer nahi mili (${response.status})`);
  }
  return createImageBitmap(await response.blob());
}

export interface CollageRequest {
  /** Kram maayne rakhta hai — pehli tasveer pehle khaane me. */
  assetIds: readonly string[];
  layout: CollageLayout;
  /** Bani hui tasveer ka naap — aam taur par project ka frame. */
  frame: { width: number; height: number };
}

export async function makeCollage(request: CollageRequest): Promise<Blob> {
  const { assetIds, layout, frame } = request;
  if (assetIds.length < 2) {
    throw new CollageError("Jodne ke liye kam se kam do tasveerein chahiye.");
  }

  const slots = collageSlots({ count: assetIds.length, layout, frame });
  if (slots.length !== assetIds.length) {
    throw new CollageError("Itni tasveerein is tarah nahi baith paayengi.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CollageError("Browser canvas nahi de raha.");

  /*
   * ⚠️ Peeche kaala bhara jaata hai. Ginti me aadhe pixel ka jhol rehta hai
   * (khaane round hote hain), aur bina bhare wahan **paardarshi** patti bachti
   * hai — jo PNG me to chalti hai par reel me ek kaali-safed jhilmilahat bankar
   * dikhti hai.
   */
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, frame.width, frame.height);

  for (const [at, assetId] of assetIds.entries()) {
    const slot = slots[at] as (typeof slots)[number];
    const bitmap = await loadAsset(assetId);
    try {
      const crop = coverCrop({ width: bitmap.width, height: bitmap.height }, slot);
      if (!crop) continue;
      ctx.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        slot.x,
        slot.y,
        slot.width,
        slot.height,
      );
    } finally {
      /* Bina iske har collage ki saari tasveerein memory me pakdi rehti hain. */
      bitmap.close();
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    /*
     * ⚠️ JPEG, PNG nahi. Ye jodi hui tasveer aksar teen photo ki hoti hai; PNG me
     * wo 8-10MB ki nikalti hai aur library me pade-pade jagah khaati rehti hai.
     * 0.92 par aankh ko farak nahi dikhta.
     */
    canvas.toBlob((made) => resolve(made), "image/jpeg", 0.92);
  });

  if (!blob) throw new CollageError("Jodi hui tasveer ban nahi paayi.");
  return blob;
}
