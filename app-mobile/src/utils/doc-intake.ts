/**
 * Document lene ka faisla — ek hi jagah, bina React aur bina expo.
 *
 * ⚠️ Ye file jaan-boojh ke bilkul shudh hai. Wahi wajah jo `reminder-bucket` aur
 * `doc-file-name` ke hisaab par likhi hai: iska toota hona CHUP hota hai. Na
 * crash, na error — bas ek selfie R2 par chadh jaati hai, ya net kharab hone par
 * user ka asli Aadhaar rok diya jaata hai. `tsc` in me se ek bhi nahi pakadta,
 * isliye inki jaanch `scripts/check-logic.mjs` se hoti hai.
 */

/**
 * Isse badi koi bhi file na AI ko jaati hai, na R2 par.
 *
 * ⚠️ Ye sirf AI ki hadd nahi hai — upload ki bhi hai. Do wajah ek saath: base64
 * file ko ~33% mota kar deta hai aur edge function ka request utna bada nahi
 * jaata; aur R2 ka free tier 10GB hai, jise ek-do badi file bahut jaldi kha
 * jaati hai.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** AI kis wajah se nahi chala / usne kya nahi paaya. */
export type ScanFailure = "unclear" | "offline" | "busy" | "slow" | "server";

export type IntakeInput = {
  /** File ka size. */
  bytes: number;
  /** AI ka jawab. `null` = theek padha. */
  failure: ScanFailure | null;
};

/**
 * `note` sirf ye batata hai ki screen par kaun si baat kehni hai — rok ka faisla
 * `save` par hai. Dono alag isliye rakhe hain ki "save hone do" ke teen alag
 * kaaran hain, aur teenon ki baat alag honi chahiye. Ek jaisa bolna hi purani
 * dikkat thi.
 */
export type IntakeNote = "none" | "noDocument" | "tooBig" | "offline" | "busy" | "failed";

export type IntakeVerdict = { save: boolean; note: IntakeNote };

/**
 * Do rok hain, aur unka kram maayne rakhta hai.
 *
 * 1. **Size sabse pehle.** Badi file par AI chala hi nahi tha, isliye uske
 *    `failure` ki baat karna jhooth hoga — user ko "document nahi mila" dikhta
 *    aur wo saaf photo dobara kheenchta rehta, jabki dikkat size ki thi.
 *
 * 2. **`unclear`** — iklauti soorat jisme AI SACH ME chala aur usne kuch nahi
 *    dhoondha. Yaani wo selfie/ghar ki photo hai.
 *
 * ⚠️ Baaki har soorat me AI chala hi nahi (net gaya, Gemini bhara, server ki
 * dikkat). Un par rok lagane ka matlab hota ki kharab signal me user ka ASLI
 * document ruk jaye — aur storage wahan bach bhi nahi raha, kyunki wo asli
 * document tha.
 */
export function intakeVerdict(input: IntakeInput): IntakeVerdict {
  if (input.bytes > MAX_FILE_BYTES) return { save: false, note: "tooBig" };
  switch (input.failure) {
    case null:
      return { save: true, note: "none" };
    case "unclear":
      return { save: false, note: "noDocument" };
    case "offline":
      return { save: true, note: "offline" };
    case "busy":
    case "slow":
      return { save: true, note: "busy" };
    default:
      return { save: true, note: "failed" };
  }
}

/**
 * Mime ko saaf karo — sirf `type/subtype`, chhota likha hua.
 *
 * ⚠️ Ye zaroori hai. `DocumentPicker` mime ke saath `; charset=...` laga kar de
 * sakta hai, aur `doc-file-name.ts` ka `extForMime()` sirf THEEK `application/pdf`
 * ko pehchanta hai. Bina saaf kiye PDF cache me `.jpg` naam par baith jaati —
 * aur phir `cacheFileName()` use us naam par dhoondhta hi nahi, yaani abhi-abhi
 * rakhi hui file "cache me hai hi nahi" gini jaati: dobara download, aur offline
 * me bilkul nahi khulti.
 */
export function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * PDF hai kya.
 *
 * ⚠️ Yahan bhi bina saaf kiye mime chal jaata hai (`startsWith`), kyunki ye DB me
 * pehle se padi `mime_type` par bhi chalta hai — jo kis shakl me likhi gayi thi,
 * uski koi guarantee nahi.
 */
export function isPdf(mime: string | null | undefined): boolean {
  return normalizeMime(mime) === "application/pdf";
}
