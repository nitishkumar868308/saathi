import { logServiceUsage } from "@/lib/usage-server";
import type { Loc } from "@/lib/reminder-channels";

/**
 * Admin ka likha message har user ki apni bhasha me.
 *
 * ⚠️ Ab tak admin jo likhta tha, bilkul wahi sabko chala jaata tha. Har user ki
 * bhasha `profiles.language` me pehle se padi thi aur email ke CTA button tak
 * usi se bante the — par message ka asli matn (subject + body) hamesha ek hi
 * bhasha me jaata tha. Yaani Hindi chunne wale user ko email ka button "ऐप
 * खोलें" dikhta tha aur upar poora message English me. Aadha-Hindi aadha-English
 * email bharose ka sabse jaldi tootne wala hissa hai.
 *
 * Kaise: ek hi Gemini call me SAARI zaroori bhashayein ek saath. Per-user call
 * karna bhi ho sakta tha, par 1000 user par wo 1000 call ban jaate — jabki
 * bhashayein sirf teen hain aur sabko bilkul EK jaisa anuvaad milna chahiye.
 *
 * Fail hone par kabhi kuch rokta nahi: anuvaad na ho to original text hi jaata
 * hai. Message ka na jaana, uske thodi galat bhasha me jaane se kahin bura hai.
 */

const KEY = process.env.GEMINI_API_KEY;
/**
 * Wahi model jo edge function `ai` me chalta hai. Anuvaad chhota kaam hai —
 * ismein bade model par jaane ka koi fayda nahi, sirf paisa aur intezaar badhta.
 */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

/** Anuvaad chalu hai? (UI isse toggle dikhata/chhupata hai.) */
export function translateConfigured(): boolean {
  return Boolean(KEY);
}

export type Message = { subject: string; message: string };

const LANG_NAME: Record<Loc, string> = {
  // ⚠️ "Hinglish" ko sirf "Hindi" likh dena sabse aam galti hai — model tab
  // Devanagari me likh deta hai. App ka default locale yahi hai, aur uska poora
  // matlab hi Roman script me Hindi hai.
  hinglish: "Hinglish — Hindi bolchaal ki bhasha, ROMAN (English) script me likhi hui. Devanagari BILKUL nahi.",
  hi: "Hindi, Devanagari script me.",
  en: "English.",
};

const SYSTEM = `Tum ek app ke notification/email ka anuvaad karte ho. App ka naam "Apka Saathi" hai — wo log documents aur reminders sambhalne ke liye use karte hain.

Niyam:
- Sirf anuvaad karo. Kuch naya mat jodo, kuch hatao mat, koi salah mat do.
- Line break, paragraph aur khaali lines bilkul waise hi rakho jaise input me hain.
- Brand ka naam "Apka Saathi", aur koi bhi link/URL, number, email, ya code jaisa hissa — jaisa hai waisa hi rehne do.
- Bhasha aam bolchaal ki rakho, sarkari/kitaabi nahi. Jo padhega wo aam phone user hai.
- Subject chhota rakho, jitna original hai lagbhag utna hi.
- Sirf JSON lautao, aur kuch nahi.`;

type Out = Record<string, { subject?: string; message?: string }>;

/**
 * `src` ko `targets` bhashaon me badlo.
 *
 * Lautata hai har target ka apna text. Jo bhasha kisi wajah se na aaye (model
 * ne chhod di, JSON toota, key hi nahi hai) uske liye original hi lautta hai —
 * caller ko kabhi khaali nahi milta, isliye usse handle karne ki zaroorat hi
 * nahi padti.
 */
export async function translateMessage(
  src: Message,
  targets: Loc[],
  opts: { sourceLanguage?: string } = {},
): Promise<Record<Loc, Message>> {
  // Har target ke liye default = original. Neeche jo bhi mila wo isi par chadhta
  // hai; jo nahi mila wo original hi reh jaata hai.
  const out = {} as Record<Loc, Message>;
  targets.forEach((l) => (out[l] = { ...src }));

  const want = Array.from(new Set(targets));
  if (!KEY || want.length === 0) return out;

  const asked = want.map((l) => `"${l}": ${LANG_NAME[l]}`).join("\n");
  const prompt =
    `Neeche ek message hai${opts.sourceLanguage ? ` (${opts.sourceLanguage} me)` : ""}.` +
    ` Iska anuvaad in bhashaon me karo:\n${asked}\n\n` +
    `JSON is shakl me lautao (aur kuch nahi):\n` +
    `{${want.map((l) => `"${l}":{"subject":"...","message":"..."}`).join(",")}}\n\n` +
    `SUBJECT:\n${src.subject}\n\nMESSAGE:\n${src.message}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            // Anuvaad me creativity nuksan hi karti hai.
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
          },
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logServiceUsage("gemini", "translate", { ok: false, meta: { status: res.status } });
      return out;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as Out;

    for (const l of want) {
      const got = parsed[l];
      // Aadha jawab (sirf subject aaya, message nahi) sabse bura hota — aadha
      // anuvaad, aadha original. Dono hone par hi lagate hain.
      if (got?.subject?.trim() && got?.message?.trim()) {
        out[l] = { subject: got.subject.trim(), message: got.message.trim() };
      }
    }
    logServiceUsage("gemini", "translate", { meta: { languages: want.length } });
  } catch {
    // Model ne JSON ke bahar kuch likh diya, ya net toot gaya. Dono soorat me
    // original text hi jaata hai — message rukta kabhi nahi.
    logServiceUsage("gemini", "translate", { ok: false, meta: { parse: "failed" } });
  }

  return out;
}
