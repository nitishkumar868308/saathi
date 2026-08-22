import { ANIMATION_PRESETS } from "../config/animationPresets";
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

function find(list: readonly PlainName[], id: string): PlainName | null {
  return list.find((entry) => entry.id === id) ?? null;
}

export function plainAnimation(id: string): PlainName | null {
  return find(ANIMATION_PLAIN_NAMES, id);
}

export function plainTransition(id: string): PlainName | null {
  return find(TRANSITION_PLAIN_NAMES, id);
}

/**
 * Jinke naam nahi likhe — jaanch ke liye.
 *
 * ⚠️ Ye function UI me kabhi nahi chalta. Ye sirf `check` script ke liye hai,
 * aur ye yahin rehta hai (script me nahi) taaki dono list ke paas rahe: naya
 * preset jodne wala aadmi isi file me hai, aur uski nazar isi par padegi.
 */
export function missingPlainNames(): { animations: string[]; transitions: string[] } {
  const named = (list: readonly PlainName[]) => new Set(list.map((entry) => entry.id));
  const animationNames = named(ANIMATION_PLAIN_NAMES);
  const transitionNames = named(TRANSITION_PLAIN_NAMES);

  return {
    animations: ANIMATION_PRESETS.filter((preset) => !animationNames.has(preset.id)).map(
      (preset) => preset.id,
    ),
    transitions: TRANSITIONS.list()
      .filter((entry) => !transitionNames.has(entry.id))
      .map((entry) => entry.id),
  };
}
