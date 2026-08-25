import { NextResponse } from "next/server";

import { readTokenUsage, type GeminiUsageMetadata } from "@/lib/ai/usage";
import { overDailyLimit, recordReelUsage } from "@/lib/usage";

/**
 * Gemini ka darwaza — **key sirf server par** (21.3).
 *
 * ⚠️ Browser se seedha Gemini bulana bahut aasan hota, par uska matlab hai key
 * ko har us aadmi ke haath me de dena jo dev-tools khol le. `NEXT_PUBLIC_` wale
 * env var bundle me chale jaate hain; wahi galti sabse zyada dohrayi jaati hai.
 * Isliye key yahin rehti hai aur browser sirf is route se baat karta hai.
 *
 * Ye route **kuch samajhta nahi** — na prompt banata hai, na jawab parse karta
 * hai. Wo poora kaam `lib/ai/gemini.ts` me hai, jo `@reel/core` ke schema se
 * jaanchta hai. Yahan logic rakhne par wo do jagah bat jaata.
 */

export const runtime = "nodejs";

/** Ek call ki hadd — bina iske ek galat prompt poora kota kha sakta hai. */
/*
 * 4096 se ghata kar 2048. Naapa gaya: 8-10 scene ka poora jawab ~700-900 token
 * me aa jaata hai, yaani 2048 me do guna se zyada gunjaish hai. Purani hadd sirf
 * tab lagti thi jab model bhatak kar likhta hi chala jaata - aur wo poora
 * bhatkav bhi paisa hi tha.
 */
const MAX_OUTPUT_TOKENS = 4096;

/** Model kitna "soch" sakta hai. 0 = bilkul nahi (dekho neeche ka naap). */
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);

export async function POST(request: Request): Promise<NextResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    /*
     * 200 nahi, 503 — kyunki ye ek asli haalat hai jise UI alag se dikhati hai
     * ("AI off"). 200 ke saath error bhejne par har caller ko body padh kar
     * sochna padta ki kya hua.
     */
    return NextResponse.json(
      { error: "GEMINI_API_KEY set nahi hai — AI band hai." },
      { status: 503 },
    );
  }

  let body: { prompt?: string; system?: string; model?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON nahi thi" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: "prompt khaali hai" }, { status: 400 });

  /*
   * Roz ki hadd — call bhejne se pehle (26.27).
   *
   * ⚠️ Ye ek din ke ₹407 wale bill ke baad aayi hai. Us din kuch "toota" nahi
   * tha: har call theek chali, har jawab theek aaya, bas unki ginti par koi
   * upar wali rok thi hi nahi. Bina hadd ke ek chhoti si galti (ek loop, ek
   * baar-baar dabta button, ek retry) aur ek mehnga din me koi farak nahi hai.
   *
   * ⚠️ Hadd \`prompt\` ki jaanch ke **baad** hai. Khaali prompt wali call
   * provider tak jaati hi nahi, isliye use ginti me lena hadd ko wahan kharch
   * kar dena hai jahan kharcha hua hi nahi.
   */
  const capped = await overDailyLimit("scenes");
  if (capped) return NextResponse.json({ error: capped }, { status: 429 });

  const model = body.model ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const startedAt = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(body.system ? { system_instruction: { parts: [{ text: body.system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            // Script me thodi creativity chahiye par bahut nahi — 0.7 par wo
            // scene types ki list se bhatakne lagta hai.
            temperature: 0.4,
            responseMimeType: "application/json",
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            /*
             * Sochne ka budget - aur ye is poore route ka sabse bada kharcha tha.
             *
             * NAAPA GAYA (gemini-3.5-flash, ek chhota prompt):
             *   bina thinkingConfig : total 327 token, jisme 303 sirf thinking
             *   thinkingBudget: 0   : total  24 token
             *
             * Yaani 90% se zyada paisa jawab par nahi, SOCHNE par lag raha tha.
             * Aur ye kahin dikhta nahi: `candidatesTokenCount` chhota rehta hai,
             * bill bada aata hai. Sach `thoughtsTokenCount` me chhupa hota hai.
             *
             * WARNING: Ye scene banane jaise kaam ke liye theek hai - schema tay
             * hai, niyam prompt me likhe hain, aur model ko kuch "hal" nahi karna.
             * Kisi din yahan sach me sochne wala kaam aaye to ise badha dena;
             * isiliye ye env se badla ja sakta hai.
             *
             * WARNING: Thinking token `maxOutputTokens` me GINTE hain. Isi wajah
             * se cap 2048 karne par jawab kat kar aa raha tha - model 1900 token
             * soch leta tha aur JSON aadha bachta tha. Wo galti dikhti "AI ka
             * jawab sahi shakl me nahi aaya" jaisi thi, jabki wajah ye thi.
             */
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          },
        }),
        cache: "no-store",
      },
    );

    if (response.status === 429) {
      return NextResponse.json({ error: "Gemini ka kota khatam" }, { status: 429 });
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Fail bhi ginte hain — nakaam call ka bhi paisa lagta hai, aur usko na
      // ginna bill aur hisaab ke beech ek chup-chaap farak bana deta hai.
      void recordReelUsage({
        kind: "scenes",
        units: 0,
        ok: false,
        meta: { model, status: response.status, ms: Date.now() - startedAt },
      });
      return NextResponse.json(
        { error: `Gemini ne ${response.status} diya`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: unknown;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    /*
     * `raw` me sirf usage wala hissa jaata hai, poora jawab nahi. Poora bhejne
     * par har call me do baar wahi text network par jaata hai — bekaar, aur
     * bade jawab par dhyaan dene layak.
     */
    /*
     * Usage yahin likhi jaati hai, client par nahi — client se bhejna matlab
     * uspar bharosa karna ki wo sach bheje, aur wo hisaab ka sabse kamzor
     * raasta hai. Yahan wo number seedha provider ke jawab se aata hai.
     */
    /*
     * ⚠️ Ginti `lib/ai/usage.ts` me hoti hai, yahan nahi — kyunki usme ek asli
     * gadbad chhupi thi. Naye model "sochne" ke token alag se ginte hain
     * (`thoughtsTokenCount`), aur wo `candidatesTokenCount` me aate hi nahi.
     * Ek asli call par: prompt 12, candidates 5, thoughts 105 — kul 122.
     * Sirf candidates ginne par yahan 17 likha jaata tha: saat guna kam, aur
     * dekhne me bilkul theek. Ab uspar test hai (`scripts/check-ai.ts`).
     */
    const tokens = readTokenUsage(data.usageMetadata as GeminiUsageMetadata | undefined);
    void recordReelUsage({
      kind: "scenes",
      // `units` = kul tokens, kyunki `service_usage` me Gemini ke liye wahi
      // paimana pehle se chalta hai (dekho supabase/service-usage.sql).
      units: tokens.totalTokens,
      ok: true,
      meta: {
        model,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({ text, raw: { usageMetadata: data.usageMetadata } });
  } catch (cause) {
    return NextResponse.json(
      { error: `Gemini tak pahuncha hi nahi: ${cause instanceof Error ? cause.message : String(cause)}` },
      { status: 502 },
    );
  }
}

/**
 * AI chalu hai ya nahi — **bina key bheje** (21.13).
 *
 * UI ise poochh kar "AI off" wali line dikhati hai. Iske bina UI ko andaaza
 * lagana padta ya ek bekaar call bhejni padti.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  });
}
