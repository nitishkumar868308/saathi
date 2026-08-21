import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import {
  TTS_PROVIDERS,
  VOICE_CATEGORIES,
  requireTtsProvider,
  requireVoiceCategory,
  storageKey,
  ttsCacheKey,
  voiceIdFor,
} from "@reel/core";
import { getTtsAdapter, synthesize } from "@reel/media";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { createAsset, findAssetByCacheKey } from "@/lib/assets";
import { scratchDir, storage } from "@/lib/storage";
import { recordReelUsage } from "@/lib/usage";

/**
 * `GET  /api/tts` — kaun sa provider chalne layak hai (UI isse tay karti hai)
 * `POST /api/tts` — text se awaaz banao (ya cache se utha lao)
 *
 * ⚠️ **Cache pehle, API baad me.** Har generate se pehle maang ka hash
 * (`ttsCacheKey`) banta hai aur DB me dekha jaata hai. Reel banate waqt ek hi
 * scene ka text 10 baar preview hota hai aur usme se 9 baar text bilkul wahi
 * hota hai — bina cache ke wo 9 call ka paisa har baar lagta, aur kisi ko pata
 * bhi nahi chalta kyunki dikhne me sab theek chal raha hota hai.
 *
 * ⚠️ Awaaz **is route me banti hai**, worker me nahi — aur ye render se alag
 * faisla hai. Ek chhote paragraph ki TTS 2-5 second leti hai; utni der ke liye
 * poori job queue khadi karna (job row, polling, cancel, stale recovery) us
 * kaam se zyada bojh hai jitna wo kaam hai. Render minute bhar chalta hai,
 * isliye wo queue me hai.
 *
 * ⚠️ Bani hui awaaz `temporary` hai (`temp/tts/`) — user ka apna upload nahi
 * hai, aur cleanup use utha sakta hai. Manual upload wali awaaz aam upload ke
 * raaste se aati hai aur `permanent` rehti hai; wo is route se guzarti hi nahi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GenerateSchema = z.object({
  text: z.string().min(1, "bolne ke liye text chahiye"),
  /** `VOICE_CATEGORIES` ka id — "male" / "female" / "boy" … */
  categoryId: z.string().min(1),
  /** `TTS_PROVIDERS` ka id. Na do to pehla chalne layak provider. */
  providerId: z.string().min(1).optional(),
  rate: z.number().min(0.5).max(2).optional(),
  pitch: z.number().min(-12).max(12).optional(),
});

/** Har provider se poochho ki wo chalne layak hai ya nahi. */
async function providerStatus(): Promise<
  { id: string; label: string; hint: string; kind: string; available: boolean; detail: string }[]
> {
  const out = [];
  for (const entry of TTS_PROVIDERS) {
    if (entry.kind === "manual") {
      // Manual me kuch chalta hi nahi, isliye wo hamesha "available" hai.
      out.push({ ...entry, available: true, detail: "apni file upload karo" });
      continue;
    }
    const check = await getTtsAdapter(entry.id).available();
    out.push({ ...entry, available: check.ok, detail: check.detail.split("\n")[0] ?? "" });
  }
  return out;
}

export async function GET(): Promise<Response> {
  return handle(async () => {
    const providers = await providerStatus();
    return ok({
      providers,
      categories: VOICE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, hint: c.hint })),
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, GenerateSchema);
    if (!body.ok) return body.response;

    const { text, categoryId } = body.data;
    const rate = body.data.rate ?? 1;
    const pitch = body.data.pitch ?? 0;

    const category = requireVoiceCategory(categoryId);

    /*
     * Provider na diya ho to pehla **chalne layak** chuno — na ki pehla likha
     * hua. Bina key ke Gemini chun lena matlab har request ek error, jabki
     * edge-tts paas hi khada hai.
     */
    let providerId = body.data.providerId;
    if (!providerId) {
      const status = await providerStatus();
      providerId = status.find((p) => p.kind !== "manual" && p.available)?.id;
      if (!providerId) {
        return fail(
          "koi TTS provider chalne layak nahi",
          503,
          status.map((p) => `${p.label}: ${p.detail}`).join(" | "),
        );
      }
    }

    const provider = requireTtsProvider(providerId);
    if (provider.kind === "manual") {
      return fail(
        "ye provider awaaz nahi banata",
        400,
        `"${provider.label}" me apni file upload ki jaati hai — generate ka koi matlab nahi.`,
      );
    }

    const voiceId = voiceIdFor(category, providerId);
    const cacheKey = ttsCacheKey({ providerId, voiceId, text, rate, pitch });
    // Cache lookup se pehle se naapa jaata hai — cache hit ka `ms` bhi isi se
    // aata hai, aur wahi to saabit karta hai ki cache sach me tez hai.
    const startedAt = Date.now();

    /* ------------------------------------------------------- cache pehle */

    const cached = await findAssetByCacheKey(cacheKey);
    if (cached) {
      /*
       * Cache hit bhi likha jaata hai, `units: 0` ke saath. Ise chhod dena
       * aasan hota — "kharcha to hua hi nahi" — par tab admin me ye kabhi nahi
       * dikhta ki cache ne kitni baar bachaya, aur cache ki keemat hi anaap
       * ho jaati.
       */
      void recordReelUsage({
        kind: "tts",
        units: 0,
        ok: true,
        meta: {
          providerId,
          voiceId,
          categoryId: category.id,
          cached: true,
          chars: text.length,
          ms: Date.now() - startedAt,
        },
      });
      return ok({
        asset: cached,
        cached: true,
        providerId,
        voiceId,
        categoryId: category.id,
      });
    }

    /* ------------------------------------------------------- ab hi banao */

    const check = await getTtsAdapter(providerId).available();
    if (!check.ok) return fail("TTS abhi chal nahi sakta", 503, check.detail);

    const assetId = randomUUID();
    const scratch = resolve(scratchDir(), `tts-${assetId}`);
    const outPath = resolve(scratch, "voice.wav");
    await mkdir(scratch, { recursive: true });

    try {
      const result = await synthesize({
        providerId,
        voiceId,
        text,
        rate,
        pitch,
        outPath,
        scratchDir: scratch,
        ...(category.stylePrompt === undefined ? {} : { stylePrompt: category.stylePrompt }),
      });

      const bytes = await readFile(outPath);
      const key = storageKey.tts(assetId);
      await storage().put(key, bytes, "audio/wav");

      const asset = await createAsset({
        id: assetId,
        /*
         * ⚠️ Key **wahi** jaati hai jispar file sach me chadhi. Ye line pehle
         * nahi thi aur uska nateeja ye tha ki file `temp/tts/` par baithi rahi
         * jabki row `permanent/assets/` par point kar rahi thi — asset kabhi
         * play nahi hoti, aur cleanup use dhoondh hi nahi paata.
         */
        key,
        filename: `${category.id}-${assetId.slice(0, 8)}.wav`,
        mime: "audio/wav",
        bytes: bytes.byteLength,
        durationMs: Math.round(result.durationSeconds * 1000),
        // Banayi hui awaaz kabhi `permanent` nahi hoti — cleanup ise utha sake.
        lifecycle: "temporary",
        cacheKey,
        tags: ["tts", category.id],
        meta: {
          tts: { providerId, voiceId, categoryId: category.id, rate, pitch, text },
          storageKey: key,
        },
      });

      void recordReelUsage({
        kind: "tts",
        units: text.length,
        ok: true,
        meta: {
          providerId,
          voiceId,
          categoryId: category.id,
          cached: false,
          chars: text.length,
          seconds: Number(result.durationSeconds.toFixed(2)),
          ms: Date.now() - startedAt,
        },
      });

      return ok({ asset, cached: false, providerId, voiceId, categoryId: category.id });
    } finally {
      // Scratch har haal me jaata hai — fail hone par bhi. Warna har nakaam
      // koshish disk par ek adhoori wav chhod jaati hai.
      await rm(scratch, { recursive: true, force: true });
    }
  });
}
