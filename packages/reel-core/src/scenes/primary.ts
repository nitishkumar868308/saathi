import type { Doc, Item, Scene } from "../schema/project";

/**
 * Scene ka **primary item** — wo item jispar scene-level animation lagti hai (12.11).
 *
 * ⚠️ **Yahi wo faisla hai jiski wajah se 12.11 itne din ruka raha**, aur wo ruk-na
 * theek tha: galat item chun lene par user ko lagta hai animation lagi hi nahi.
 * `image_audio` scene me teen item hote hain — tasveer, awaaz, caption. Agar
 * animation caption par lag jaye to tasveer wahin khadi rehti hai aur user teen
 * baar dropdown badal kar chhod deta hai.
 *
 * Niyam ek line ka hai, aur wo aankh se aata hai:
 *
 *     **jo cheez sabse peeche, poori screen par dikhti hai — wahi primary hai.**
 *
 * Practically: scene ke apne kram me **pehla aisa item jo awaaz nahi hai aur
 * caption nahi hai**. Ye kaam karta hai kyunki har `build()` pehle background
 * (image/video/shape) banata hai aur caption hamesha aakhir me jodta hai —
 * yaani kram khud hi answer likh deta hai, aur har naye scene type par ye niyam
 * bina badle chalta rehta hai.
 *
 * ⚠️ Item ka type yahan **naam se** dekha jaata hai (`audio` / `subtitle`),
 * registry ke kisi flag se nahi. Ye jaan-boojhkar hai: registry me "primary ho
 * sakta hai" jaisa flag jodne par har naye item type ko wo flag yaad rakhna
 * padta, aur bhoolne par wo chup-chaap primary ban jaata. Yahan ulta hai — nayi
 * cheez by default primary ban sakti hai, aur sirf do saaf apwaad hain.
 */

/** Ye do kabhi primary nahi ho sakte. Awaaz dikhti hi nahi; caption upar ki parat hai. */
const NEVER_PRIMARY = new Set(["audio", "subtitle"]);

export function primarySceneItem(doc: Doc, sceneId: string): Item | null {
  const scene = doc.scenes.find((entry) => entry.id === sceneId);
  if (!scene) return null;
  return primaryOfScene(doc.items, scene);
}

/** Wahi faisla, jab scene aur items pehle se haath me hon. */
export function primaryOfScene(items: readonly Item[], scene: Scene): Item | null {
  const byId = new Map(items.map((item) => [item.id, item]));

  /*
   * Kram **scene ke `itemIds` se** aata hai, `doc.items` se nahi — aur ye farak
   * asli hai. `doc.items` timeline ka kram hai (track aur startFrame se hilta
   * rehta hai); `scene.itemIds` wo kram hai jisme `build()` ne unhe banaya tha.
   * Timeline par clip upar-neeche karne se scene ka primary badal jaana bilkul
   * anaap hoga — user ne to sirf ek clip khiskayi thi.
   */
  const inScene = scene.itemIds
    .map((id) => byId.get(id))
    .filter((item): item is Item => item !== undefined);

  const visual = inScene.find((item) => !NEVER_PRIMARY.has(item.type));
  if (visual) return visual;

  /*
   * Sirf awaaz/caption wala scene — jaise "voiceover only". Yahan primary hai hi
   * nahi, aur `null` lautana hi sahi jawab hai. UI isi par "is scene me animate
   * karne layak kuch nahi" likhti hai, ek bekaar dropdown dikhane ke bajay.
   */
  return null;
}
