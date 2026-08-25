import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Ek scene ki awaaz banana — **ek hi jagah** (26.25 / 26.26).
 *
 * ⚠️ Ye function is liye alag hai ki wahi kaam ab teen jagah se hota hai: Awaaz
 * wale step ki qatar se, "Sab ki awaaz banao" se, aur Shabd wale step se bhi
 * (text badalne ke turant baad). Teen jagah teen `fetch` likhne ka nateeja pehle
 * hi dikh chuka hai — "Sab ki awaaz banao" wala raasta `voiceSeconds` likhna bhool
 * gaya tha, aur har scene ki lambai chup-chaap AI ke andaaze par reh jaati thi.
 *
 * ⚠️ Har call **ek** scene ke liye hai. Ek saath bhejne par provider ki
 * per-minute hadd turant lag jaati hai (free quota par wo teen-chaar call ki
 * hoti hai), cache ka faayda khatam ho jaata hai, aur fail hone par ye batana
 * namumkin ho jaata hai ki kaunsi fail hui.
 */

export interface MadeVoice {
  assetId: string;
  /** Bani hui awaaz ki naapi hui lambai — `null` = provider ne batayi hi nahi. */
  seconds: number | null;
  /** Wahi awaaz pehle se bani hui thi (naya kharcha nahi hua). */
  cached: boolean;
}

/**
 * Awaaz nahi bani — **aur uske aage kya karna hai** iske saath.
 *
 * ⚠️ Ye class ek asli, mehngi galti rokti hai. Pehle har nakami ek jaisa `Error`
 * thi, isliye bulane wale ke paas do hi raaste the: turant dobara bhejo, ya haar
 * jao. Free quota par turant dobara bhejna sabse bura wala hai — har koshish
 * hadd ko aur pakka karti hai, aur ginti bina ek bhi awaaz bane khatam ho jaati
 * hai. Ab jawab me likha hota hai ki rukna hai ya nahi, aur kitni der.
 */
export class VoiceError extends Error {
  constructor(
    message: string,
    readonly kind: "rate-limit" | "quota-over" | "timeout" | "server" | "other",
    /** `rate-limit` par — itni der baad dobara koshish kaam karegi. */
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

/**
 * Ek request kitni der tak chalne di jaaye.
 *
 * ⚠️ Server ki apni hadd 60s hai (Vercel ka free plan). Client thoda aage tak
 * rukta hai taaki server ka apna saaf jawab (jisme wajah likhi hoti hai) aane ka
 * mauka rahe; usse aage rukne ka koi faayda nahi — udhar function mar chuka hota
 * hai. Bina is hadd ke UI ghanton ghoomta rehta tha aur aadmi ko pata hi nahi
 * chalta tha ki kuch ho bhi raha hai ya nahi.
 */
const REQUEST_TIMEOUT_MS = 70_000;

/** `/api/tts` ka jawab — kaamyab aur nakaam, dono ka ek hi shape. */
interface TtsReply {
  asset?: { id: string; durationMs?: number | null };
  cached?: boolean;
  error?: string;
  reason?: string;
  /** 429 par — Google ka bataya hua intezaar. */
  retryAfterSeconds?: number | null;
  /** `true` = hadd aaj bhar ki hai, rukne se nahi khulegi. */
  quotaExhausted?: boolean;
}

/**
 * Server ke haar maan lene ke baad bhi — **awaaz bani to nahi?** (26.28)
 *
 * ⚠️ Ye ek asli, chup-chaap paisa khaane wali halat ka ilaaj hai. Gemini kabhi
 * 100s+ le leta hai. Tab tak ya client ki hadd lag jaati hai ya Vercel apna
 * function maar deta hai, aur aadmi ko ye dikhta hai:
 *
 *     Server ne jawab beech me chhod diya
 *
 * — jisse lagta hai ki kuch hua hi nahi. Par aksar udhar kaam **poora ho chuka**
 * hota hai: awaaz ban kar R2 aur DB me baith chuki hoti hai aur uska paisa lag
 * chuka hota hai. Dobara "Awaaz banao" dabana Gemini ko dobara bulata tha —
 * ek hi line ka paisa do baar, aur aadmi ko iska pata bhi nahi chalta tha.
 *
 * ⚠️ Do baar poochha jaata hai, ek baar nahi. Server client ke haar maanne ke
 * thodi der baad bhi kaam khatam kar sakta hai, aur turant ek hi baar poochhne
 * par wo awaaz miss ho jaati — jo abhi-abhi kharidi gayi thi.
 *
 * ⚠️ Ye khud kabhi throw nahi karta. Ye ek **bachaav** ki koshish hai, kaam nahi;
 * iske fail hone par asli wajah aadmi tak jaani chahiye, na ki is koshish ki
 * koi nayi wajah.
 */
async function peekVoice(args: {
  text: string;
  categoryId: string;
  providerId?: string | null;
}): Promise<MadeVoice | null> {
  for (const waitMs of [0, 4_000]) {
    if (waitMs > 0) await new Promise((done) => setTimeout(done, waitMs));
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: args.text,
          categoryId: args.categoryId,
          ...(args.providerId ? { providerId: args.providerId } : {}),
          peek: true,
        }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as TtsReply;
      if (!json.asset) continue;
      forgetAssetMeta();
      return {
        assetId: json.asset.id,
        seconds: json.asset.durationMs ? json.asset.durationMs / 1000 : null,
        // `true` — kyunki ye sach me cache se aayi hai. Ise `false` batana usi
        // jhooth ka doosra roop hota: kharcha is call me hua hi nahi.
        cached: true,
      };
    } catch {
      // Chup. Agli koshish, ya `null`.
    }
  }
  return null;
}

/**
 * Ek scene ki awaaz — **koshish, muft jaanch, phir ek aur koshish** (26.28).
 *
 * ⚠️ Pehle yahan koshish **ek hi** thi, aur yehi wo bug tha jise aadmi ne
 * "kisi me awaaz ban rahi hai kisi me nahi" kaha. Rate-limit (429) par to dobara
 * koshish hoti thi, par timeout par nahi — jabki aam din me girne ki asli wajah
 * wahi hoti hai: Gemini ka ek call achanak 100s le leta hai. Us ek scene ke liye
 * ye hamesha ke liye fail ho jaata tha, aur baaki scene theek bante rehte —
 * yaani aadhi reel par awaaz, bina kisi samajh me aane wali wajah ke.
 *
 * ⚠️ Beech me `peekVoice` hona **zaroori** hai, aur wo tarteeb hi is function ki
 * poori baat hai. Seedha dobara koshish karna aasan tha, par timeout ka aksar
 * matlab hota hai ki kaam ho chuka hai aur sirf jawab kho gaya. Bina poochhe
 * dobara bhejna us surat me ek hi awaaz ka paisa do baar deta hai.
 *
 * ⚠️ 429 aur quota par ye kuch nahi karta — wahan call provider tak pahunchi hi
 * nahi, isliye na kuch bana hoga aur na hi turant dobara bhejne se kuch banega.
 * Wo intezaar bulane wala karta hai, jispar koi hadd nahi.
 */
export async function generateVoice(args: {
  text: string;
  categoryId: string;
  providerId?: string | null;
  signal?: AbortSignal;
}): Promise<MadeVoice> {
  try {
    return await attemptVoice(args);
  } catch (cause) {
    const error = cause instanceof VoiceError ? cause : new VoiceError(String(cause), "other");
    if (error.kind !== "timeout" && error.kind !== "server") throw error;
    if (args.signal?.aborted) throw error;

    const already = await peekVoice(args);
    if (already) return already;

    return attemptVoice(args);
  }
}

async function attemptVoice(args: {
  text: string;
  categoryId: string;
  /**
   * Kis provider se — `null` = server pehla chalne layak khud chun le.
   *
   * ⚠️ Ise bhejna is liye zaroori hai ki bina iske **har scene apna faisla** karta
   * hai: har request par server dobara dekhta hai ki kaun chalne layak hai. Jis
   * din wo faisla badal jaata hai, us din reel ke beech se bolne wala badal jaata
   * hai — aur wo galti sirf reel sun kar pakdi jaati hai.
   */
  providerId?: string | null;
  /** Bahar se rok dene ke liye (aadmi ne wizard band kar diya). */
  signal?: AbortSignal;
}): Promise<MadeVoice> {
  /*
   * ⚠️ Do signal jodne padte hain: apni hadd wala, aur bulane wale ka. `AbortSignal.any`
   * har jagah nahi hai, isliye seedha ek controller banakar dono se joda jaata hai.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const relay = (): void => controller.abort();
  args.signal?.addEventListener("abort", relay);

  let response: Response;
  try {
    response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text: args.text,
        categoryId: args.categoryId,
        ...(args.providerId ? { providerId: args.providerId } : {}),
      }),
    });
  } catch (cause) {
    if (args.signal?.aborted) throw new VoiceError("Rok diya gaya.", "other");
    throw new VoiceError(
      `Awaaz banane me ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s se zyada lag gaya — ` +
        `provider abhi bahut dheema hai. Thodi der baad dobara.`,
      "timeout",
    );
  } finally {
    clearTimeout(timer);
    args.signal?.removeEventListener("abort", relay);
  }

  /*
   * ⚠️ Jawab **pehle text ki tarah** padha jaata hai, `response.json()` se nahi.
   *
   * Ye seedha ek asli bug ka ilaaj hai. Server ka function timeout ho jaaye to
   * Vercel apna **HTML ka error page** lautata hai, JSON nahi — aur `response.json()`
   * uspar phat jaata tha, is message ke saath:
   *
   *     Unexpected token 'A', "An error o"... is not valid JSON
   *
   * Wo message har scene par dikhta tha aur usse na wajah pata chalti thi na
   * ilaaj. Ab wo halat pehchani jaati hai aur seedha wajah likhi jaati hai.
   */
  const raw = await response.text();
  let json: TtsReply | null = null;
  try {
    json = JSON.parse(raw) as TtsReply;
  } catch {
    json = null;
  }

  if (json === null) {
    throw new VoiceError(
      response.status >= 500 || response.status === 504
        ? "Server ne jawab beech me chhod diya (aksar iska matlab hai ki provider bahut dheema tha). Dobara dabao."
        : `Server ne aisa jawab diya jo samajh nahi aaya (HTTP ${response.status}).`,
      "timeout",
    );
  }

  if (response.status === 429) {
    throw new VoiceError(
      json.reason || json.error || "Awaaz banane ki hadd lag gayi.",
      json.quotaExhausted ? "quota-over" : "rate-limit",
      json.retryAfterSeconds ?? null,
    );
  }

  if (!response.ok || !json.asset) {
    throw new VoiceError(
      json.reason || json.error || `HTTP ${response.status}`,
      response.status >= 500 ? "server" : "other",
    );
  }

  /*
   * ⚠️ Nayi asset bani — list taaza karo, warna Export "asset nahi mila" bolega.
   * Ye line yahin honi chahiye, bulane walon me nahi: ek bhi jagah chhoot jaaye to
   * wo galti sirf Export ke waqt dikhti hai.
   */
  forgetAssetMeta();

  return {
    assetId: json.asset.id,
    // Lambai wahi jo abhi bani — scene ki lambai isi par bandhi hai.
    seconds: json.asset.durationMs ? json.asset.durationMs / 1000 : null,
    cached: json.cached === true,
  };
}
