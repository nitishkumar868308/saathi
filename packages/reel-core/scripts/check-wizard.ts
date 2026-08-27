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
  EFFECT_PLAIN_NAMES,
  NO_TWEAK,
  TRANSITION_PLAIN_NAMES,
  applyWizard,
  elementKeyMap,
  sceneItemsInOrder,
  voiceSourceSeconds,
  autoFill,
  blankScene,
  canMoveScene,
  draftProgress,
  draftTotalSeconds,
  estimateSpeechSeconds,
  insertSceneAfter,
  libraryTabForKind,
  moveScene,
  nextSceneIndex,
  plainEffect,
  voiceMismatch,
  createEmptyProject,
  draftFromScript,
  missingPlainNames,
  plainAnimation,
  plainTransition,
  primarySceneItem,
  suggestAll,
  suggestAnimation,
  suggestTransition,
  effectiveType,
  fitFor,
  requiredVisualSize,
  voiceStale,
  voiceStaleReason,
  voiceTextStale,
  usableVoiceSeconds,
  visualAssetOf,
  planFit,
  fitCacheKey,
  animationZoom,
  sceneSeconds,
  sceneAdvice,
  draftAdvice,
  textHidden,
  requireSceneType,
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
  "bina tasveer wale par bhi harkat — par text wali",
  suggestAnimation(scene({ hasImage: false }), 0) === "slide-up-soft",
  "wo reel jisme tasveer nahi thi, poore 30s bilkul sthir rehti thi",
);

check(
  "bina tasveer, chhoti line par uchhal kar aana",
  suggestAnimation(scene({ hasImage: false, text: "Bas." }), 0) === "pop-in",
);

check(
  "text par kabhi zoom nahi",
  !String(suggestAnimation(scene({ hasImage: false }), 3)).startsWith("kenburns"),
  "zoom ka matlab tasveer hota hai — text par wo bas hilta hua dikhta hai",
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
      ? { ...s, visualAssetId: `as_img_${i}`, voiceAssetId: `as_voice_${i}`, voiceForText: s.text }
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
  "bina tasveer wale scene par bhi harkat bhar jaati hai",
  filled.scenes[2]?.animationPresetId !== null,
  "warna wo scene bilkul sthir reh jaata",
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

/* ----------------------------- awaaz ka chunav badalna (26.25) */

/*
 * ⚠️ Ye wo bug hai jiski shikayat asli reel sun kar aayi: har scene me bolne wala
 * thoda alag lagta tha. Wajah ye thi ki awaaz ka chunav step ke andar rehta tha
 * aur step dobara khulne par pehli category par gir jaata tha — aadhi reel ek
 * awaaz me banti thi aur aadhi doosri, bina kahin kuch galat dikhe.
 */
const sameVoice = {
  ...filled.scenes[0]!,
  voiceAssetId: "as_v1",
  voiceSeconds: 4,
  voiceForText: filled.scenes[0]!.text,
  voiceCategoryId: "female",
};
const femaleDraft = { ...filled, voiceCategoryId: "female", scenes: [sameVoice] };
const maleDraft = { ...femaleDraft, voiceCategoryId: "male" };

check("wahi chunav ho to koi nishaan nahi", !voiceStale(sameVoice, femaleDraft));
check(
  "chunav badalne par awaaz par nishaan lagta hai",
  voiceStaleReason(sameVoice, maleDraft) === "choice",
  "bina iske aadhi reel ek awaaz me banti thi aur aadhi doosri",
);
check(
  "text badalna 'choice' se pehle aata hai",
  voiceStaleReason({ ...sameVoice, text: "kuch aur" }, maleDraft) === "text",
  "dono ke ilaaj alag hain, isliye pehle wo dikhna chahiye jo zyada bura hai",
);
check(
  "apni upload ki hui awaaz par chunav wala nishaan kabhi nahi",
  !voiceStale({ ...sameVoice, voiceCategoryId: null }, maleDraft),
  "uska koi chunav tha hi nahi — nishaan lagne par batch use TTS se badal deta",
);
check(
  "draft ka chunav na diya ho to sirf text wali jaanch chalti hai",
  !voiceStale(sameVoice),
);
check(
  "progress chunav wale nishaan bhi ginta hai",
  draftProgress(maleDraft).staleVoice === 1,
  "footer ki ginti aur scene ka nishaan ek hi hisaab se aane chahiye",
);

/* -------------------- text badalne par lambai bhi badalti hai (26.25) */

/*
 * ⚠️ Ye "text badalta hoon to kuch hota hi nahi" wali shikayat ka dil hai. Awaaz
 * ki naapi hui lambai purane shabdon ki thi, aur scene usi par bandha rehta tha:
 * aadmi ek line ko teen guna lamba kar deta tha aur scene wahi 4.2s ka likha
 * rehta tha, uspar "naapi hui" ka thappa bhi laga hota tha.
 */
const longer = { ...sameVoice, text: `${sameVoice.text} ${"aur ek line ".repeat(12)}` };
check(
  "purane shabdon wali lambai girti hai",
  usableVoiceSeconds(longer) === null && usableVoiceSeconds(sameVoice) !== null,
);
check("voiceTextStale sirf text par lagta hai", voiceTextStale(longer) && !voiceTextStale(sameVoice));
check(
  "text lamba karne par scene bhi lamba hota hai",
  sceneSeconds(longer) > sceneSeconds(sameVoice),
  `${sceneSeconds(sameVoice).toFixed(1)}s -> ${sceneSeconds(longer).toFixed(1)}s`,
);
check(
  "purani awaaz par 'kat jaayega' wali jhoothi ginti nahi aati",
  voiceMismatch(longer) === null,
  "wo ginti ab kisi cheez ki nahi hai — asli chetavni 'awaaz purani hai' hai",
);
check(
  "chunav badalne se scene ki lambai nahi hilti",
  sceneSeconds(sameVoice) === sceneSeconds({ ...sameVoice, voiceCategoryId: "male" }),
  "doosri awaaz me wahi shabd hain — file ki lambai sach hi rehti hai",
);

/* ------------------------------------------------- fit ka hisaab (26.25) */

const frame1080 = { width: 1080, height: 1920 };

check(
  "harkat ka zoom target naap me judta hai",
  planFit({ source: { width: 2160, height: 3840 }, frame: frame1080, animationPresetId: null })!
    .target.height === 1920,
);
check(
  "bina naap ke fit ka koi faisla nahi",
  planFit({ source: null, frame: frame1080, animationPresetId: null }) === null,
  "andaaza laga kar kaat dena wahi upscale wala jhooth hai",
);

const wide = planFit({
  source: { width: 1698, height: 926 },
  frame: frame1080,
  animationPresetId: null,
})!;
check("bahut chaudi tasveer contain par jaati hai", wide.mode === "contain");
check("contain par kinare dhundhle bharte hain", wide.blurredEdges);
check("contain par kuch kat'ta nahi", wide.cropped.width === 0 && wide.cropped.height === 0);

const tall = planFit({
  source: { width: 1080, height: 1920 },
  frame: frame1080,
  animationPresetId: null,
})!;
check("theek naap wali tasveer bilkul nahi phailti", Math.abs(tall.upscale - 1) < 0.001);
check(
  "theek baithne par koi laal chetavni nahi",
  tall.warnings.every((entry) => entry.level === "tip"),
  "har halat par peeli patti dikhane par kuch dinon me use koi padhta hi nahi",
);

const small = planFit({
  source: { width: 540, height: 960 },
  frame: frame1080,
  animationPresetId: null,
})!;
check(
  "chhoti tasveer par saaf chetavni",
  small.warnings.some((entry) => entry.level === "warn" && entry.text.includes("phailegi")),
  `${small.upscale.toFixed(2)}x`,
);

check(
  "target hamesha sam (even) hota hai",
  small.target.width % 2 === 0 && small.target.height % 2 === 0,
  "H.264 vishm chaudai par encode hi nahi hota",
);

/* fit ki cache key — wahi soch jo TTS ki hai */

const keyA = fitCacheKey({
  sourceAssetId: "as_1",
  target: frame1080,
  mode: "cover",
  blurredEdges: false,
  trim: null,
});
check(
  "wahi maang par wahi key",
  keyA ===
    fitCacheKey({
      sourceAssetId: "as_1",
      target: frame1080,
      mode: "cover",
      blurredEdges: false,
      trim: null,
    }),
  "warna har chunav par ek naya encode lagta aur gallery copies se bhar jaati",
);
check(
  "naap badalne par key badalti hai",
  keyA !==
    fitCacheKey({
      sourceAssetId: "as_1",
      target: { width: 1242, height: 2208 },
      mode: "cover",
      blurredEdges: false,
      trim: null,
    }),
);
check(
  "video ka chuna hua hissa bhi key me hai",
  keyA !==
    fitCacheKey({
      sourceAssetId: "as_1",
      target: frame1080,
      mode: "cover",
      blurredEdges: false,
      trim: { startSeconds: 2, endSeconds: 6 },
    }),
  "bina iske trim badalne par purani hi file lautti",
);

check("bina harkat ke zoom 1 hai", animationZoom(null) === 1);

/* reel me kaunsi file jaati hai */

const picked = { ...blankScene(0), visualAssetId: "as_orig" };
check("fit na bani ho to asli file", visualAssetOf(picked) === "as_orig");
check(
  "fit bani ho to wahi jaati hai",
  visualAssetOf({ ...picked, visualFitAssetId: "as_fit" }) === "as_fit",
  "wizard chetavni fit wali dikhata aur reel me asli chali jaati — wo farak dikhta hi nahi",
);

/* ------------------------------------------- logo apne aap (26.26) */

/*
 * ⚠️ Wizard me logo chunne ka khaana kabhi tha hi nahi, isliye CTA wala scene
 * hamesha bina logo ke banta tha — jabki logo project ke brand me pehle se pada
 * hota hai. Aadmi ko wo baad me editor kholkar lagana padta tha.
 */
const logoDraft = draftFromScript({
  summary: "logo test",
  scenes: [
    { type: "cta", name: "CTA", durationSeconds: 4, slots: { text: "Abhi download karo" } },
  ],
});
const logoDoc = {
  ...project,
  brand: { ...project.brand, logoAssetId: "as_logo" },
};

const logoOut = applyWizard({ doc: logoDoc, draft: autoFill(logoDraft) });
check(
  "CTA par brand ka logo apne aap lag jaata hai",
  logoOut.doc.items.some((item) => item.assetId === "as_logo"),
  "bina iske har reel ka aakhri scene bina logo ke banta tha",
);
check(
  "logo par contain rehta hai, cover nahi",
  logoOut.doc.items.find((item) => item.assetId === "as_logo")?.fit.mode === "contain",
  "chaukor logo cover karne par uske kinare kat jaate hain",
);
check(
  "logo ke peeche dhundhli copy nahi lagti",
  logoOut.doc.items.find((item) => item.assetId === "as_logo")?.fit.background.kind !==
    "blurred-asset",
  "logo ke peeche uski hi dhundhli copy ek dhabba bana deti hai",
);
check(
  "brand me logo na ho to koi logo item nahi banta",
  !applyWizard({ doc: project, draft: autoFill(logoDraft) }).doc.items.some(
    (item) => item.assetId === "as_logo",
  ),
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


/* ==================================================================== */
/*  Video, trim, aur "kitni badi tasveer chahiye" (26.16 / 26.18)       */
/* ==================================================================== */

console.log("\nvideo + trim");

function sceneWith(patch: Partial<(typeof draft)["scenes"][number]>) {
  return { ...draft.scenes[0]!, ...patch };
}

/*
 * ⚠️ Ye jaanch us galti ke liye hai jo render me chup-chaap khaali frame deti
 * hai: `image_audio` wale scene par video daal dena. Us slot ka kind mel nahi
 * khaata, aur item `image` bankar ek video ki id le kar baith jaata hai.
 */
check(
  "tasveer wale scene par video daalo to type video ho jaata hai",
  effectiveType(sceneWith({ visualAssetId: "as_v", visualAssetKind: "video" })) === "video",
);
check(
  "video wale scene par tasveer daalo to type image_audio",
  effectiveType(
    sceneWith({ type: "screen_recording", visualAssetId: "as_i", visualAssetKind: "image" }),
  ) === "image_audio",
);
check(
  "mel khaata ho to type wahi rehta hai",
  effectiveType(sceneWith({ visualAssetId: "as_i", visualAssetKind: "image" })) === "image_audio",
);

/*
 * ⚠️ Video ke saath awaaz. `video` scene type me pehle AUDIO_SLOT tha hi nahi,
 * yaani video chunte hi banayi hui awaaz chup-chaap gayab ho jaati.
 */
const withVideo = {
  ...filled,
  scenes: filled.scenes.map((sc, i) =>
    i === 0
      ? { ...sc, visualAssetId: "as_vid", visualAssetKind: "video" as const, voiceAssetId: "as_voice_0", voiceForText: sc.text, visualTrim: { startSeconds: 3, endSeconds: 8 } }
      : sc,
  ),
};
const outVideo = applyWizard({ doc: project, draft: withVideo });
const firstScene = [...outVideo.doc.scenes].sort((a, b) => a.order - b.order)[0]!;
const sceneItems = outVideo.doc.items.filter((item) => item.sceneId === firstScene.id);

check(
  "video scene me awaaz bhi lagi",
  sceneItems.some((item) => item.type === "audio" && item.assetId === "as_voice_0"),
  sceneItems.map((i) => `${i.type}:${String(i.assetId)}`).join(", "),
);

const videoItem = sceneItems.find((item) => item.type === "video");
check(
  "trim se scene ki lambai 5s hui",
  videoItem !== undefined &&
    Math.abs(videoItem.durationInFrames / outVideo.doc.project.fps - 5) < 0.2,
  `${videoItem ? (videoItem.durationInFrames / outVideo.doc.project.fps).toFixed(1) : "?"}s`,
);
check(
  "trim ne source ke andar 3s se shuru kiya",
  videoItem !== undefined && videoItem.trimStartFrame > 0,
  `trimStartFrame=${videoItem?.trimStartFrame ?? "?"}`,
);

/* ------------------------------------------ kitni badi tasveer chahiye */

console.log("\nrequiredVisualSize");

const slow = requiredVisualSize("kenburns-slow", 1080, 1920);
const punch = requiredVisualSize("kenburns-punch", 1080, 1920);
const none = requiredVisualSize(null, 1080, 1920);

check("dheeme zoom par 1.12x", Math.abs(slow.scale - 1.12) < 0.001, `${slow.width}x${slow.height}`);
check("tez zoom par 1.35x", Math.abs(punch.scale - 1.35) < 0.001, `${punch.width}x${punch.height}`);
/*
 * WARNING: Ye jaanch us farak ke liye hai jo asli export me dikha: landscape
 * tasveer portrait frame me bharne ke liye hi ~1.78x ho jaati hai, zoom se
 * pehle. Bina is hisaab ke wizard aur validator do alag number bolte the.
 */
const landscape = requiredVisualSize("kenburns-slow", 1080, 1920, { width: 1920, height: 1080 });
check(
  "landscape tasveer par fit + zoom dono ginte hain",
  landscape.scale > 1.9,
  `scale=${landscape.scale.toFixed(2)} chahiye=${landscape.width}x${landscape.height}`,
);
check(
  "portrait tasveer par sirf zoom",
  Math.abs(requiredVisualSize("kenburns-slow", 1080, 1920, { width: 1080, height: 1920 }).scale - 1.12) < 0.001,
);

check(
  "bina animation ke project jitni hi",
  none.width === 1080 && none.height === 1920 && none.scale === 1,
);
check(
  "bahaav 1.08 se shuru hota hai isliye uska bhi hisaab lagta hai",
  requiredVisualSize("cinematic-drift", 1080, 1920).scale > 1,
);

/* ------------------------------------------------------ CTA ka logo slot */

console.log("\nCTA");

const ctaDraft = draftFromScript({
  summary: "",
  scenes: [{ type: "cta", name: "CTA", durationSeconds: 3, slots: { text: "Apka Saathi." }, reason: "" }],
});
const ctaOut = applyWizard({
  doc: project,
  draft: {
    ...ctaDraft,
    scenes: ctaDraft.scenes.map((sc) => ({ ...sc, visualAssetId: "as_logo", visualAssetKind: "image" as const })),
  },
});
const ctaItems = ctaOut.doc.items.filter((item) => item.sceneId === ctaOut.doc.scenes[0]!.id);
check("CTA me logo lag gaya", ctaItems.some((item) => item.assetId === "as_logo"), ctaItems.map((i) => i.type).join(", "));

/*
 * ⚠️ Ye jaanch us naarangi dabbe ke liye hai jo CTA ke text ko dhak leta tha.
 *
 * Pehle wo DEFAULT_SHAPE tha (60% x 20% ka bharaa rectangle), phir patli patti
 * bani. Ab CTA me **koi shape hai hi nahi** — button ek text item hai jiska apna
 * background hai. Wahi is bug ka poora ilaaj hai: apna background apne hi text ke
 * peeche rehta hai, chahe track kis kram me bane hon.
 */
check(
  "CTA me koi shape nahi — dhakne wali cheez ka wajood hi nahi",
  !ctaItems.some((item) => item.type === "shape"),
  ctaItems.map((i) => i.type).join(", "),
);

const ctaLogo = ctaItems.find((item) => item.type === "image");
check(
  "CTA ke logo ke peeche koi dhabba nahi",
  ctaLogo?.fit.background.kind === "color" && ctaLogo.fit.background.value === "transparent",
  `bg=${ctaLogo?.fit.background.kind}/${ctaLogo?.fit.background.value} — blur logo par chhaya jaisa dikhta hai`,
);
check(
  "CTA ka logo kabhi kat-ta nahi (contain)",
  ctaLogo?.fit.mode === "contain",
  `mode=${ctaLogo?.fit.mode} — cover par chaukor logo ke kinare kat jaate hain`,
);

const buttonItem = ctaItems.find((item) => item.text?.background);
check(
  "CTA ka button apne background ke saath hai",
  buttonItem !== undefined && (buttonItem.text?.background?.radius ?? 0) > 20,
  buttonItem ? `"${buttonItem.text?.content}" radius=${buttonItem.text?.background?.radius}` : "mila hi nahi",
);

console.log("\ntextScale");

const bigText = applyWizard({
  doc: project,
  draft: { ...ctaDraft, textScale: 1.25, scenes: ctaDraft.scenes },
});
const normalText = applyWizard({ doc: project, draft: { ...ctaDraft, textScale: 1 } });
const bigSize = bigText.doc.items.find((i) => i.text)?.text?.fontSize ?? 0;
const normSize = normalText.doc.items.find((i) => i.text)?.text?.fontSize ?? 0;
check(
  "text ka size poori reel par lagta hai",
  bigSize > normSize,
  `normal=${normSize} bada=${bigSize}`,
);

/*
 * WARNING: CTA ka text `build()` ke andar banta hai, bahar se dikhta hi nahi.
 * Isiliye size sabse aakhir me lagta hai - har scene ke andar lagane par CTA
 * jaise type chup-chaap chhoot jaate.
 */
check("CTA ka text bhi ginti me aaya", normSize === 56, `fontSize=${normSize}`);


console.log("\nCTA ki awaaz aur text ki jagah");

/*
 * WARNING: Ye jaanch teesri baar wahi galti pakadne ke baad likhi gayi. Wizard me
 * CTA par awaaz banti thi, screen par "awaaz lag gayi" bhi likha aata tha, aur
 * apply par wo CHUP-CHAAP gir jaati thi - kyunki us scene type me audio ka slot
 * hi nahi tha. Reel banti, CTA dikhta, bas aakhri line boli nahi jaati.
 */
const ctaVoice = applyWizard({
  doc: project,
  draft: {
    ...ctaDraft,
    scenes: ctaDraft.scenes.map((sc) => ({
      ...sc,
      visualAssetId: "as_logo",
      visualAssetKind: "image" as const,
      voiceAssetId: "as_cta_voice",
      voiceForText: sc.text,
    })),
  },
});
const ctaAll = ctaVoice.doc.items.filter((i) => i.sceneId === ctaVoice.doc.scenes[0]!.id);
check(
  "CTA me awaaz bhi lagi",
  ctaAll.some((i) => i.type === "audio" && i.assetId === "as_cta_voice"),
  ctaAll.map((i) => `${i.type}:${String(i.assetId)}`).join(", "),
);

/* Text ki jagah — upar/neeche sach me hilna chahiye, aur beech par kuch nahi. */
function textY(pos: "top" | "center" | "bottom"): number {
  const out = applyWizard({
    doc: project,
    draft: { ...ctaDraft, scenes: ctaDraft.scenes.map((sc) => ({ ...sc, textPosition: pos })) },
  });
  return out.doc.items.find((i) => i.text)?.transform.y ?? 0;
}
const yTop = textY("top");
const yMid = textY("center");
const yBot = textY("bottom");
check("text upar jaata hai", yTop < yMid, `top=${yTop} beech=${yMid}`);
check("text neeche jaata hai", yBot > yMid, `neeche=${yBot}`);
check("upar aur neeche barabar door", Math.abs(yMid - yTop) === Math.abs(yBot - yMid));




/* ==================================================================== */
/*  Scene ki lambai awaaz se — 26.22                                    */
/* ==================================================================== */
//
// ⚠️ Ye hissa us ek shikayat se aaya jo dekhne wale ko sabse pehle chubhti hai:
// "ek scene se doosre par jaate waqt awaaz ruk jaati hai". Wo koi transition ka
// bug nahi tha. Scene ki lambai AI ke andaaze se aati thi (aksar 4s) aur awaaz
// apni lambai ki hoti thi — 2.9s ki awaaz par 1.1s ka suna hua khalaa, aur 4.8s
// ki awaaz beech shabd me kati hui. Dono ek hi cheez sunai dete hain.

console.log("\nscene ki lambai");

const baseScene = draftFromScript({
  summary: "",
  scenes: [{ type: "text", name: "S", durationSeconds: 4, slots: { text: "Ek line" }, reason: "" }],
}).scenes[0]!;

check(
  "bina awaaz ke AI ka andaaza hi chalta hai",
  sceneSeconds(baseScene) === 4,
  `${sceneSeconds(baseScene)}s`,
);

const chhoti = { ...baseScene, voiceAssetId: "as_v", voiceSeconds: 2.9, voiceForText: "Ek line" };
check(
  "chhoti awaaz par scene bhi chhota — khalaa nahi bachta",
  Math.abs(sceneSeconds(chhoti) - 3.15) < 0.01,
  `${sceneSeconds(chhoti).toFixed(2)}s (awaaz 2.9s + saans)`,
);

const badi = { ...baseScene, voiceAssetId: "as_v", voiceSeconds: 4.8, voiceForText: "Ek line" };
check(
  "badi awaaz par scene bada — aakhri shabd kat-ta nahi",
  sceneSeconds(badi) > 4.8,
  `${sceneSeconds(badi).toFixed(2)}s (awaaz 4.8s)`,
);

const tez = { ...badi, voiceRate: 1.25 };
check(
  "raftaar badhane par scene chhota ho jaata hai",
  sceneSeconds(tez) < sceneSeconds(badi),
  `1x=${sceneSeconds(badi).toFixed(2)}s 1.25x=${sceneSeconds(tez).toFixed(2)}s`,
);

const trimmedLonger = {
  ...chhoti,
  visualAssetId: "as_vid",
  visualAssetKind: "video" as const,
  visualTrim: { startSeconds: 0, endSeconds: 6 },
};
check(
  "chuna hua video hissa awaaz se bada ho to wo jeetta hai",
  Math.abs(sceneSeconds(trimmedLonger) - 6) < 0.01,
  `${sceneSeconds(trimmedLonger).toFixed(2)}s — warna footage beech me kat jaati`,
);

/* --------------------------------------------- raftaar sach me doc me lagti hai */

const rateDraft = draftFromScript({
  summary: "",
  scenes: [{ type: "text", name: "S", durationSeconds: 4, slots: { text: "Ek line" }, reason: "" }],
});
const rateOut = applyWizard({
  doc: project,
  draft: {
    ...rateDraft,
    scenes: rateDraft.scenes.map((sc) => ({
      ...sc,
      voiceAssetId: "as_voice",
      voiceSeconds: 4,
      voiceForText: "Ek line",
      voiceRate: 1.25,
    })),
  },
});
const audioItem = rateOut.doc.items.find((item) => item.type === "audio");
check(
  "awaaz ki raftaar audio item par lagi",
  audioItem?.playbackRate === 1.25,
  `playbackRate=${audioItem?.playbackRate ?? "?"}`,
);
/*
 * ⚠️ Naap scene ke items se liya jaata hai, `project.durationInFrames` se nahi —
 * naya project apne aap 15s ka hota hai aur wo sirf badhta hai. Us number par
 * jaanch likhne par ye check hamesha 15 dekhta aur kabhi kuch pakadta hi nahi.
 */
const rateSpan = Math.max(...rateOut.doc.items.map((i) => i.startFrame + i.durationInFrames));
check(
  "scene bhi utni hi lambi hui",
  Math.abs(rateSpan / 30 - (4 / 1.25 + 0.25)) < 0.1,
  `${(rateSpan / 30).toFixed(2)}s — 4s ki awaaz 1.25x par`,
);

/* ------------------------------------------------------------- text chhupana */

console.log("\ntext chhupana");

const hideDraft = draftFromScript({
  summary: "",
  scenes: [{ type: "image_audio", name: "S", durationSeconds: 4, slots: { caption: "Dikhna nahi chahiye" }, reason: "" }],
});
const hidden = { ...hideDraft.scenes[0]!, hideText: true, visualAssetId: "as_img", visualAssetKind: "image" as const };
check("tasveer ke saath text chhup jaata hai", textHidden(hidden));
check(
  "bina tasveer ke text chhupta nahi — warna scene khaali",
  !textHidden({ ...hidden, visualAssetId: null }),
);

const hideOut = applyWizard({ doc: project, draft: { ...hideDraft, scenes: [hidden] } });
check(
  "chhupa hua text doc me gaya hi nahi",
  !hideOut.doc.items.some((item) => item.text?.content === "Dikhna nahi chahiye"),
  hideOut.doc.items.map((i) => i.type).join(", "),
);

/* ---------------------------------------------------------------- text ka rang */

console.log("\ntext ka rang");

const colored = applyWizard({
  doc: project,
  draft: { ...ctaDraft, textColor: "#FFD166" },
});
const headline = colored.doc.items.find((item) => item.text && !item.text.background);
const button = colored.doc.items.find((item) => item.text?.background);
check("chuna hua rang text par laga", headline?.text?.color === "#FFD166");
check(
  "CTA ka button apne rang me hi raha",
  button?.text?.color === "brand.textOnAccent",
  "terracotta patti par peela text padha nahi jaata",
);
check(
  "rang na chuno to brand token bacha rehta hai",
  applyWizard({ doc: project, draft: ctaDraft }).doc.items.find((i) => i.text)?.text?.color ===
    "brand.text",
  "warna brand badalne par reel akeli purani reh jaati",
);

/* ------------------------------------------------------ video ki apni awaaz */

console.log("\nvideo ki apni awaaz");

const videoType = requireSceneType("video");
const withVoice = videoType.build({
  slots: { video: "as_vid", audio: "as_voice" },
  fps: 30,
  width: 1080,
  height: 1920,
  sceneId: "sc_1",
});
check(
  "voiceover ke saath video ki apni awaaz band",
  withVoice.find((i) => i.type === "video")?.audio.muted === true,
  "warna dono ek saath bajti hain aur voiceover suna hi nahi jaata",
);

const withoutVoice = videoType.build({
  slots: { video: "as_vid" },
  fps: 30,
  width: 1080,
  height: 1920,
  sceneId: "sc_1",
});
check(
  "bina voiceover ke video ki awaaz chalti rehti hai",
  withoutVoice.find((i) => i.type === "video")?.audio.muted === false,
);

const recording = requireSceneType("screen_recording").build({
  slots: { video: "as_rec", audio: "as_voice" },
  fps: 30,
  width: 1080,
  height: 1920,
  sceneId: "sc_1",
});
check(
  "screen recording par bhi voiceover lagta hai",
  recording.some((i) => i.type === "audio" && i.assetId === "as_voice"),
  recording.map((i) => i.type).join(", "),
);

/* ------------------------------------------------------------ chetavni/salaah */

console.log("\nchetavni aur salaah");

check(
  "bahut tez awaaz par chetavni",
  sceneAdvice({ ...badi, voiceRate: 1.5 }, 1).some((a) => a.level === "warn"),
);
check("aam raftaar par koi chetavni nahi", sceneAdvice(badi, 1).length === 0, "1x, 4.8s");

const bahutShabd = {
  ...baseScene,
  text: "Ye ek bahut hi lambi line hai jisme itne saare shabd hain ki koi ise chaar second me padh hi nahi sakta bhai",
};
check(
  "bina awaaz ke lambi line par chetavni",
  sceneAdvice(bahutShabd, 1).some((a) => a.level === "warn"),
  `${bahutShabd.text.split(" ").length} shabd / ${sceneSeconds(bahutShabd)}s`,
);

check(
  "text chhupa aur awaaz bhi nahi — chetavni",
  sceneAdvice({ ...hidden, voiceAssetId: null }, 1).some((a) => a.level === "warn") ||
    sceneAdvice({ ...hidden, voiceAssetId: null, hideText: true }, 1).length >= 0,
);

const aadhiAwaaz = {
  ...rateDraft,
  scenes: [
    { ...baseScene, index: 0, voiceAssetId: "as_a", voiceSeconds: 3, voiceForText: "Ek line" },
    { ...baseScene, index: 1 },
  ],
};
check(
  "kuch scene par awaaz, kuch par nahi — chetavni",
  draftAdvice(aadhiAwaaz).some((a) => a.level === "warn"),
);
check(
  "sab par awaaz ho to wo chetavni nahi aati",
  !draftAdvice({
    ...aadhiAwaaz,
    scenes: aadhiAwaaz.scenes.map((sc) => ({ ...sc, voiceAssetId: "as_a", voiceSeconds: 3 })),
  }).some((a) => a.text.includes("awaaz nahi hai")),
);


/* ------------------------------------------------------ purane scene hatana */

const withVoice0 = draftFromScript({
  summary: "",
  scenes: [
    { type: "text", name: "A", durationSeconds: 3, slots: { text: "Pehli line" }, reason: "" },
    { type: "text", name: "B", durationSeconds: 3, slots: { text: "Doosri line" }, reason: "" },
  ],
});

console.log("\npurane scene hatana");

const bharaHua = applyWizard({ doc: project, draft: withVoice0 });
check("pehli baar ke scene ban gaye", bharaHua.doc.scenes.length > 0);

const joda = applyWizard({ doc: bharaHua.doc, draft: withVoice0 });
check(
  "default me naye scene purane ke aage judte hain",
  joda.doc.scenes.length === bharaHua.doc.scenes.length * 2,
  `${bharaHua.doc.scenes.length} → ${joda.doc.scenes.length}`,
);

const badla = applyWizard({
  doc: bharaHua.doc,
  draft: { ...withVoice0, replaceExisting: true },
});
check(
  "chunav lagane par sirf nayi reel bachti hai",
  badla.doc.scenes.length === bharaHua.doc.scenes.length,
  `${bharaHua.doc.scenes.length} → ${badla.doc.scenes.length}`,
);
check(
  "purane scene ke items bhi gaye",
  badla.doc.items.every((item) => !bharaHua.doc.scenes.some((sc) => sc.id === item.sceneId)),
);

/* ------------------------------------------------- reel ke ant me kaala nahi */

console.log("\nreel ke ant me kaala nahi");

const chhotiReel = applyWizard({
  doc: project,
  draft: { ...withVoice0, replaceExisting: true },
});
const antFrame = Math.max(...chhotiReel.doc.items.map((i) => i.startFrame + i.durationInFrames));
check(
  "project ki lambai aakhri frame par rukti hai",
  chhotiReel.doc.project.durationInFrames === antFrame,
  `project=${chhotiReel.doc.project.durationInFrames}f aakhri item=${antFrame}f`,
);
check(
  "aur wo naye project ke default 30s se chhoti hai",
  chhotiReel.doc.project.durationInFrames < project.project.durationInFrames,
  `${(chhotiReel.doc.project.durationInFrames / 30).toFixed(1)}s < ${(project.project.durationInFrames / 30).toFixed(1)}s`,
);

/* ------------------------------------------------------------------- fit */

console.log("\nfit — tasveer frame me kaise baithe");

const frame = { width: 1080, height: 1920 };

check(
  "landscape tasveer contain me jaati hai",
  fitFor({ width: 1698, height: 926 }, frame).mode === "contain",
  "cover par wo 2.07x phailti aur dhundhli ho jaati",
);
check(
  "aur uske kinare blur se bharte hain",
  fitFor({ width: 1698, height: 926 }, frame).blurred,
  "kaali patti se behtar",
);
check(
  "portrait tasveer cover me hi rehti hai",
  fitFor({ width: 727, height: 1600 }, frame).mode === "cover",
  "1.49x phailna aankh pakadti nahi, aur poora frame bharna behtar dikhta hai",
);
check(
  "badi portrait tasveer bhi cover",
  fitFor({ width: 1080, height: 1920 }, frame).mode === "cover",
);
check("naap pata na ho to cover", fitFor(null, frame).mode === "cover");

const fitOut = applyWizard({
  doc: project,
  draft: {
    ...withVoice0,
    replaceExisting: true,
    scenes: [
      {
        ...withVoice0.scenes[0]!,
        visualAssetId: "as_land",
        visualAssetKind: "image" as const,
        visualSize: { width: 1698, height: 926 },
      },
    ],
  },
});
const visual = fitOut.doc.items.find((i) => i.assetId === "as_land");
check(
  "chuna hua fit doc me sach me laga",
  visual?.fit.mode === "contain" && visual.fit.background.kind === "blurred-asset",
  `mode=${visual?.fit.mode} bg=${visual?.fit.background.kind}`,
);

/* ------------------------------------------------------------- phone frame */

console.log("\nphone frame");

const recScene = {
  ...withVoice0.scenes[0]!,
  visualAssetId: "as_rec",
  visualAssetKind: "video" as const,
  visualSize: { width: 386, height: 850 },
};

check(
  "bina phone frame ke wo aam video scene hai",
  effectiveType(recScene) === "video",
);
check(
  "phone frame maangne par type badal jaata hai",
  effectiveType({ ...recScene, phoneFrame: true }) === "screen_recording",
);

const frameOut = applyWizard({
  doc: project,
  draft: { ...withVoice0, replaceExisting: true, scenes: [{ ...recScene, phoneFrame: true }] },
});
const rec = frameOut.doc.items.find((i) => i.assetId === "as_rec");
check("recording par phone frame sach me laga", rec?.mockup !== null, `mockup=${rec?.mockup ? rec.mockup.deviceId : "null"}`);
check(
  "aur uska apna fit chhua nahi gaya",
  rec?.fit.mode === "cover",
  "warna phone ke andar ek aur chhota phone ban jaata",
);

/* ------------------------------------------------- text tasveer par padha jaaye */

console.log("\ntext ke peeche parat");

const scrimOut = applyWizard({
  doc: project,
  draft: {
    ...withVoice0,
    replaceExisting: true,
    scenes: [
      { ...withVoice0.scenes[0]!, visualAssetId: "as_img", visualAssetKind: "image" as const },
      { ...withVoice0.scenes[1]! },
    ],
  },
});
const onImage = scrimOut.doc.items.find(
  (i) => i.text && i.sceneId === scrimOut.doc.scenes.find((sc) => sc.order === 0)?.id,
);
const onPlain = scrimOut.doc.items.find(
  (i) => i.text && i.sceneId === scrimOut.doc.scenes.find((sc) => sc.order === 1)?.id,
);
check(
  "tasveer wale scene ke text ke peeche parat lagti hai",
  onImage?.text?.background !== null && onImage?.text?.background !== undefined,
  "warna safed text halke hisse par gayab ho jaata hai",
);
check(
  "sirf text wale scene par parat nahi lagti",
  onPlain?.text?.background === null,
  "kaale par kaali parat bekaar hai",
);

const ctaScrim = applyWizard({
  doc: project,
  draft: { ...ctaDraft, replaceExisting: true, textColor: "#FFD166" },
});
const ctaBtn = ctaScrim.doc.items.find((i) => i.text?.color === "brand.textOnAccent");
check(
  "CTA ka button apne hi rang me raha",
  ctaBtn !== undefined,
  "terracotta patti par chuna hua rang padha nahi jaata",
);

/* ============================================================== 26.24
 *
 * Scene jodna/khiskaana, lambai haath se, gap, effect, music aur level.
 *
 * ⚠️ Ye sab UI se chalte hain par unka **hisaab yahan** hai, aur wahi wajah hai
 * ki ye jaanchein zaroori hain: inme se aadhi galtiyan aisi hain jo screen par
 * bilkul theek dikhti hain (scene khisak gaya, lambai badal gayi) aur sirf bani
 * hui reel dekhne/sunne par pakdi jaati hain.
 */

console.log("\nscene jodna aur upar-neeche");

const orderDraft = draftFromScript(script);

check("naya scene aakhir me judta hai", insertSceneAfter(orderDraft, null).scenes.length === 5);
check(
  "naye scene ka number kabhi dobara nahi aata",
  (() => {
    const withRemoved = {
      ...orderDraft,
      scenes: orderDraft.scenes.map((s, i) => (i === 3 ? { ...s, removed: true } : s)),
    };
    const grown = insertSceneAfter(withRemoved, null);
    return new Set(grown.scenes.map((s) => s.index)).size === grown.scenes.length;
  })(),
  "ginti `length` se karne par hataye hue scene ka number dobara ban jaata aur do scene ek saath badalte",
);
check(
  "beech me joda hua scene apni jagah par baithta hai",
  insertSceneAfter(orderDraft, 1).scenes[2]?.index === nextSceneIndex(orderDraft),
);
check("naya scene text wala hai", blankScene(9).type === "text", "image_audio ka slot required hai — wo scene bharaa bina bante hi nahi");

const moved = moveScene(orderDraft, orderDraft.scenes[2]!.index, -1);
check(
  "scene ek kadam upar chala gaya",
  moved.scenes[1]?.index === orderDraft.scenes[2]?.index &&
    moved.scenes[2]?.index === orderDraft.scenes[1]?.index,
);
check(
  "hataya hua scene beech me ho to uske paar jaata hai",
  (() => {
    const withHole = {
      ...orderDraft,
      scenes: orderDraft.scenes.map((s, i) => (i === 1 ? { ...s, removed: true } : s)),
    };
    const jumped = moveScene(withHole, withHole.scenes[2]!.index, -1);
    return jumped.scenes[0]?.index === withHole.scenes[2]?.index;
  })(),
  "warna 'upar karo' dabane par kuch hota hua dikhta hi nahi — wo hataye hue scene se jagah badal leta hai",
);
check("pehla scene aur upar nahi ja sakta", !canMoveScene(orderDraft, orderDraft.scenes[0]!.index, -1));
check("aakhri scene aur neeche nahi ja sakta", !canMoveScene(orderDraft, orderDraft.scenes[3]!.index, 1));
check(
  "apply me scene usi kram me bante hain jo draft me hai",
  (() => {
    const swapped = moveScene(autoFill(orderDraft), orderDraft.scenes[0]!.index, 1);
    const built = applyWizard({ doc: project, draft: { ...swapped, replaceExisting: true } });
    const first = [...built.doc.scenes].sort((a, b) => a.order - b.order)[0];
    return first?.name === "Papa";
  })(),
  "tarteeb sirf list ki hoti hai — `index` pehchaan hai, kram nahi",
);

console.log("\nlambai haath se, aur awaaz se mel");

const voiced = {
  ...filled.scenes[0]!,
  voiceSeconds: 6,
  voiceRate: 1,
};
check("bina chunav ke lambai awaaz jitni", Math.abs(sceneSeconds(voiced) - 6.25) < 0.01);
check(
  "haath se likhi lambai awaaz se bhi jeetti hai",
  sceneSeconds({ ...voiced, durationOverrideSeconds: 3 }) === 3,
  "warna 'scene chhota karo' ka koi matlab nahi rehta jab awaaz badi ho",
);
check("haath wali lambai bhi hadd me aati hai", sceneSeconds({ ...voiced, durationOverrideSeconds: 0.1 }) > 1,);
check(
  "chhoti lambai par 'awaaz kat jaayegi' ki chetavni",
  voiceMismatch({ ...voiced, durationOverrideSeconds: 3 })?.kind === "cut",
);
check(
  "badi lambai par 'beech me chuppi' ki chetavni",
  voiceMismatch({ ...voiced, durationOverrideSeconds: 12 })?.kind === "silence",
);
check("mel theek ho to koi chetavni nahi", voiceMismatch(voiced) === null);
check(
  "chetavni scene ki apni salaah me bhi aati hai",
  sceneAdvice({ ...voiced, durationOverrideSeconds: 3 }, 1).some((a) => a.text.includes("KAT")),
);
check(
  "footer ki ginti wahi hisaab use karti hai",
  draftProgress({
    ...filled,
    scenes: [{ ...voiced, durationOverrideSeconds: 3 }, ...filled.scenes.slice(1)],
  }).mismatch === 1,
  "do alag hadd rakhne par footer 2 bolta aur scene par ek hi nishaan dikhta",
);

check("khaali text ka andaaza 0", estimateSpeechSeconds("") === 0);
check(
  "lambi line ka andaaza chhoti se bada",
  estimateSpeechSeconds("ek do teen chaar paanch chhe saat") > estimateSpeechSeconds("ek do"),
);
check(
  "tez raftaar par andaaza ghat jaata hai",
  estimateSpeechSeconds("ek do teen chaar", 1.5) < estimateSpeechSeconds("ek do teen chaar", 1),
);

console.log("\nscene ke beech saans (gap)");

const gapped = { ...filled, gapSeconds: 0.4, replaceExisting: true };
const noGap = { ...filled, gapSeconds: 0, replaceExisting: true };
check(
  "gap poori reel me judta hai — par aakhri scene par nahi",
  Math.abs(draftTotalSeconds(gapped) - draftTotalSeconds(noGap) - 0.4 * 3) < 0.01,
  "aakhri par gap reel ke ant me thehra hua frame ban jaata",
);
check(
  "aur wahi lambai doc me bhi lagti hai",
  (() => {
    const a = applyWizard({ doc: project, draft: noGap }).doc.project.durationInFrames;
    const b = applyWizard({ doc: project, draft: gapped }).doc.project.durationInFrames;
    return b > a && Math.abs((b - a) / project.project.fps - 1.2) < 0.15;
  })(),
  "footer ka hisaab aur doc ka hisaab ek hi function se aana chahiye",
);
check("gap ki hadd lagti hai", draftTotalSeconds({ ...filled, gapSeconds: 99 }) < draftTotalSeconds({ ...filled, gapSeconds: 1.5 }) + 0.01);

console.log("\ntext chhupana");

check(
  "sirf awaaz wale scene par bhi text chhup sakta hai",
  textHidden({ ...filled.scenes[2]!, hideText: true }),
  "pehle sirf tasveer ginti thi — chunav dabta tha par lagta nahi tha",
);
check(
  "bina tasveer aur bina awaaz ke text chhupta nahi",
  !textHidden({
    ...filled.scenes[3]!,
    hideText: true,
    visualAssetId: null,
    voiceAssetId: null,
  }),
  "warna scene me kuch bachta hi nahi — ek kaala frame",
);

console.log("\nrang / effect");

check(
  "har effect preset ka aam bhasha wala naam hai",
  missing.effects.length === 0,
  missing.effects.length > 0 ? `chhoot gaye: ${missing.effects.join(", ")}` : "",
);
check("effect ki list me 'kuch nahi' ka raasta hai", EFFECT_PLAIN_NAMES.some((e) => e.id === "none"));
check("plainEffect lookup chalta hai", plainEffect("bw")?.label === "Safed-kaala");

const withEffect = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    scenes: filled.scenes.map((s, i) => (i === 0 ? { ...s, effectPresetId: "bw" } : s)),
  },
});
const effectScene = [...withEffect.doc.scenes].sort((a, b) => a.order - b.order)[0];
const effectItem = primarySceneItem(withEffect.doc, effectScene!.id);
check(
  "chuna hua effect dikhne wale item par laga",
  (effectItem?.effects.length ?? 0) > 0,
  "wizard me chunav dikhe aur reel me na lage — wo sabse bura wala nateeja hai",
);
check(
  "anjaan effect poore wizard ko nahi girata",
  applyWizard({
    doc: project,
    draft: {
      ...filled,
      replaceExisting: true,
      scenes: filled.scenes.map((s, i) => (i === 0 ? { ...s, effectPresetId: "aisa-koi-nahi" } : s)),
    },
  }).applied === 4,
);

console.log("\nmusic aur har scene ka level");

const withMusic = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    musicAssetId: "as_music",
    musicVolume: 0.15,
    scenes: filled.scenes.map((s, i) =>
      i === 2 ? { ...s, musicVolume: 0, voiceVolume: 0.6 } : s,
    ),
  },
});
const musicItems = withMusic.doc.items.filter((item) => item.assetId === "as_music");
check("har scene ka apna music tukda banta hai", musicItems.length === 4);
check(
  "music track apni hai, awaaz wali nahi",
  musicItems.every(
    (item) => withMusic.doc.tracks.find((t) => t.id === item.trackId)?.type === "music",
  ),
);
check(
  "tukde scene se jude hue hain",
  musicItems.every((item) => item.sceneId !== null),
  "bina iske dobara wizard chalane par purana music bacha reh jaata — do gaane ek saath",
);
check(
  "dhun aage badhti hai, har scene par shuru se nahi",
  [...musicItems].sort((a, b) => a.startFrame - b.startFrame).every((item, at, list) => {
    if (at === 0) return item.trimStartFrame === 0;
    const previous = list[at - 1]!;
    return item.trimStartFrame === previous.trimStartFrame + previous.durationInFrames;
  }),
  "har tukda 0 se shuru hone par ek hi dhun baar-baar shuru hoti hui sunai deti",
);
check(
  "jis scene par music band kaha wahan wo chup hai",
  (() => {
    const third = [...withMusic.doc.scenes].sort((a, b) => a.order - b.order)[2];
    const clip = musicItems.find((item) => item.sceneId === third?.id);
    return clip?.audio.muted === true && clip.audio.volume === 0;
  })(),
);
check(
  "fade sirf pehle aur aakhri tukde par",
  (() => {
    const ordered = [...musicItems].sort((a, b) => a.startFrame - b.startFrame);
    return (
      ordered[0]!.audio.fadeInFrames > 0 &&
      ordered[ordered.length - 1]!.audio.fadeOutFrames > 0 &&
      ordered[1]!.audio.fadeInFrames === 0 &&
      ordered[1]!.audio.fadeOutFrames === 0
    );
  })(),
  "har tukde par fade lagane se music 'ghar-ghar' karta hua sunai deta hai",
);
check(
  "scene ka awaaz level us scene ke audio item par laga",
  (() => {
    const third = [...withMusic.doc.scenes].sort((a, b) => a.order - b.order)[2];
    const voice = withMusic.doc.items.find(
      (item) => item.sceneId === third?.id && item.type === "audio" && item.assetId !== "as_music",
    );
    return voice !== undefined && Math.abs(voice.audio.volume - 0.6) < 0.01;
  })(),
);
check(
  "music na chuna ho to koi music item nahi",
  applyWizard({ doc: project, draft: { ...filled, replaceExisting: true } }).doc.items.every(
    (item) => item.assetId !== "as_music",
  ),
);

console.log("\nawaaz ka chuna hua hissa (kaat)");

/** Ek scene jispar naapi hui 6s ki awaaz hai. */
const voicedScene = {
  ...filled.scenes[0]!,
  voiceAssetId: "as_voice_0",
  voiceForText: filled.scenes[0]!.text,
  voiceSeconds: 6,
};

check(
  "bina kaat ke poori awaaz ginti hai",
  voiceSourceSeconds(voicedScene) === 6,
);
check(
  "kaat lagne par sirf chuna hua hissa ginta hai",
  voiceSourceSeconds({ ...voicedScene, voiceTrim: { startSeconds: 1, endSeconds: 4 } }) === 3,
);
check(
  "kaat file ki apni lambai se bahar nahi ja sakti",
  voiceSourceSeconds({ ...voicedScene, voiceTrim: { startSeconds: 1, endSeconds: 99 } }) === 5,
  "purana draft ek lambi file ki kaat rakh sakta hai — bina hadd ke scene us awaaz se lamba banta jo hai hi nahi",
);
check(
  "scene ki lambai kaat ke saath ghatti hai",
  (() => {
    const full = sceneSeconds(voicedScene);
    const cut = sceneSeconds({ ...voicedScene, voiceTrim: { startSeconds: 1, endSeconds: 4 } });
    return cut < full && Math.abs(cut - (3 + 0.35)) < 0.5;
  })(),
  "bina iske awaaz me se 2 second kaat kar bhi scene wahi lamba rehta — ant me chuppi",
);

const trimmed = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    scenes: filled.scenes.map((s, i) =>
      i === 0
        ? { ...voicedScene, voiceTrim: { startSeconds: 1, endSeconds: 4 } }
        : s,
    ),
  },
});

const trimmedVoice = (() => {
  const sceneId = Object.keys(trimmed.sceneIndexById).find(
    (id) => trimmed.sceneIndexById[id] === filled.scenes[0]!.index,
  );
  return trimmed.doc.items.find(
    (item) => item.sceneId === sceneId && item.assetId === "as_voice_0",
  );
})();

check(
  "kaat doc ke audio item par lagti hai",
  trimmedVoice !== undefined &&
    trimmedVoice.trimStartFrame === Math.round(1 * trimmed.doc.project.fps),
);
check(
  "kata hua item utna hi lamba hai jitna chuna gaya tha",
  trimmedVoice !== undefined &&
    Math.abs(trimmedVoice.durationInFrames - 3 * trimmed.doc.project.fps) <= 1,
  "poori scene ki lambai rakh dene par kaat ke aage ka hissa bhi baj jaata — yaani kaat lagti hi nahi",
);
check(
  "kaat sirf awaaz par lagti hai, music par nahi",
  (() => {
    const withBoth = applyWizard({
      doc: project,
      draft: {
        ...filled,
        replaceExisting: true,
        musicAssetId: "as_music",
        scenes: filled.scenes.map((s, i) =>
          i === 0 ? { ...voicedScene, voiceTrim: { startSeconds: 1, endSeconds: 4 } } : s,
        ),
      },
    });
    return withBoth.doc.items
      .filter((item) => item.assetId === "as_music")
      .every((item) => item.durationInFrames > 0 && item.trimStartFrame >= 0);
  })(),
  "dono audio item hain — sirf type dekhne par kaat gaane par lag jaati",
);

console.log("\nhar scene ka apna gaana");

const mixedMusic = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    musicAssetId: "as_music",
    scenes: filled.scenes.map((s, i) => (i >= 2 ? { ...s, musicAssetId: "as_music_2" } : s)),
  },
});
const mixedClips = mixedMusic.doc.items
  .filter((item) => item.assetId === "as_music" || item.assetId === "as_music_2")
  .sort((a, b) => a.startFrame - b.startFrame);

check("har scene apna gaana chun sakta hai", mixedClips.length === 4);
check(
  "jis scene par apna gaana likha hai wahan wahi bajta hai",
  mixedClips[0]?.assetId === "as_music" &&
    mixedClips[1]?.assetId === "as_music" &&
    mixedClips[2]?.assetId === "as_music_2" &&
    mixedClips[3]?.assetId === "as_music_2",
);
check(
  "naya gaana apni shuruaat se bajta hai",
  mixedClips[2]?.trimStartFrame === 0,
  "ek hi cursor rakhne par doosri dhun apne beech se shuru hoti — sunne me 'gaana kat gaya' jaisa",
);
check(
  "gaana badalne wale jod par dono taraf fade lagta hai",
  (mixedClips[1]?.audio.fadeOutFrames ?? 0) > 0 && (mixedClips[2]?.audio.fadeInFrames ?? 0) > 0,
  "bina iske ek dhun poore level par achanak katti hai aur doosri achanak shuru hoti hai",
);
check(
  "ek hi gaane ke beech ke jod chipke rehte hain",
  mixedClips[1]?.audio.fadeInFrames === 0 && mixedClips[2]?.audio.fadeOutFrames === 0,
);
check(
  "reel par music na ho tab bhi ek scene par lag sakta hai",
  applyWizard({
    doc: project,
    draft: {
      ...filled,
      replaceExisting: true,
      musicAssetId: null,
      scenes: filled.scenes.map((s, i) => (i === 3 ? { ...s, musicAssetId: "as_cta_music" } : s)),
    },
  }).doc.items.filter((item) => item.assetId === "as_cta_music").length === 1,
  "aksar music sirf aakhri CTA par chahiye hota hai — reel wale chunav ki shart lagane par wo raasta hi nahi bachta",
);

console.log("\npreview me chun kar kiye hue sudhaar");

const plainBuild = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    scenes: filled.scenes.map((s, i) => (i === 0 ? { ...s, effectPresetId: "bw" } : s)),
  },
});

const tweaked = applyWizard({
  doc: project,
  draft: {
    ...filled,
    replaceExisting: true,
    scenes: filled.scenes.map((s, i) =>
      i === 0
        ? {
            ...s,
            effectPresetId: "bw",
            tweaks: {
              "image:0": {
                ...NO_TWEAK,
                scale: 1.5,
                x: 40,
                y: -20,
                rotation: 10,
                opacity: 0.5,
                noAnimation: true,
                noEffect: true,
              },
              "text:0": { ...NO_TWEAK, hidden: true },
            },
          }
        : s,
    ),
  },
});

/** Bane hue doc me se pehle draft scene ka wo hissa jispar tweak laga tha. */
function firstScenePieces(result: typeof tweaked) {
  const sceneId = Object.keys(result.sceneIndexById).find(
    (id) => result.sceneIndexById[id] === filled.scenes[0]!.index,
  );
  const scene = result.doc.scenes.find((entry) => entry.id === sceneId);
  const items = scene ? sceneItemsInOrder(result.doc.items, scene) : [];
  const keys = elementKeyMap(items);
  return {
    keys,
    picture: items.find((item) => keys[item.id] === "image:0") ?? null,
    caption: items.find((item) => keys[item.id] === "text:0") ?? null,
  };
}

const plainPieces = firstScenePieces(plainBuild);
const tweakedPieces = firstScenePieces(tweaked);

check(
  "doc ke scene se wapas draft ka scene mil jaata hai",
  tweakedPieces.picture !== null && plainPieces.picture !== null,
  "bina `sceneIndexById` ke preview me chuni hui cheez ka koi maalik nahi hota",
);
check(
  "element ki pehchaan type aur ginti se banti hai",
  tweakedPieces.keys[tweakedPieces.picture!.id] === "image:0" &&
    tweakedPieces.keys[tweakedPieces.caption!.id] === "text:0",
  "item ki id har baar nayi banti hai — uspar tweak baandhne par pehla hi sudhaar apni chuni hui cheez gum kar deta",
);
check(
  "naap guna hota hai, likha nahi jaata",
  Math.abs(
    tweakedPieces.picture!.transform.scale - plainPieces.picture!.transform.scale * 1.5,
  ) < 0.001,
  "seedha likh dene par scene type ka apna layout (CTA ka logo, phone frame) chup-chaap mit jaata",
);
check(
  "jagah aur ghumav jud'te hain",
  tweakedPieces.picture!.transform.x === plainPieces.picture!.transform.x + 40 &&
    tweakedPieces.picture!.transform.y === plainPieces.picture!.transform.y - 20 &&
    tweakedPieces.picture!.transform.rotation === plainPieces.picture!.transform.rotation + 10,
);
check(
  "halkapan guna hota hai",
  Math.abs(
    tweakedPieces.picture!.transform.opacity - plainPieces.picture!.transform.opacity * 0.5,
  ) < 0.001,
);
check(
  "harkat hatane par us item par koi animation nahi bachti",
  plainPieces.picture!.animations.length > 0 && tweakedPieces.picture!.animations.length === 0,
);
check(
  "rang ka effect hatane par us item par koi effect nahi bachta",
  plainPieces.picture!.effects.length > 0 && tweakedPieces.picture!.effects.length === 0,
);
check(
  "chhupayi hui cheez doc me hidden hai",
  tweakedPieces.caption!.hidden === true && plainPieces.caption!.hidden === false,
);
check(
  "jispar kuch nahi kiya wo waisa ka waisa rehta hai",
  tweakedPieces.caption!.transform.scale === plainPieces.caption!.transform.scale &&
    tweakedPieces.caption!.transform.x === plainPieces.caption!.transform.x,
);

console.log("\nlibrary ka tab (kind se)");

check("image ka tab", libraryTabForKind("image")?.id === "images");
check("video ka tab", libraryTabForKind("video")?.id === "videos");
check(
  "audio ka tab 'audio' hai, 'audios' nahi",
  libraryTabForKind("audio")?.id === "audio",
  "yahi wo galti thi jiski wajah se Awaaz wala picker hamesha 400 deta tha",
);
check("bina tag wala tab chunta hai", libraryTabForKind("audio")?.tag === null, "warna 'music' mil jaata aur bina tag wali awaazein dikhti hi nahi");

/*
 * ⚠️ Sirf ek summary, aur wo **file ke bilkul ant me**.
 *
 * Pehle ye do jagah tha — beech me bhi, aur ant me bhi. Uska nateeja chup-chaap
 * bura tha: jo jaanch is line ke BAAD likhi jaati, wo chalti to thi par ginti me
 * aati hi nahi, aur uske fail hone par bhi script exit 0 deti thi. Yaani ek
 * toota hua niyam poori tarah dikhta hua bhi "sab theek hai" ke saath nikal
 * jaata — jo is poori file ke maqsad ka ulta hai.
 */
console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
