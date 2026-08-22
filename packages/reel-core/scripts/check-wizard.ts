/**
 * Wizard ki sifaarish aur naam — chala kar dekho (26.2 / 26.3).
 *
 * ```
 * npm run check --workspace @reel/core
 * ```
 *
 * Repo me koi test runner nahi hai; yahan ka tarika `check-*` script hai
 * (`worker/scripts/check-fonts.ts`, `check-bundle-cache.ts`). Wahi tarika yahan
 * bhi — ek hi tarika, ek hi jagah samajhne layak.
 *
 * ⚠️ Sabse zaroori jaanch neeche wali **aakhri** hai: har registry entry ka aam
 * bhasha wala naam maujood hai ya nahi. Wo ek chup-chaap chalne wali khaami se
 * bachati hai — naya preset jodne par UI par kachcha id (`focus-pull`) chhap
 * jaata hai. Kuch toota hua nahi dikhta, koi error nahi aata; bas ek aadmi ek
 * anjaan shabd padh kar bina chune aage badh jaata hai.
 */

import {
  ANIMATION_PLAIN_NAMES,
  TRANSITION_PLAIN_NAMES,
  missingPlainNames,
  plainAnimation,
  plainTransition,
  suggestAll,
  suggestAnimation,
  suggestTransition,
  type WizardSceneLike,
} from "../src/index";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function scene(partial: Partial<WizardSceneLike>): WizardSceneLike {
  return { type: "image_audio", text: "kuch lamba text jo tees akshar se zyada hai", hasImage: true, ...partial };
}

/* ------------------------------------------------------- suggestAnimation */

console.log("\nsuggestAnimation");

check(
  "bina tasveer ke koi animation nahi",
  suggestAnimation(scene({ hasImage: false }), 0) === null,
  "text-wale scene par animation text par lag jaata — aur wo ajeeb dikhta hai",
);

check("CTA par uchhal kar aana", suggestAnimation(scene({ type: "cta" }), 0) === "pop-in");

check(
  "chhoti line par uchhal kar aana",
  suggestAnimation(scene({ text: "Apka Saathi." }), 4) === "pop-in",
);

check(
  "lambi line, sam index par dheema zoom",
  suggestAnimation(scene({}), 0) === "kenburns-slow",
);

check("lambi line, visham index par bahaav", suggestAnimation(scene({}), 1) === "cinematic-drift");

/*
 * ⚠️ Ye jaanch niyam ki nahi, **nateeje** ki hai: aath scene ki asli kahani par
 * ek hi animation baar-baar na lage. Sam/visham wala niyam theek likha ho par
 * agar sab lines chhoti nikal aayein to poori reel ek hi preset par chali jaati,
 * aur wo baat kisi bhi ek-scene wali jaanch me kabhi nahi dikhti.
 */
const kahani: WizardSceneLike[] = [
  "Beta... license expire ho gaya.",
  "Papa ki awaaz thodi dheemi thi.",
  "Jinhone humari har date yaad rakhi... unki ek date main bhool gaya.",
  "Us raat maine Apka Saathi kholi. Papa ke saare documents — ek jagah.",
  "Har expiry ka reminder, waqt se pehle.",
  "Ab Papa ko yaad rakhne ki zarurat nahi padti. Apka Saathi yaad rakhta hai.",
].map((text) => scene({ text }));

const chuni = kahani.map((s, i) => suggestAnimation(s, i));
check(
  "asli kahani par ek se zyada animation aayi",
  new Set(chuni).size > 1,
  `mile: ${[...new Set(chuni)].join(", ")}`,
);

/* ------------------------------------------------------ suggestTransition */

console.log("\nsuggestTransition");

check(
  "pehla scene hamesha seedha kat",
  suggestTransition(0, true, false) === "none",
  "pehla scene kahin SE aa hi nahi raha — wahan fade reel ko kaali screen se shuru karta hai",
);

check("tasveer se tasveer par ghulna", suggestTransition(1, true, true) === "crossfade");

check(
  "text ek taraf ho to halka gayab",
  suggestTransition(1, true, false) === "fade" && suggestTransition(2, false, true) === "fade",
);

/* -------------------------------------------------------------- suggestAll */

console.log("\nsuggestAll");

const sab = suggestAll(kahani);
check("har scene ka jawab aaya", sab.length === kahani.length);
check("pehle scene ka transition none", sab[0]?.transition === "none");
check(
  "doosre scene ne pichhle ki tasveer dekhi",
  sab[1]?.transition === "crossfade",
  "dono me tasveer hai",
);

const mila: WizardSceneLike[] = [scene({ hasImage: true }), scene({ hasImage: false }), scene({ hasImage: true })];
const milaSab = suggestAll(mila);
check(
  "bina tasveer wale ke baad wapas fade",
  milaSab[2]?.transition === "fade",
  "pichhle me tasveer nahi thi",
);

/* ------------------------------------------------------------ naam poore hain */

console.log("\naam bhasha wale naam");

const missing = missingPlainNames();
check(
  "har animation preset ka naam likha hai",
  missing.animations.length === 0,
  missing.animations.length > 0 ? `chhoot gaye: ${missing.animations.join(", ")}` : "",
);
check(
  "har transition ka naam likha hai",
  missing.transitions.length === 0,
  missing.transitions.length > 0 ? `chhoot gaye: ${missing.transitions.join(", ")}` : "",
);

check(
  "har naam ke saath 'kab theek hai' bhi hai",
  [...ANIMATION_PLAIN_NAMES, ...TRANSITION_PLAIN_NAMES].every(
    (entry) => entry.label.trim().length > 0 && entry.when.trim().length > 0,
  ),
  "naam ke bina 'kab' bekaar hai — aadmi ko wahi chahiye",
);

check("plainAnimation lookup chalta hai", plainAnimation("kenburns-slow")?.label === "Dheema zoom");
check("plainTransition lookup chalta hai", plainTransition("crossfade")?.label === "Ghulna");
check("anjaan id par null", plainAnimation("aisa-koi-nahi") === null);

/*
 * ⚠️ Sifaarish sirf wahi id de sakti hai jo registry me sach me hai. Ye jaanch
 * seedhi lagti hai par yahi wo galti pakadti hai jiska nateeja sabse ajeeb hota:
 * ek galat id doc me chali jaati hai, render use pehchaanta nahi, aur clip par
 * koi animation lagta hi nahi — bina kisi error ke.
 */
const sabIds = new Set(ANIMATION_PLAIN_NAMES.map((entry) => entry.id));
const sujhaye = kahani.map((s, i) => suggestAnimation(s, i)).filter((id): id is string => id !== null);
check(
  "sifaarish sirf maujood animation deti hai",
  sujhaye.every((id) => sabIds.has(id)),
  sujhaye.join(", "),
);

const transitionIds = new Set(TRANSITION_PLAIN_NAMES.map((entry) => entry.id));
check(
  "sifaarish sirf maujood transition deti hai",
  sab.every((entry) => transitionIds.has(entry.transition)),
);

/* ------------------------------------------------------------------ nateeja */

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
