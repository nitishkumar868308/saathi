/**
 * Galat status wale jawab ka body — **status ke saath**.
 *
 * ⚠️ Ye file ek asli, dikh chuki galti ka ilaaj hai. Admin > Logs me error aati
 * thi: `{"message":""}` — na message, na code, na status. Uske saath sirf itna
 * hota tha ki Home screen ka `load` toota. Us se ye kabhi pata nahi chalta tha
 * ki server ne 500 diya, 403 diya, ya beech me network kat gaya — yaani wo log
 * padha ja sakta tha par usse kuch kiya nahi ja sakta tha.
 *
 * Wo shakal supabase-js ke ek hi raaste se banti hai: status galat aaya aur body
 * ka `JSON.parse` fail ho gaya, tab wo `{ message: body }` bana deta hai. Body
 * bilkul khaali ho to `message` bhi khaali. Aur khaali body galat status ke saath
 * phone par aam baat hai — gateway ka 5xx, public WiFi ka beech me kaatna, ya
 * captive portal ka HTML thopna.
 *
 * Isliye jawab ko supabase-js tak pahunchne se **pehle** ek sacha body de diya
 * jaata hai. Nateeja: har aisi error ab apna status aur code le kar aati hai, aur
 * wo 28 alag `if (error) throw error` me se kisi ko chhue bina hota hai.
 *
 * ⚠️ Yahan koi React Native ka import nahi aata, aur wo jaan-boojhkar hai — isi
 * wajah se ye `scripts/check-logic.mjs` me bina phone, bina build chal jaati hai.
 */

/** Body ka itna hissa message me jaata hai — HTML ka poora page kisi kaam ka nahi. */
const MAX_DETAIL = 200;

/**
 * Is jawab ke liye naya body chahiye? — `null` matlab jaisa hai waisa rehne do.
 *
 * @param status      HTTP status.
 * @param statusText  Server ka bataya hua naam ("Bad Gateway"). Khaali ho sakta hai.
 * @param body        Jo sach me aaya.
 */
export function errorBodyFor(
  status: number,
  statusText: string,
  body: string,
): string | null {
  /*
   * ⚠️ 404 + khaali body ko **chhedna mana hai**. postgrest-js usi jodi ko
   * pehchan kar 204 "No Content" bana deta hai (unke apne issue #295 ka
   * workaround). Yahan uske liye ek body bana dene par "koi row nahi mili" ek
   * error ban jaati — yaani ek khaali list ki jagah screen par laal patti.
   */
  if (status === 404 && body.trim() === "") return null;

  /*
   * Asli JSON error body — PostgREST ka `{message, details, hint, code}`, ya
   * GoTrue ka apna. Usme sach pehle se hai; uske upar apna likhna use dabana
   * hoga.
   */
  const trimmed = body.trim();
  if (trimmed !== "") {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return null;
    } catch {
      /* JSON nahi hai — neeche apna body banega */
    }
  }

  const label = statusText.trim() ? `HTTP ${status} ${statusText.trim()}` : `HTTP ${status}`;
  /*
   * Khaali body aur "kuch aaya par JSON nahi" do alag haalat hain, aur dono ko
   * ek jaisa likhna galat hoga: pehli me network beech me kata hai, doosri me
   * beech me koi aur baitha hai (aksar WiFi ka login page). Log padhne wale ke
   * liye ye farak sabse kaam ka hai.
   */
  const message =
    trimmed === ""
      ? `${label} — server ne khaali jawab bheja`
      : `${label} — jawab JSON nahi tha: ${trimmed.slice(0, MAX_DETAIL)}`;

  return JSON.stringify({ message, code: `HTTP_${status}` });
}
