import { ANIMATION_PRESETS } from "../config/animationPresets";
import { EFFECT_PRESETS } from "../config/effectPresets";
import { TRANSITIONS } from "../registry/transitions";

/**
 * Wizard me dikhne wale naam — **aam bhasha me** (26.1).
 *
 * ⚠️ Registry ke `label` yahan kaam nahi aate, aur ye koi sajawat ki baat nahi
 * hai. "Ken Burns punch" ek technique ka naam hai; jise wo technique pata hai
 * usi ko wo naam kuch batata hai. Wizard theek us aadmi ke liye bana hai jise ye
 * nahi pata — uske liye wo naam ek paheli hai, aur paheli ke saamne aadmi kuch
 * nahi chunta, wo bas "Aage" daba deta hai.
 *
 * Isliye do cheezein har entry me hain: kya dikhega (`label`) aur **kab ye theek
 * hai** (`when`). Doosri line pehli se zyada zaroori hai — naam se andaaza lag
 * bhi jaaye to bhi "iska istemal kab karna hai" ka jawab kahin nahi milta.
 *
 * ⚠️ Ye list registry se **alag** hai, aur wahi iska khatra hai: naya preset
 * jodne par yahan entry na ho to UI par kachcha id (`focus-pull`) chhap jaata
 * hai. Wo chup-chaap hota hai — kuch toota nahi dikhta, bas ek aadmi ek anjaan
 * shabd padh kar aage badh jaata hai. Isliye `npm run check` me ek jaanch hai jo
 * dono list ka mel dekhti hai (`scripts/check-wizard.ts`).
 */

export interface PlainName {
  /** Registry ka id — jo doc me likha jaata hai. */
  id: string;
  /** Screen par jo dikhta hai. */
  label: string;
  /** Ek line: ye kab theek hai. */
  when: string;
}

export const ANIMATION_PLAIN_NAMES: readonly PlainName[] = [
  { id: "kenburns-slow", label: "Dheema zoom", when: "Lambi, bhaari baat par — nazar tikti hai" },
  { id: "kenburns-punch", label: "Tez zoom", when: "Chaunkane wali line par" },
  { id: "pop-in", label: "Uchhal kar aana", when: "Chhoti line, CTA, ya naam" },
  { id: "cinematic-drift", label: "Bahaav", when: "Mahaul wale scene par" },
  { id: "slide-up-soft", label: "Neeche se upar", when: "Nayi baat shuru hone par" },
  { id: "focus-pull", label: "Focus", when: "Kisi ek cheez par dhyan le jaana ho" },
  { id: "push-in", label: "Paas aana", when: "Kisi baat par zor dena ho" },
  { id: "pull-back", label: "Door jaana", when: "Pehle ek hissa, phir poori baat" },
  { id: "pan-across", label: "Aar-paar", when: "Chaudi tasveer khadi reel me daalni ho" },
  { id: "tilt-in", label: "Tirchha aana", when: "Sticker, logo ya chhote card par" },
  { id: "slide-in-side", label: "Bagal se aana", when: "Do cheezein baari-baari dikhani ho" },
];

export const TRANSITION_PLAIN_NAMES: readonly PlainName[] = [
  { id: "none", label: "Seedha kat", when: "Tez raftaar, list-jaisi baat" },
  { id: "fade", label: "Halka gayab", when: "Aam badlav — sabse surakshit" },
  { id: "crossfade", label: "Ghulna", when: "Tasveer se tasveer, ya waqt beetna" },
  { id: "slide", label: "Khisakna", when: "Nayi jagah, naya hissa" },
  { id: "zoom", label: "Zoom se", when: "Zor dena ho" },
  { id: "blur", label: "Dhundhla ho kar", when: "Yaad ya sapne wala mod" },
  { id: "wipe", label: "Parda khisakna", when: "Ek hissa khatam, doosra shuru" },
];

/**
 * Rang ke effect — aam bhasha me (26.24).
 *
 * ⚠️ Pehla option `none` hai, aur wo list me **hona** chahiye. Bina uske "koi
 * effect nahi" par wapas jaane ka koi raasta nahi bachta: aadmi ek baar "B & W"
 * chun le to poori reel ke liye wo phans jaata hai, aur uske paas ek hi tarika
 * bachta hai — wizard dobara chalana. Transition ki list me `none` isi wajah se
 * hai.
 *
 * ⚠️ `when` me "kab" likha hai, "kya" nahi. "Sepia 0.45 + saturation 0.75" wo
 * baat hai jo preset ke andar likhi hai; aadmi ko ye jaanna hai ki uski tasveeron
 * par ye theek baithega ya nahi.
 */
export const EFFECT_PLAIN_NAMES: readonly PlainName[] = [
  { id: "none", label: "Jaisa hai", when: "Asli rang — sabse surakshit" },
  { id: "soft-glow", label: "Narm chamak", when: "Chehre aur product — thoda saaf aur ujla" },
  {
    id: "cinematic-contrast",
    label: "Filmy",
    when: "Gehra look — kahani wali reel par",
  },
  { id: "bw", label: "Safed-kaala", when: "Purani yaad, ya jab rang bikhre hue hon" },
  { id: "vintage", label: "Purana", when: "Bhoora, halka pheeka — nostalgia wali baat par" },
  { id: "warm-film", label: "Garam rang", when: "Chehre wale scene par" },
  { id: "cool-clean", label: "Saaf aur thanda", when: "App ya product dikhana ho" },
  { id: "pop-colour", label: "Rang chamka do", when: "Kuch bechna ho — khaana, kapda" },
  { id: "dreamy", label: "Dhundhla sapna", when: "Yaad ya kahani wale scene par" },
];

/**
 * Ek cheez **kaise aati hai** — aam bhasha me (26.30).
 *
 * ⚠️ Pehla option `inherit` hai ("Jaisa hai") aur wo list me sabse pehle **hona**
 * chahiye. Wo default hai, aur default ka dikhna zaroori hai: bina uske aadmi ko
 * lagta hai ki har cheez ke liye kuch chunna hi padega, aur wo CTA ke teen items
 * par teen faisle lene lagta hai jahan do ki zaroorat hi nahi thi.
 *
 * ⚠️ `inherit` aur `none` do alag cheezein hain. `inherit` = "maine kuch nahi
 * kaha", `none` = "is cheez par jaan-boojhkar koi harkat nahi". Ek hi rakhne par
 * "harkat hatao" ka koi raasta nahi bachta.
 */
export const ENTRY_PLAIN_NAMES: readonly PlainName[] = [
  { id: "inherit", label: "Jaisa hai", when: "Scene ka apna chunav chalta rahe" },
  { id: "none", label: "Kuch nahi", when: "Ye cheez bilkul sthir rahe" },
  { id: "fade", label: "Ubhar kar", when: "Logo aur nishaan — apni jagah par saaf hote hain" },
  { id: "slide", label: "Khisak kar", when: "Button aur patti — kinare se apni jagah tak" },
  { id: "pop", label: "Uchhal kar", when: "Chhoti cheez par dhyan le jaana ho" },
  { id: "blur", label: "Dhundhle se", when: "Tasveer — halke se saaf hoti hui" },
  { id: "spin", label: "Ghoom kar", when: "Sticker jaisi cheez par" },
];

/** Slide kis taraf se — jo aadmi padhta hai. */
export const ENTRY_FROM_NAMES: readonly PlainName[] = [
  { id: "bottom", label: "neeche se", when: "Button — neeche se uth kar apni jagah par" },
  { id: "top", label: "upar se", when: "Patti ya heading — upar se utar kar" },
  { id: "left", label: "baayen se", when: "Naam ya nishaan — baayen se andar" },
  { id: "right", label: "daayen se", when: "Naam ya nishaan — daayen se andar" },
];

export function plainEntry(id: string): PlainName | null {
  return ENTRY_PLAIN_NAMES.find((entry) => entry.id === id) ?? null;
}

/**
 * Awaaz aur music ke level — **naam se, number se nahi** (26.28).
 *
 * ⚠️ Ye list yahan hai, kisi ek step ke andar nahi, aur wo ek asli galti ke baad
 * hua. Wahi chunav ab do jagah dikhta hai — Awaaz wale step me har qatar par, aur
 * Dekho wale step me chuni hui cheez ke saath — aur do jagah do list rakhne par
 * ek din "Dheemi" ka matlab ek jagah 0.6 hota aur doosri jagah 0.5. Wo farak
 * screen par kabhi nahi dikhta; sirf sunne me lagta hai ki chunav tikta nahi.
 *
 * ⚠️ `value: null` ka apna matlab hai aur wo har list me nahi hai — sirf scene ke
 * music me, jahan uska matlab "jo poori reel me chal raha hai wahi" hai. `0` se
 * uska farak zaroori hai: `0` matlab "yahan band", chahe reel me kuch bhi ho.
 */
export interface WizardLevel {
  /** Volume (0-1) ya raftaar (1 = jaisi bani thi). `null` = "reel jaisa". */
  value: number | null;
  label: string;
  /** Ek line: ye kab theek hai. */
  when: string;
}

/**
 * Ek scene par awaaz kitni tez.
 *
 * ⚠️ "Chup" ek asli chunav hai, koi galti nahi. Kuch scene sirf dikhne ke liye
 * hote hain (b-roll, ek tasveer jispar music chalta hai), aur wahan bolne wala
 * ulta rukavat banta hai. Bina is chunav ke aadmi ko us scene ki awaaz **hatani**
 * padti thi — aur uske saath uska likha hua text bhi chala jaata tha.
 */
export const VOICE_LEVELS: readonly WizardLevel[] = [
  { value: 1, label: "Normal", when: "Aam line — jaisi bani hai" },
  { value: 1.3, label: "Tez", when: "Zor dene wali line par (thoda oopar)" },
  { value: 0.6, label: "Dheemi", when: "Peeche ki baat, ya jab tasveer hi asli baat ho" },
  { value: 0, label: "Chup", when: "Is scene par kuch bola na jaaye — sirf music/tasveer" },
];

/**
 * Awaaz ki raftaar.
 *
 * ⚠️ Sabse tez 1.3x par ruk-ta hai. Usse aage shabd aapas me chipak jaate hain;
 * wo slider par ek number ki tarah dikhta hai par sunne me toota hua lagta hai.
 * Jo hadd nateeja kharab karti ho, use dena hi nahi chahiye.
 */
export const VOICE_RATES: readonly WizardLevel[] = [
  { value: 0.85, label: "Dheemi", when: "Bhaari baat — sunne wale ko rukna chahiye" },
  { value: 1, label: "Normal", when: "Jaisi bani thi" },
  { value: 1.15, label: "Tez", when: "Reel ki aam raftaar — 30s me zyada baat" },
  { value: 1.3, label: "Bahut tez", when: "Sirf list ya ginti wali line par" },
];

/** Poori reel me music ka level. 0.15 sifaarish hai — dekho `MUSIC_LEVEL_DEFAULT`. */
export const MUSIC_LEVELS: readonly WizardLevel[] = [
  { value: 0.08, label: "Bahut halka", when: "Sirf khaali jagah bharne ke liye" },
  { value: 0.15, label: "Halka", when: "Bolne wale ke peeche — sabse surakshit" },
  { value: 0.3, label: "Sunai dene layak", when: "Jab bolne wala kam ho" },
  { value: 0.6, label: "Tez", when: "Sirf bina awaaz wali reel par" },
];

/**
 * Music ka sifaarish wala level.
 *
 * ⚠️ Ye number `emptyDraft`/`draftFromScript` me bhi likha hai, aur dono ka ek
 * hona zaroori hai — warna UI par "Sifaarish" ka nishaan us button par lagta hai
 * jo chuna hua nahi hai, aur wo ek chhoti si baat lagti hai jo poore chunav par
 * shak paida karti hai.
 */
export const MUSIC_LEVEL_DEFAULT = 0.15;

/** Ek scene par music ka level — `null` = poori reel wala. */
export const SCENE_MUSIC_LEVELS: readonly WizardLevel[] = [
  { value: null, label: "Reel jaisa", when: "Jo poori reel me chal raha hai" },
  { value: 0.05, label: "Bahut kam", when: "Zaroori baat boli ja rahi ho" },
  { value: 0, label: "Band", when: "Is scene par music bilkul nahi" },
];

/** Do level ek hi hain? (`null` bhi ek value hai — dekho `SCENE_MUSIC_LEVELS`.) */
export function sameLevel(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.01;
}

function find(list: readonly PlainName[], id: string): PlainName | null {
  return list.find((entry) => entry.id === id) ?? null;
}

export function plainAnimation(id: string): PlainName | null {
  return find(ANIMATION_PLAIN_NAMES, id);
}

export function plainTransition(id: string): PlainName | null {
  return find(TRANSITION_PLAIN_NAMES, id);
}

export function plainEffect(id: string): PlainName | null {
  return find(EFFECT_PLAIN_NAMES, id);
}

/**
 * Jinke naam nahi likhe — jaanch ke liye.
 *
 * ⚠️ Ye function UI me kabhi nahi chalta. Ye sirf `check` script ke liye hai,
 * aur ye yahin rehta hai (script me nahi) taaki dono list ke paas rahe: naya
 * preset jodne wala aadmi isi file me hai, aur uski nazar isi par padegi.
 */
export function missingPlainNames(): {
  animations: string[];
  transitions: string[];
  effects: string[];
} {
  const named = (list: readonly PlainName[]) => new Set(list.map((entry) => entry.id));
  const animationNames = named(ANIMATION_PLAIN_NAMES);
  const transitionNames = named(TRANSITION_PLAIN_NAMES);
  const effectNames = named(EFFECT_PLAIN_NAMES);

  return {
    animations: ANIMATION_PRESETS.filter((preset) => !animationNames.has(preset.id)).map(
      (preset) => preset.id,
    ),
    transitions: TRANSITIONS.list()
      .filter((entry) => !transitionNames.has(entry.id))
      .map((entry) => entry.id),
    effects: EFFECT_PRESETS.filter((preset) => !effectNames.has(preset.id)).map(
      (preset) => preset.id,
    ),
  };
}
