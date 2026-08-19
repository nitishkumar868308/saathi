/**
 * Devanagari → Latin (Hinglish) — captions ke liye (23.4).
 *
 * ⚠️ **Kyun chahiye**: whisper Hindi ko Devanagari me likhta hai ("नमस्ते"), par
 * reels me captions zyadatar Latin Hinglish me chalti hain ("Namaste"). Dono
 * sahi hain — isliye ye ek **option** hai, majboori nahi, aur asli Devanagari
 * text kabhi mitaya nahi jaata (transcript apne paas rehta hai).
 *
 * ⚠️ Ye **transliteration** hai, translation nahi. "मैं ghar जा रहा हूँ" ka
 * matlab nahi badalta, sirf likhawat badalti hai.
 *
 * ⚠️ Aur ye poora sahi **nahi** hai, ye maan kar chalo. Hindi me beech ka schwa
 * ("a") kahan girta hai ye vyakaran se nahi, bolne ke riwaaz se tay hota hai
 * ("नमकीन" = namkeen, "namakeen" nahi). Yahan sirf **shabd ke aakhir** wala
 * schwa girta hai, jo sabse pakka niyam hai. Isliye output editable rehta hai
 * aur UI me likha jaata hai ki ye machine ka kaam hai.
 */

/** Vyanjan — inherent "a" ke bina. */
const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "ळ": "l",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  // Nukta wale — Urdu/English se aaye shabdon me aam hain.
  "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
};

/** Swatantra swar. */
const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ऍ": "e", "ऑ": "o",
};

/** Matra (swar ka chinh). */
const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ॅ": "e", "ॉ": "o",
};

const HALANT = "्";
const ANUSVARA = "ं";
const CHANDRABINDU = "ँ";
const VISARGA = "ः";
const NUKTA = "़";

const DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

/** Is text me Devanagari hai? (script auto-detect ke liye.) */
export function hasDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text);
}

/**
 * Ek shabd Devanagari se Latin me.
 *
 * Har vyanjan ke saath apne aap "a" lagta hai, jab tak uske aage matra ya halant
 * na ho. Aakhir me aane wala "a" hataya jaata hai — "कमल" → "kamal", "kamala"
 * nahi.
 */
export function devanagariWordToLatin(word: string): string {
  const characters = [...word];
  const out: string[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    let character = characters[index] as string;

    // Nukta alag character ban kar aa sakta hai — jod kar dekho.
    if (characters[index + 1] === NUKTA) {
      const joined = character + NUKTA;
      if (CONSONANTS[joined] !== undefined) {
        character = joined;
        index += 1;
      }
    }

    const consonant = CONSONANTS[character];
    if (consonant !== undefined) {
      out.push(consonant);

      const next = characters[index + 1] as string | undefined;
      if (next !== undefined && MATRAS[next] !== undefined) {
        out.push(MATRAS[next] as string);
        index += 1;
      } else if (next === HALANT) {
        // Halant = koi swar nahi, agla vyanjan juda hua.
        index += 1;
      } else {
        out.push("a");
      }
      continue;
    }

    if (VOWELS[character] !== undefined) {
      out.push(VOWELS[character] as string);
      continue;
    }
    if (DIGITS[character] !== undefined) {
      out.push(DIGITS[character] as string);
      continue;
    }
    if (character === ANUSVARA || character === CHANDRABINDU) {
      out.push("n");
      continue;
    }
    if (character === VISARGA) {
      out.push("h");
      continue;
    }
    if (character === "।" || character === "॥") {
      out.push(".");
      continue;
    }
    if (character === NUKTA || MATRAS[character] !== undefined || character === HALANT) {
      // Bina vyanjan ke aa gaya — chhod do, warna adhoora akshar nikalta hai.
      continue;
    }

    // Devanagari ke bahar ka kuch (English shabd, number, viraam) — jaisa hai waisa.
    out.push(character);
  }

  let latin = out.join("");

  /*
   * Aakhri schwa girao — Hindi ka sabse pakka niyam.
   *
   * ⚠️ Shart: shabd me ek se zyada swar ho. "न" akela "na" hi rehta hai; usse
   * "n" bana dena shabd hi mita deta hai.
   */
  if (latin.length > 2 && latin.endsWith("a") && !latin.endsWith("aa")) {
    const withoutLast = latin.slice(0, -1);
    if (/[aeiou]/.test(withoutLast)) latin = withoutLast;
  }

  /*
   * Aakhir wala "aa" chhota ho kar "a" — reels ka riwaaz.
   *
   * ⚠️ Ye vyakaran nahi, **likhne ka chalan** hai, aur wahi asli maayne rakhta
   * hai. Beech me "aa" hi chalta hai ("kaam", "aaj"), par shabd ke ant me log
   * "raha", "kya", "hua", "aaya" likhte hain — "rahaa", "kyaa" nahi. Bina is
   * niyam ke har doosra shabd thoda videshi lagta hai, aur user har baar haath
   * se theek karta rehta hai.
   */
  if (latin.endsWith("aa") && latin.length > 2) latin = `${latin.slice(0, -2)}a`;

  return latin;
}

/** Poora vaakya — sirf Devanagari wale shabd badalte hain, baaki jaisa ka waisa. */
export function devanagariToLatin(text: string): string {
  return text
    .split(/(\s+)/)
    .map((chunk) => (hasDevanagari(chunk) ? devanagariWordToLatin(chunk) : chunk))
    .join("");
}

/**
 * Caption ki likhawat (23.4).
 *
 * - `auto`  — jo aaya wahi rakho (whisper Hindi par Devanagari deta hai)
 * - `deva`  — Devanagari hi rakho
 * - `latin` — Hinglish (Latin) me badlo
 */
export type CaptionScript = "auto" | "deva" | "latin";

export const CAPTION_SCRIPTS: readonly { id: CaptionScript; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Jo transcribe se aaya, wahi" },
  { id: "deva", label: "देवनागरी", hint: "Hindi apni lipi me" },
  { id: "latin", label: "Hinglish", hint: "Roman me — reels me zyada chalta hai" },
];

/** Script lagao. `auto`/`deva` par text ko haath nahi lagta. */
export function applyCaptionScript(text: string, script: CaptionScript): string {
  return script === "latin" ? devanagariToLatin(text) : text;
}
