"use client";

import type { FitPlan } from "@reel/core";

/**
 * Tasveer ko frame me fit karna — **browser me, canvas par** (26.26).
 *
 * ⚠️ Ye ffmpeg wale raaste ka duplicate nahi hai, uska **ilaaj** hai. Studio do
 * jagah chalta hai: tumhare PC par (jahan ffmpeg hai) aur Vercel par (jahan wo
 * hai hi nahi, aur koi env var use la bhi nahi sakta — serverless me binary
 * install karne ka koi raasta nahi hota). Live par fit har baar isi ek line par
 * marti thi:
 *
 *     "ffmpeg" chala hi nahi (spawn ffmpeg ENOENT)
 *
 * Tasveer ke liye ffmpeg ki zaroorat hai bhi nahi. Jo kaam wo karta hai — naap
 * badalna, kaatna, kinaron par dhundhli copy rakhna — canvas wahi kaam karta hai,
 * usi machine par jahan aadmi baitha hai, bina kisi server ke, bina kisi kharche
 * ke, aur turant.
 *
 * ⚠️ **Faisla yahan nahi hota.** Kya banana hai wo `planFit()` (@reel/core) tay
 * karta hai — wahi jo chetavni dikhata hai aur wahi jo ffmpeg wala raasta lagata
 * hai. Yahan sirf us plan ko canvas ki zubaan me likha jaata hai. Teen jagah
 * teen hisaab likhne par ek din screen kuch aur bolti aur file kuch aur banti.
 *
 * ⚠️ Video yahan **nahi** hoti, aur ye jaan-boojhkar hai. Video ke liye canvas ka
 * matlab hai har frame khud kheenchna aur phir use encode karna — browser me wo
 * ya to ffmpeg.wasm (30MB utaaro, aur 10 guna dheema) hai ya WebCodecs ka poora
 * apna pipeline. Dono ek chhote se faayde ke liye bahut bada bojh hain: video
 * reel me waise bhi `cover`/`contain` se theek baithti hai, bas file thodi badi
 * rehti hai.
 */

/** Kinaron ki dhundhli copy kitni dhundhli — `1080` chaudai par ~20px. */
function blurRadius(width: number): number {
  return Math.max(8, Math.round(width / 54));
}

export class FitInBrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FitInBrowserError";
  }
}

/**
 * Asset ki tasveer padho — **apne hi origin se**.
 *
 * ⚠️ `/raw` se, `/url` se nahi. Signed URL R2 ka hota hai, yaani doosra origin;
 * usse aayi tasveer canvas ko taint kar deti hai aur `toBlob()` `SecurityError`
 * deta hai — chahe wo tasveer screen par bilkul theek dikh rahi ho. Wo galti
 * pakadna bahut mushkil hai kyunki har doosri jagah sab theek chal raha hota hai.
 */
async function loadBitmap(assetId: string): Promise<ImageBitmap> {
  const response = await fetch(`/api/assets/${assetId}/raw`);
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { reason?: string };
    throw new FitInBrowserError(detail.reason ?? `Tasveer padhi nahi ja saki (${response.status})`);
  }

  const blob = await response.blob();
  /*
   * ⚠️ `imageOrientation: "from-image"` — bina iske phone se aayi tasveer **letti
   * hui** fit ho jaati hai. EXIF me likha hua ghumaav browser `<img>` par to laga
   * deta hai par `createImageBitmap` ke default par nahi, isliye screen par
   * tasveer seedhi dikhti hai aur bani hui file me wo ghumi hui hoti hai.
   */
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/**
 * Plan ke hisaab se nayi tasveer bana do.
 *
 * Nateeja JPEG hai — reel me ye tasveer background hai aur frame poora bhara hua
 * hota hai (contain par bhi, dhundhli copy se), isliye transparency ka koi kaam
 * hi nahi bachta. 1080x1920 ka PNG 5-6MB ka hota hai aur wahi JPEG ~300KB — wo
 * farak har scene par lagta hai.
 */
export async function fitImageInBrowser(args: {
  assetId: string;
  plan: FitPlan;
}): Promise<Blob> {
  const { width, height } = args.plan.target;

  const bitmap = await loadBitmap(args.assetId);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FitInBrowserError("Is browser me canvas nahi chala.");

    /*
     * ⚠️ `high` — default `low` hota hai, aur wahi wo farak hai jo ek fit ki hui
     * tasveer ko "thodi narm" bana deta hai. Ye ffmpeg ke lanczos jitna achha to
     * nahi, par uske bahut paas hai; aur uska muqabla ffmpeg se nahi, **kuch na
     * hone** se hai — live par fit hoti hi nahi thi.
     */
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const coverScale = Math.max(width / bitmap.width, height / bitmap.height);
    const containScale = Math.min(width / bitmap.width, height / bitmap.height);

    if (args.plan.mode === "contain") {
      /*
       * Pehle kinare: usi tasveer ki badi, dhundhli copy poore frame par. Kaali
       * patti chhodna aasan tha aur reel me wo "galat file lag gayi" jaisi dikhti
       * hai; dhundhli copy peeche hone par frame bhara hua aur jaan-boojhkar bana
       * hua lagta hai. Wahi tarika render bhi lagata hai (`blurred-asset`), isliye
       * fit ki hui aur bina fit wali reel ek jaisi dikhti hain.
       */
      ctx.save();
      ctx.filter = `blur(${blurRadius(width)}px)`;
      drawScaled(ctx, bitmap, coverScale, width, height);
      ctx.restore();
      drawScaled(ctx, bitmap, containScale, width, height);
    } else {
      drawScaled(ctx, bitmap, coverScale, width, height);
    }

    const blob = await new Promise<Blob | null>((done) => {
      canvas.toBlob(done, "image/jpeg", 0.92);
    });
    if (!blob) {
      throw new FitInBrowserError(
        "Fit ki hui tasveer ban to gayi par file me nahi badli — " +
          "aksar iska matlab hota hai ki tasveer kisi doosre origin se aayi hai.",
      );
    }
    return blob;
  } finally {
    // Bitmap ki memory GPU par hoti hai — chhod dene par wo apne aap jaldi nahi jaati.
    bitmap.close();
  }
}

/** Beech me, di hui scale par. */
function drawScaled(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  scale: number,
  width: number,
  height: number,
): void {
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}
