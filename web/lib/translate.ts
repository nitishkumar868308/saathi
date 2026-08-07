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

/* ------------------------------------------------------------------ */
/*  Free-form fields ka anuvaad (renewal guides)                       */
/* ------------------------------------------------------------------ */

/**
 * Ek guide ke SAARE khaane, kai bhashaon me — ek hi call me.
 *
 * ⚠️ `translateMessage` yahan kaam nahi aata, aur wajah do hain:
 *
 *   1. Wo `Loc` par bandha hai — teen tay bhashayein. Renewal ka language
 *      master admin ke haath me hai; wahan kal Tamil ya Arabic bhi ho sakti
 *      hai, aur uske liye code badalna hi wo cheez thi jise hataana tha.
 *   2. Wo {subject, message} ki jodi leta hai. Guide ke khaane ab admin tay
 *      karta hai — kitne bhi, kisi bhi naam se, aur kuch list bhi hote hain.
 *
 * Isliye yahan shape hi bhej dete hain: jo JSON gaya, waisa hi wapas maangte
 * hain. List list rehti hai, string string — model ko dhaancha badalne ki
 * chhoot nahi.
 *
 * Fail hone par ORIGINAL lautta hai, khaali kabhi nahi. Adhoora anuvaad save na
 * hone se behtar hai: app waise bhi default bhasha par gir jaati hai, par save
 * hi na ho to admin ka likha hua poora chala jaata.
 */
export type FieldMap = Record<string, string | string[]>;

export async function translateFields(
  src: FieldMap,
  targets: { code: string; label: string }[],
  opts: { sourceLabel?: string; skipKeys?: string[] } = {},
): Promise<Record<string, FieldMap>> {
  const out: Record<string, FieldMap> = {};
  for (const t of targets) out[t.code] = { ...src };

  if (!KEY || targets.length === 0) return out;

  /*
   * ⚠️ URL kabhi anuvaad nahi hone chahiye. Model bade aaram se
   * "parivahan.gov.in/renew" ko "parivahan.gov.in/नवीनीकरण" bana deta hai —
   * aur toota hua sarkari link, link na hone se bura hai. Isliye ye khaane
   * request se BAHAR hi rakhe jaate hain; upar wali copy me original pade hain.
   */
  const skip = new Set(opts.skipKeys ?? []);
  const payload: FieldMap = {};
  for (const [k, v] of Object.entries(src)) {
    if (skip.has(k)) continue;
    if (Array.isArray(v) ? v.some((s) => s.trim()) : String(v ?? "").trim()) payload[k] = v;
  }
  if (Object.keys(payload).length === 0) return out;

  const asked = targets.map((t) => `"${t.code}": ${t.label}`).join("\n");
  const prompt =
    `Neeche ek document-renewal guide ke khaane JSON me hain${
      opts.sourceLabel ? ` (${opts.sourceLabel} me)` : ""
    }.\n\n` +
    `Inka anuvaad in bhashaon me karo:\n${asked}\n\n` +
    `JSON is shakl me lautao (aur kuch nahi) — har bhasha ke andar BILKUL wahi ` +
    `keys, aur wahi shape (jo array hai wo array hi rahe, utne hi item):\n` +
    `{${targets.map((t) => `"${t.code}":{ …wahi keys… }`).join(",")}}\n\n` +
    `INPUT:\n${JSON.stringify(payload, null, 2)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text:
                  SYSTEM +
                  `\n- Ye ek sarkari process ka tareeka hai. Step ka KRAM aur ginti bilkul mat badlo — ek step ka anuvaad ek hi step rahe.` +
                  `\n- Sanstha/portal ka naam (jaise "Passport Seva", "RTO") jaisa hai waisa rehne do, chahe script badal rahi ho.`,
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            // Guide me kai khaane × kai bhasha — 2048 me poora jawab kat jaata
            // hai, aur kata hua JSON parse hi nahi hota (yaani anuvaad chup-chaap
            // gayab). Isliye yahan khula haath.
            maxOutputTokens: 8192,
          },
        }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      logServiceUsage("gemini", "translate-fields", { ok: false, meta: { status: res.status } });
      return out;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const parsed = JSON.parse(
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    ) as Record<string, FieldMap>;

    for (const t of targets) {
      const got = parsed[t.code];
      if (!got || typeof got !== "object") continue;
      const merged: FieldMap = { ...src };
      for (const [k, v] of Object.entries(payload)) {
        const g = got[k];
        // Shape badal gaya (list ki jagah string aa gayi, ya ulta) to us khaane
        // ka anuvaad chhod do — original hi rehne do. Aadha-badla dhaancha app
        // me render hi nahi hota.
        if (Array.isArray(v)) {
          if (Array.isArray(g) && g.length > 0) merged[k] = g.map((s) => String(s));
        } else if (typeof g === "string" && g.trim()) {
          merged[k] = g.trim();
        }
      }
      out[t.code] = merged;
    }
    logServiceUsage("gemini", "translate-fields", { meta: { languages: targets.length } });
  } catch {
    logServiceUsage("gemini", "translate-fields", { ok: false, meta: { parse: "failed" } });
  }

  return out;
}
