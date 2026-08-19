import { NextResponse } from "next/server";

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
const MAX_OUTPUT_TOKENS = 4096;

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

  const model = body.model ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

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
