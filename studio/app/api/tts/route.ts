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
  ttsFilename,
  voiceIdFor,
} from "@reel/core";
import { TtsHttpError, getTtsAdapter, synthesize } from "@reel/media";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { createAsset, findAssetByCacheKey } from "@/lib/assets";
import { scratchDir, storage } from "@/lib/storage";
import { overDailyLimit, recordReelUsage } from "@/lib/usage";

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

/**
 * Vercel par is function ko kitna waqt milta hai (26.26).
 *
 * ⚠️ Bina is line ke default **10 second** hai, aur wo TTS ke liye kaafi nahi.
 * Gemini aam din ~3.5s me jawab deta hai par kabhi-kabhi 100s+ le leta hai; us
 * halat me Vercel function ko beech me maar deta hai aur client ko **JSON ki
 * jagah ek HTML error page** milta hai. Uska nateeja UI me aisa dikhta tha:
 *
 *     Unexpected token 'A', "An error o"... is not valid JSON
 *
 * — yaani ek aisa message jisse na wajah pata chalti hai na ilaaj. 60 Vercel ke
 * free (Hobby) plan ki poori hadd hai; usse aage ka jawab paisa maangta hai.
 *
 * ⚠️ Iske saath hi adapter me se **saara intezaar hata diya gaya hai**. Function
 * ke andar 429 par rukna do tarah se bura tha: rukna bhi isi 60s me se kat'ta
 * tha, aur per-minute hadd 60s me khulti bhi nahi. Rukna ab client karta hai,
 * jispar koi hadd nahi.
 */
export const maxDuration = 60;

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

    /*
     * ⚠️ **Cache hit ka matlab "DB me row hai", "file maujood hai" nahi — aur
     * ye farak ek asli render tod chuka hai (2026-08-22).**
     *
     * Job 2% par mari, ye keh kar: `Asset "…" DB me hai par storage me nahi
     * (key: temp/tts/…)`. Do raaste hain jinse ye halat banti hai, aur dono aam
     * hain:
     *
     *   1. TTS ki awaaz `temporary` hoti hai (`temp/tts/…`) — cleanup use utha
     *      sakta hai. Row peeche reh jaati hai.
     *   2. Storage driver badal jaaye (`local` se `r2`). Purani awaaz us disk
     *      par padi rehti hai jise ab koi padhta hi nahi.
     *
     * Dono me DB poore vishwas se kehta hai "awaaz ban chuki hai", studio wahi
     * asset id job me daal deta hai, aur galti **render ke waqt** dikhti hai —
     * yaani sabse mehngi jagah par, aur cloud me to poora runner khada karne ke
     * baad.
     *
     * Isliye ab poochha jaata hai, maana nahi jaata. Ek HEAD call ki keemat ek
     * toote hue render ke aage kuch bhi nahi hai. File na mile to cache hit
     * girta hai aur awaaz dobara ban jaati hai — user ko kuch pata bhi nahi
     * chalta, jo ki theek hai: uske liye ye kabhi toota hi nahi.
     */
    const cachedExists = cached ? await storage().exists(cached.key) : null;
    if (cached && !cachedExists) {
      console.warn(
        `[tts] cache me asset ${cached.id} tha par storage me file nahi (${cached.key}) — dobara bana rahe hain`,
      );
    }

    if (cached && cachedExists) {
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

    /*
     * ⚠️ Roz ki hadd **yahan** lagti hai — cache dekhne ke baad, provider ko
     * bulane se pehle. Ye jagah soch kar chuni hai. Isse upar lagane par cache
     * se aane wali awaaz bhi ruk jaati, jo muft hai; isse neeche lagane par call
     * ja chuki hoti aur paisa lag chuka hota — yaani hadd sirf ye batati ki
     * kharcha ho gaya hai, use rokti nahi.
     */
    const capped = await overDailyLimit("tts");
    if (capped) return fail("aaj ki hadd poori ho gayi", 429, capped);

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
        /*
         * ⚠️ Naam me bola gaya text jaata hai, id nahi (26.27). Library me ye
         * hi wo ek cheez hai jisse aadmi apni awaaz pehchanta hai — `male-3f2a91bc`
         * se koi kabhi nahi pehchan paaya.
         */
        filename: ttsFilename(category.label, text),
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
    } catch (cause) {
      /*
       * ⚠️ Provider ka HTTP jawab **jaisa ka waisa** client tak jaata hai — khaas
       * kar 429 aur uske saath aayi `retryAfterSeconds`. Ise ek aam 500 me badal
       * dena sabse mehnga chhupav tha: client ko sirf "kuch galat hua" milta tha,
       * isliye wo turant dobara bhejta tha, jisse hadd aur pakki ho jaati thi —
       * aur free quota ki ginti bina ek bhi awaaz bane khatam ho jaati thi.
       *
       * ⚠️ Nakaam koshish bhi likhi jaati hai (`ok: false`). Warna admin me sirf
       * kaamyab call dikhti hain aur "quota kahan gaya" ka jawab kahin nahi hota.
       */
      if (cause instanceof TtsHttpError) {
        void recordReelUsage({
          kind: "tts",
          units: 0,
          ok: false,
          meta: {
            providerId,
            voiceId,
            categoryId: category.id,
            status: cause.status,
            quotaExhausted: cause.quotaExhausted,
            chars: text.length,
            ms: Date.now() - startedAt,
          },
        });

        return Response.json(
          {
            error: cause.status === 429 ? "awaaz banane ki hadd lag gayi" : "TTS ne mana kiya",
            reason: cause.message,
            retryAfterSeconds: cause.retryAfterSeconds,
            quotaExhausted: cause.quotaExhausted,
          },
          { status: cause.status },
        );
      }
      throw cause;
    } finally {
      // Scratch har haal me jaata hai — fail hone par bhi. Warna har nakaam
      // koshish disk par ek adhoori wav chhod jaati hai.
      await rm(scratch, { recursive: true, force: true });
    }
  });
}
