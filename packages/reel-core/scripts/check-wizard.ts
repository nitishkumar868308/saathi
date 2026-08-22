/**
 * Wizard — sifaarish, naam, aur poora apply ka raasta (26.2 / 26.3 / 26.11).
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
  applyWizard,
  autoFill,
  createEmptyProject,
  draftFromScript,
  effectiveType,
  missingPlainNames,
  plainAnimation,
  plainTransition,
  primarySceneItem,
  suggestAll,
  suggestAnimation,
  suggestTransition,
  voiceStale,
  type AiScript,
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

/* ==================================================================== */
/*  applyWizard — poora raasta, bina browser ke (26.11)                 */
/* ==================================================================== */
//
// ⚠️ Ye hissa sabse zaroori hai. Wizard ka UI browser me hi dikhta hai, par uska
// **dimaag** yahin hai — draft se doc tak ka poora raasta. Use sirf haath se
// chala kar dekhna matlab har badlav ke baad 8 scene ka wizard dobara bharna,
// aur wo koi nahi karta. Isliye wo raasta yahan chalta hai.

console.log("\napplyWizard");

const project = createEmptyProject({ name: "Wizard check" });

/** AI jaisa script — wahi lines jo asli kahani me hain. */
const script: AiScript = {
  summary: "Papa ke documents",
  scenes: [
    { type: "image_audio", name: "Hook", durationSeconds: 4, slots: { caption: "Beta... license expire ho gaya." }, reason: "" },
    { type: "image_audio", name: "Papa", durationSeconds: 4, slots: { caption: "Papa ki awaaz thodi dheemi thi." }, reason: "" },
    { type: "image_audio", name: "Yaad", durationSeconds: 5, slots: { caption: "Jinhone humari har date yaad rakhi... unki ek date main bhool gaya." }, reason: "" },
    { type: "cta", name: "CTA", durationSeconds: 3, slots: { text: "Apka Saathi." }, reason: "" },
  ],
};

let draft = draftFromScript(script);

check("draft me chaar scene aaye", draft.scenes.length === 4);
check(
  "text sahi slot se nikla (image_audio ka caption, cta ka text)",
  draft.scenes[0]?.text === "Beta... license expire ho gaya." && draft.scenes[3]?.text === "Apka Saathi.",
  "slot ka id scene type ke hisaab se badalta hai — naam se dhoondhne par ek jagah khaali reh jaata",
);

// Aadmi ne pehle do par tasveer di, teesre par nahi. Teesre par awaaz hai.
draft = {
  ...draft,
  scenes: draft.scenes.map((s, i) =>
    i === 0 || i === 1
      ? { ...s, imageAssetId: `as_img_${i}`, voiceAssetId: `as_voice_${i}`, voiceForText: s.text }
      : i === 2
        ? { ...s, voiceAssetId: "as_voice_2", voiceForText: s.text }
        : s,
  ),
};

check(
  "tasveer chhodi par awaaz hai → text_audio",
  effectiveType(draft.scenes[2]!) === "text_audio",
  "seedha `text` par girne par awaaz CHUP-CHAAP gayab ho jaati — us type me audio slot hai hi nahi",
);
check("tasveer hai → type wahi rehta", effectiveType(draft.scenes[0]!) === "image_audio");

/* ------------------------------------------------------------- autoFill */

const filled = autoFill(draft);
check("auto-fill ne har scene ko transition diya", filled.scenes.every((s) => s.transitionId !== null));
check("pehle scene ka transition none", filled.scenes[0]?.transitionId === "none");
check(
  "bina tasveer wale scene par animation nahi",
  filled.scenes[2]?.animationPresetId === null,
  "warna wo TEXT par lag jaata",
);

const handPicked = {
  ...filled,
  scenes: filled.scenes.map((s, i) => (i === 0 ? { ...s, animationPresetId: "focus-pull" } : s)),
};
const refilled = autoFill(handPicked);
check(
  "auto-fill aadmi ka chuna hua kabhi nahi badalta",
  refilled.scenes[0]?.animationPresetId === "focus-pull",
  "20 minute ka kaam ek button se mit jaana wo galti hai jiske baad aadmi tool ke paas dobara nahi aata",
);

/* ------------------------------------------------------------- voiceStale */

check("awaaz taaza hai to nishaan nahi", !voiceStale(filled.scenes[0]!));
check(
  "text badla to awaaz par nishaan",
  voiceStale({ ...filled.scenes[0]!, text: "kuch aur likh diya" }),
);
check(
  "sirf space badalne par jhoothi chetavni nahi",
  !voiceStale({ ...filled.scenes[0]!, text: `  ${filled.scenes[0]!.text}\n` }),
);

/* ----------------------------------------------------------------- apply */

const out = applyWizard({ doc: project, draft: filled });

check("chaaron scene bane", out.applied === 4, `applied=${out.applied} skipped=${out.skipped.length}`);
check("doc me chaar scene hain", out.doc.scenes.length === 4);

const madeScenes = [...out.doc.scenes].sort((a, b) => a.order - b.order);
const firstItem = primarySceneItem(out.doc, madeScenes[0]!.id);

check("pehle scene ki tasvear asli asset id se lagi", firstItem?.assetId === "as_img_0", String(firstItem?.assetId));
check(
  "pehle scene par animation lagi",
  (firstItem?.animations.length ?? 0) > 0,
  `${firstItem?.animations.length ?? 0} animation`,
);
/*
 * ⚠️ Yahan `!transitionIn` likhna galat tha, aur wo galti khud is jaanch ne
 * pakdi: har naye item par `transitionIn` **hota hai**, bas uska type `"none"`
 * hota hai (`{type:"none", durationInFrames:0}`). Maujoodgi dekhne wali jaanch
 * hamesha fail hoti, aur uska ilaaj "assertion hata do" jaisa kuch hota — jiske
 * baad ye asli halat kabhi jaanchi hi na jaati.
 */
check(
  "pehle scene par koi transition nahi lagi (wo pehla hai)",
  firstItem?.transitionIn?.type === "none",
  `pehla scene kahin SE aa hi nahi raha — mila: ${String(firstItem?.transitionIn?.type)}`,
);

const secondItem = primarySceneItem(out.doc, madeScenes[1]!.id);
check(
  "doosre scene par transition laga",
  secondItem?.transitionIn?.type === "crossfade",
  String(secondItem?.transitionIn?.type),
);

/*
 * ⚠️ Ye jaanch us galti ke liye hai jo sabse chup-chaap hoti: awaaz ki asset id
 * slot me pahunchi ya nahi. Na pahunche to scene phir bhi banta hai, text bhi
 * dikhta hai — bas reel gungi ho jaati hai.
 */
const audioItems = out.doc.items.filter((item) => item.type === "audio");
check(
  "teeno awaaz asli asset id ke saath lagi",
  audioItems.length === 3 && audioItems.every((item) => String(item.assetId).startsWith("as_voice_")),
  audioItems.map((item) => String(item.assetId)).join(", "),
);

check(
  "hataye hue scene nahi bante",
  applyWizard({
    doc: project,
    draft: { ...filled, scenes: filled.scenes.map((s, i) => (i === 1 ? { ...s, removed: true } : s)) },
  }).applied === 3,
);

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
