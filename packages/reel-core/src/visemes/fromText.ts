import { REST_VISEME } from "./shapes";

/**
 * Text se muh ke shape ki qatar — bina awaaz sune (bolti tasveer).
 *
 * ⚠️ Ye tabhi mumkin hai kyunki awaaz **hum khud banate hain** (TTS), yaani uska
 * text pehle se paas hota hai. Aam lip-sync ko ye suvidha nahi hoti — use awaaz
 * se hi andaaza lagana padta hai ki kaunsa akshar bola gaya, aur wo andaaza
 * aksar galat hota hai. Yahan andaaze ki zaroorat hi nahi.
 *
 * ⚠️ Yahan **sirf shape** nikalta hai, waqt nahi. "Kab" ka jawab awaaz ke
 * envelope se aata hai (`track.ts`). Dono ko ek jagah karne ki koshish do baar
 * ki ja chuki hai aur dono baar wahi nikla: text se waqt nikalna matlab TTS ki
 * saans wale sannate me bhi muh chalta rehna.
 *
 * ⚠️ Ye table **poori tarah sahi nahi hai**, aur wo theek hai — lip sync me
 * "lagbhag sahi" aur "bilkul sahi" me aankh ko farak nahi dikhta. Par ek cheez
 * bilkul sahi honi chahiye: **honth band hone wale lamhe**. `म`/`ब`/`प` par
 * honth na milna wo ek galti hai jo har dekhne wala turant pakad leta hai, bina
 * ye jaane ki galat kya hai.
 */

export interface VisemeStep {
  viseme: string;
  /**
   * Is kadam ka bhaar — lambe swar zyada waqt lete hain.
   *
   * ⚠️ Ye second nahi hai. Asli waqt `track.ts` me tay hota hai, jab pata chalta
   * hai ki awaaz kitni lambi hai aur kahan-kahan bolna ho raha hai. Yahan second
   * likh dena matlab ek hi text ke liye do alag sach — ek yahan, ek wahan.
   */
  weight: number;
}

/* ------------------------------------------------------------ bhaar ke naap */

/** Honth band hone ka lamha chhota hota hai — par hota zaroor hai. */
const LEAD_WEIGHT = 0.4;
const SHORT_VOWEL = 1;
const LONG_VOWEL = 1.35;
const REST_WEIGHT = 0.7;
/** Shabd ke ant me pada vyanjan, jiske baad koi swar nahi (jaise "stop" ka p). */
const TAIL_WEIGHT = 0.5;

/* ------------------------------------------------------------- Devanagari */

interface Vowel {
  viseme: string;
  long: boolean;
}

/** Matra — vyanjan ke baad lagne wala swar ka chinh. */
const DEVA_SIGNS: Record<string, Vowel> = {
  "ा": { viseme: "AA", long: true }, // ा
  "ि": { viseme: "EE", long: false }, // ि
  "ी": { viseme: "EE", long: true }, // ी
  "ु": { viseme: "OO", long: false }, // ु
  "ू": { viseme: "OO", long: true }, // ू
  "ृ": { viseme: "EE", long: false }, // ृ
  "े": { viseme: "EE", long: true }, // े
  "ै": { viseme: "EE", long: true }, // ै
  "ो": { viseme: "OO", long: true }, // ो
  "ौ": { viseme: "OO", long: true }, // ौ
};

/** Apne aap khada swar. */
const DEVA_VOWELS: Record<string, Vowel> = {
  "अ": { viseme: "AA", long: false }, // अ
  "आ": { viseme: "AA", long: true }, // आ
  "इ": { viseme: "EE", long: false }, // इ
  "ई": { viseme: "EE", long: true }, // ई
  "उ": { viseme: "OO", long: false }, // उ
  "ऊ": { viseme: "OO", long: true }, // ऊ
  "ऋ": { viseme: "EE", long: false }, // ऋ
  "ए": { viseme: "EE", long: true }, // ए
  "ऐ": { viseme: "EE", long: true }, // ऐ
  "ओ": { viseme: "OO", long: true }, // ओ
  "औ": { viseme: "OO", long: true }, // औ
};

/** Halant — iske baad wale vyanjan se jud jaata hai, apna swar nahi leta. */
const DEVA_VIRAMA = "्";

/**
 * Vyanjan ka apna shape — swar se **pehle** dikhne wala lamha.
 *
 * ⚠️ Jo yahan nahi hai (क, ख, ग, घ, य, ह) unka apna koi dikhne layak shape nahi
 * hota — wo gale me bante hain, honth par nahi. Unke liye zabardasti koi shape
 * daalna muh ko bina wajah hilata hai, aur wo hilna dekhne wale ko "hakla raha
 * hai" jaisa lagta hai.
 */
const DEVA_LEAD: Record<string, string> = {
  "म": "MBP", // म
  "ब": "MBP", // ब
  "भ": "MBP", // भ
  "प": "MBP", // प
  "फ": "FV", // फ
  "व": "FV", // व
  "स": "S", // स
  "श": "S", // श
  "ष": "S", // ष
  "च": "S", // च
  "छ": "S", // छ
  "ज": "S", // ज
  "झ": "S", // झ
  "त": "L", // त
  "थ": "L", // थ
  "द": "L", // द
  "ध": "L", // ध
  "न": "L", // न
  "ल": "L", // ल
  "र": "L", // र
  "ट": "L", // ट
  "ठ": "L", // ठ
  "ड": "L", // ड
  "ढ": "L", // ढ
  "ण": "L", // ण
};

function isDevaConsonant(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0915 && code <= 0x0939;
}

/* ----------------------------------------------------------------- Latin */

const LATIN_VOWELS: Record<string, Vowel> = {
  a: { viseme: "AA", long: false },
  e: { viseme: "EE", long: false },
  i: { viseme: "EE", long: false },
  o: { viseme: "OO", long: false },
  u: { viseme: "OO", long: false },
  y: { viseme: "EE", long: false },
};

const LATIN_LEAD: Record<string, string> = {
  m: "MBP",
  b: "MBP",
  p: "MBP",
  f: "FV",
  v: "FV",
  w: "OO",
  s: "S",
  z: "S",
  c: "S",
  j: "S",
  x: "S",
  t: "L",
  d: "L",
  n: "L",
  l: "L",
  r: "L",
};

function isLatinLetter(ch: string): boolean {
  return /[a-z]/.test(ch);
}

/* ------------------------------------------------------------------ chalna */

/**
 * Text padho aur muh ke shape ki qatar banao.
 *
 * Devanagari aur Latin dono chalte hain, aur mile-jule bhi — Hinglish me wahi
 * aam hai ("aaj ka **update**").
 */
export function visemesFromText(text: string): VisemeStep[] {
  const steps: VisemeStep[] = [];

  const pushRest = (): void => {
    /*
     * ⚠️ Lagatar do `rest` nahi. Do space ya "…" par teen-chaar rest bhar dene se
     * un sab ko bhaar milta hai, aur `track.ts` unke hisaab se bolne wale hisse
     * ka waqt kaat leta hai — yaani muh asli shabdon par jaldbaazi karta hai.
     */
    if (steps[steps.length - 1]?.viseme === REST_VISEME) return;
    steps.push({ viseme: REST_VISEME, weight: REST_WEIGHT });
  };

  const pushVowel = (vowel: Vowel): void => {
    steps.push({ viseme: vowel.viseme, weight: vowel.long ? LONG_VOWEL : SHORT_VOWEL });
  };

  const lower = text.toLowerCase();
  let at = 0;

  while (at < lower.length) {
    const ch = lower[at] as string;

    /* --------------------------------------------------------- Devanagari */

    if (DEVA_VOWELS[ch]) {
      pushVowel(DEVA_VOWELS[ch] as Vowel);
      at += 1;
      continue;
    }

    if (isDevaConsonant(ch)) {
      const lead = DEVA_LEAD[ch];
      at += 1;

      /*
       * Halant — is vyanjan ka apna swar nahi hai, wo agle se jud jaata hai
       * (jaise "क्ष"). Uska sirf apna shape dikhta hai.
       */
      if (lower[at] === DEVA_VIRAMA) {
        if (lead) steps.push({ viseme: lead, weight: LEAD_WEIGHT });
        at += 1;
        continue;
      }

      if (lead) steps.push({ viseme: lead, weight: LEAD_WEIGHT });

      const sign = lower[at] ? DEVA_SIGNS[lower[at] as string] : undefined;
      if (sign) {
        pushVowel(sign);
        at += 1;
      } else {
        /*
         * Bina matra ke vyanjan apne saath "अ" leta hai — Devanagari ka apna
         * niyam. Ise chhod dene par "कमल" jaisa shabd teen band honth ban jaata
         * aur muh kabhi khulta hi nahi.
         */
        pushVowel({ viseme: "AA", long: false });
      }
      continue;
    }

    /*
     * Anusvara/chandrabindu (ं ँ) aur visarga (ः) — inka apna muh nahi hota, wo
     * pichhle swar ke saath hi bolte hain. Inhe apna shape dena muh ko ek bekaar
     * ka jhatka deta hai.
     */
    if (ch === "ं" || ch === "ँ" || ch === "ः" || ch === DEVA_VIRAMA) {
      at += 1;
      continue;
    }

    /* -------------------------------------------------------------- Latin */

    if (isLatinLetter(ch)) {
      if (LATIN_VOWELS[ch]) {
        /*
         * Swar ka poora guchha ek hi shape deta hai ("boat" ka "oa"). Har akshar
         * ko apna shape dene par muh ek hi swar me do baar badalta hai, jo
         * kaanpne jaisa dikhta hai.
         */
        const first = LATIN_VOWELS[ch] as Vowel;
        let count = 0;
        while (at < lower.length && LATIN_VOWELS[lower[at] as string]) {
          at += 1;
          count += 1;
        }
        pushVowel({ viseme: first.viseme, long: count > 1 });
        continue;
      }

      /* Vyanjan ka guchha — shape pehle wale se ("stop" me "s"). */
      const lead = LATIN_LEAD[ch];
      while (at < lower.length && isLatinLetter(lower[at] as string) && !LATIN_VOWELS[lower[at] as string]) {
        at += 1;
      }

      const nextIsVowel = at < lower.length && LATIN_VOWELS[lower[at] as string] !== undefined;
      if (lead) {
        steps.push({ viseme: lead, weight: nextIsVowel ? LEAD_WEIGHT : TAIL_WEIGHT });
      }
      continue;
    }

    /* ----------------------------------------------------- baaki sab kuch */

    pushRest();
    at += 1;
  }

  return steps;
}
