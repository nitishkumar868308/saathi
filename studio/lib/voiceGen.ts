import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Ek scene ki awaaz banana — **ek hi jagah** (26.25).
 *
 * ⚠️ Ye function is liye alag hai ki wahi kaam ab teen jagah se hota hai: Awaaz
 * wale step ki qatar se, "Sab ki awaaz banao" se, aur ab Shabd wale step se bhi
 * (text badalne ke turant baad). Teen jagah teen `fetch` likhne ka nateeja pehle
 * hi dikh chuka hai — "Sab ki awaaz banao" wala raasta `voiceSeconds` likhna bhool
 * gaya tha, aur har scene ki lambai chup-chaap AI ke andaaze par reh jaati thi.
 * Ek hi jagah rehne se aisi galti dobara ho hi nahi sakti.
 *
 * ⚠️ Har call **ek** scene ke liye hai, aur bulane wala unhe ek-ek karke bhejta
 * hai. Ek saath bhejne par provider rate-limit par 429 dene lagta hai, cache ka
 * faayda khatam ho jaata hai (do same text ek saath jaayein to dono nayi banti
 * hain), aur fail hone par ye batana namumkin ho jaata hai ki kaunsi fail hui.
 */

export interface MadeVoice {
  assetId: string;
  /** Bani hui awaaz ki naapi hui lambai — `null` = provider ne batayi hi nahi. */
  seconds: number | null;
  /** Wahi awaaz pehle se bani hui thi (naya kharcha nahi hua). */
  cached: boolean;
}

export async function generateVoice(args: {
  text: string;
  categoryId: string;
  /**
   * Kis provider se — `null` = server pehla chalne layak khud chun le.
   *
   * ⚠️ Ise bhejna is liye zaroori hai ki bina iske **har scene apna faisla** karta
   * hai: har request par server dobara dekhta hai ki kaun chalne layak hai. Aam
   * din wo hamesha wahi nikalta hai, par jis din nahi nikalta (key ki hadd, ek pal
   * ki dikkat) us din reel ke beech se bolne wala badal jaata hai — aur wo galti
   * sirf reel sun kar pakdi jaati hai. Ek baar chun kar poore batch me wahi bhejna
   * us halat ko banne hi nahi deta.
   */
  providerId?: string | null;
}): Promise<MadeVoice> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      categoryId: args.categoryId,
      ...(args.providerId ? { providerId: args.providerId } : {}),
    }),
  });

  const json = (await response.json()) as {
    asset?: { id: string; durationMs?: number | null };
    cached?: boolean;
    error?: string;
    reason?: string;
  };

  if (!response.ok || !json.asset) {
    throw new Error(json.reason || json.error || `HTTP ${response.status}`);
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
