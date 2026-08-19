/**
 * Overlap policy — do clips ek hi track par ek hi jagah aa jaayein to kya ho.
 *
 * Ye faisla **ek hi jagah** hona chahiye (checklist 8.9), warna har op apni marzi
 * karta hai: drag overwrite karta, paste push karta, duplicate kuch aur — aur
 * user kabhi bhi nahi jaan paata ki agli baar kya hoga. Isliye policy ek naam ke
 * saath yahan hai, aur har op ise ek argument ki tarah leta hai.
 *
 * ⚠️ Ye **config hai, code nahi**: nayi policy jodna is list me ek entry hai
 * (aur `ops.ts` me uska ek case), UI apne aap use dikhane lagta hai.
 */

export type OverlapPolicy = "overwrite" | "push" | "reject";

export interface OverlapPolicyDef {
  id: OverlapPolicy;
  label: string;
  hint: string;
}

export const OVERLAP_POLICIES: readonly OverlapPolicyDef[] = [
  {
    id: "overwrite",
    label: "Overwrite",
    hint: "Jo clip upar rakhi jaa rahi hai wo jeetegi — neeche wali kat jaayegi",
  },
  {
    id: "push",
    label: "Push",
    hint: "Aage wali clips khisak jaayengi, kuch katega nahi",
  },
  {
    id: "reject",
    label: "Reject",
    hint: "Overlap hone hi nahi dega — drop mana ho jaayega",
  },
];

/**
 * Default `overwrite` hai kyunki har video editor ka default yahi hai, aur wahi
 * cheez sabse kam chaunkati hai: jo clip tumne abhi haath se wahan rakhi hai,
 * wahi dikhni chahiye.
 */
export const DEFAULT_OVERLAP_POLICY: OverlapPolicy = "overwrite";

export function getOverlapPolicy(id: string): OverlapPolicyDef | undefined {
  return OVERLAP_POLICIES.find((policy) => policy.id === id);
}

export function isOverlapPolicy(value: unknown): value is OverlapPolicy {
  return typeof value === "string" && OVERLAP_POLICIES.some((policy) => policy.id === value);
}
