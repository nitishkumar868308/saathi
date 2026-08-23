import type { AiScene, AiScript } from "../ai/types";
import { applyProposal, buildProposal } from "../ai/proposal";
import { getSceneType, requireSceneType } from "../registry/sceneTypes";
import type { Doc } from "../schema/project";
import { applyAnimationPreset, setTransition, trimItemToSourceRange } from "../timeline/ops";
import { primarySceneItem } from "../scenes/primary";
import { suggestAnimation, suggestTransition, type WizardSceneLike } from "./suggest";

/**
 * Wizard ka draft — **sab kuch ek jagah, aur doc se bahar** (26.4 / 26.11).
 *
 * ⚠️ Wizard chalte hue doc ko **chhua nahi jaata**. Aadmi teen step se guzarta
 * hai, beech me peeche jaata hai, kuch badalta hai, aur "band karo" bhi daba
 * sakta hai. Har step par doc likhne ka matlab hota: aadha bana hua kaam project
 * me pada rehna, aur undo ka dher — 8 scene par 30 se zyada entries, jinme se
 * kisi ek par rukna doc ko aadha-naya aadha-purana chhod deta.
 *
 * Isliye poora wizard yahin jama hota hai aur **ant me ek hi baar** doc me
 * jaata hai — ek `replaceDoc` op, ek Ctrl+Z.
 *
 * ⚠️ Ye file `@reel/core` me hai, studio me nahi, aur wo jaan-boojhkar hai. Yahan
 * na React hai na fetch — isliye poora apply ka raasta ek script se chala kar
 * dekha ja sakta hai (`scripts/check-wizard.ts`), bina browser khole. UI ka kaam
 * sirf ye draft bharna hai.
 */

export interface WizardScene {
  /** AI ke script me is scene ka number (0 se). Kabhi nahi badalta. */
  index: number;
  /** `SCENE_TYPES` ka id — jo AI ne chuna. */
  type: string;
  name: string;
  durationSeconds: number;
  /** Screen par dikhne wala / bola jaane wala text. Aadmi badal sakta hai. */
  text: string;
  /** AI ke diye baaki slots (role naam ke saath), jaise ke waise. */
  slots: Record<string, string>;

  visualAssetId: string | null;
  /**
   * Jo cheez chuni gayi wo tasveer thi ya video.
   *
   * WARNING: Iske bina scene type ka faisla ho hi nahi sakta. Aadmi `image_audio`
   * wale scene par video daal de to us slot ka kind mel nahi khaata, aur item
   * `image` bankar ek video ki id le kar baith jaata - render me wo chup-chaap
   * khaali frame deta hai.
   */
  visualAssetKind: "image" | "video" | null;
  /**
   * Chuni hui file ka apna naap — `null` = pata nahi.
   *
   * WARNING: Ye "kitni badi tasveer chahiye" wali chetavni ke liye nahi hai
   * (wo `requiredVisualSize` karta hai). Ye is liye hai ki **kaunsa fit lagega**
   * yahi tay karta hai: landscape tasveer portrait frame me cover se bharne par
   * do guna phail jaati hai aur saaf dikhta hua dhundhlapan aa jaata hai. Dekho
   * `fitFor()`.
   */
  visualSize: { width: number; height: number } | null;
  /**
   * Video ka kaunsa hissa lena hai — file ke andar ka waqt (26.18).
   *
   * WARNING: `null` matlab poori file. Video daalte hi aadmi se ye poochha jaata
   * hai, kyunki 2 minute ki recording ko 4 second ke scene me daalne par bina
   * poochhe **pehle 4 second** hi lag jaate hain - aur wo aksar wahi hissa hota
   * hai jisme kuch hua hi nahi (camera set ho raha tha).
   */
  visualTrim: { startSeconds: number; endSeconds: number } | null;
  /**
   * Video ko phone ke frame me dikhao — app ki recording ke liye.
   *
   * ⚠️ Ye sirf sajawat nahi hai, **saaf dikhne ka sawaal** hai. Ek 386x850 ki
   * screen recording poore 1080 chaude frame me 2.26 guna phailti hai aur uska
   * chhota UI text padha nahi jaata. Phone frame ke andar wo 58% chaudai par
   * baithti hai — yaani 1.62 guna — aur utna hi kaafi hota hai ki likha hua saaf
   * rahe.
   *
   * ⚠️ Default `false` hai aur apne aap nahi lagta. Har portrait video ko phone
   * frame me daal dena galat hoga: koi apni selfie ya camera ki footage daale to
   * wo ek phone ke andar chipki hui ajeeb lagti hai. Ye chunav aadmi ka hai, aur
   * uske saath sifaarish likhi hoti hai.
   */
  phoneFrame: boolean;
  voiceAssetId: string | null;
  /**
   * Bani hui awaaz kitni lambi hai (second me) — `null` = pata nahi.
   *
   * WARNING: Ye scene ki lambai tay karta hai, aur wahi is field ki poori wajah
   * hai. Pehle scene ki lambai AI ke andaaze se aati thi (aksar 4s) aur awaaz
   * apni marzi ki lambai ki hoti thi. Dono me se ek galti pakki thi: awaaz
   * chhoti ho to har scene ke ant me ek suna hua khalaa aata tha, aur badi ho to
   * aakhri shabd BEECH ME KAT jaata tha.
   *
   * Dekhne wale ko dono ek hi cheez lagti hain - "awaaz ruk jaati hai, phir
   * chalti hai". Aur wo poori reel ko tooti hui bana deta hai, chahe baaki sab
   * theek ho.
   */
  voiceSeconds: number | null;
  /**
   * Awaaz kitni tez chale — 1 = jaisi bani thi.
   *
   * ⚠️ Ye **dobara banane wali** speed nahi hai. Yahan se `playbackRate` lagta
   * hai, jo Remotion khud naap kar chalata hai: 1.15 par awaaz theek 1.15 guna
   * tez hoti hai, aur scene ki lambai bhi usi hisaab se ghat jaati hai.
   *
   * ⚠️ TTS provider se raftaar maangna is se bahut kamzor hai. Gemini me speed ka
   * koi parameter hai hi nahi — wahan "thoda tez bolo" **shabdon me** kaha jaata
   * hai, aur wo kabhi 1.5x ban jaata hai, kabhi 1.1x. Us andaaze par scene ki
   * lambai nahi bandhi ja sakti. Isliye awaaz jaisi bani waisi rehti hai, aur
   * raftaar yahan lagti hai — turant, bina naye kharche ke, aur wapas bhi ho
   * jaati hai.
   */
  voiceRate: number;
  /**
   * Kis text se awaaz bani thi.
   *
   * ⚠️ Iske bina 26.9 ka nishaan lagana namumkin hai: text badalne ke baad bani
   * hui awaaz purane shabdon ki reh jaati hai, aur wo galti kahin dikhti nahi.
   */
  voiceForText: string | null;

  /**
   * Text frame me kahan baithe.
   *
   * WARNING: Default `center` hai aur wo har tasveer par theek nahi baithta -
   * chehra beech me ho to text usi par chadh jaata hai. Ye chunav per-scene hai
   * (baaki chunav poori reel ke liye ek hain), kyunki jagah tasveer se tay hoti
   * hai, reel se nahi.
   */
  textPosition: "top" | "center" | "bottom";

  /** `null` = abhi kuch nahi chuna (auto-fill isi ko bharta hai). */
  animationPresetId: string | null;
  transitionId: string | null;

  /**
   * Screen par text mat dikhao — sirf bolo.
   *
   * WARNING: Ye sirf tab lagta hai jab scene me tasveer ho (dekho `textHidden`).
   * Bina tasveer ke text chhupane par scene me kuch bachta hi nahi - ek kaala
   * frame jispar awaaz chalti hai. Wo chunav aadmi jaan-boojhkar nahi karta,
   * isliye wo lagne bhi nahi diya jaata.
   */
  hideText: boolean;

  /** Aadmi ne "hata do" dabaya. */
  removed: boolean;
}

export interface WizardDraft {
  summary: string;
  scenes: WizardScene[];
  /**
   * Poori reel ke text ka size - 1 = jaisa hai.
   *
   * WARNING: Ye per-scene nahi hai, aur wo jaan-boojhkar hai. Ek hi reel me har
   * scene ka text alag size ka ho to wo reel bani hui nahi, judi hui lagti hai.
   * Aur saat scene par saat baar ye faisla lena wo kaam hai jise aadmi teesre
   * scene par chhod deta hai.
   */
  textScale: number;
  /**
   * Text ka rang — `null` matlab brand ka apna rang (`brand.text`).
   *
   * WARNING: `null` ka matlab "safed" NAHI hai, aur ye farak zaroori hai. `null`
   * rehne par item me `brand.text` likha rehta hai, yaani brand badalte hi poori
   * reel ka text uske saath badal jaata hai. Ek hex likh dene par wo naata toot
   * jaata hai — reel hamesha ke liye usi rang me jam jaati hai, aur brand badalne
   * par wo akeli purani reh jaati hai.
   *
   * Isliye rang tabhi likha jaata hai jab aadmi ne SACH ME chuna ho.
   */
  textColor: string | null;
  /**
   * Purane scene hata kar shuru se — `false` = aage jod do.
   *
   * WARNING: Default `false` hai aur wo badalna nahi chahiye. Wizard dobara
   * chalana aam baat hai (kahani sudhaarne ke liye), aur us par project mit
   * jaana wo galti hai jiski keemat sabse zyada hai.
   *
   * Par jodna bhi chup-chaap galat nateeja deta hai: doosri baar chalane par
   * reel 30s ki jagah 56s ki ban jaati hai, jisme pehle 8 scene purane hain.
   * Wo galti export ke baad hi dikhti hai. Isliye chunav saaf poochha jaata
   * hai, aur poori reel ki lambai wizard me hi likhi rehti hai.
   *
   * ⚠️ Sirf **scene wale** items hatte hain. Jo item kisi scene ka nahi hai
   * (background music, watermark) wo bacha rehta hai — aadmi ne wo alag se
   * lagaya tha, aur wizard ka usse koi lena-dena nahi.
   */
  replaceExisting: boolean;
}

/* ------------------------------------------------------------ slot khojna */

/**
 * Kis slot me text jaata hai.
 *
 * ⚠️ Slot ka id scene type ke hisaab se badalta hai — `text`/`cta` me `"text"`,
 * `image_audio` me `"caption"`. Naam se dhoondhna (`slots.text`) yahan chalta
 * aur wahan chup-chaap khaali chhod deta, isliye **kind se** dhoondha jaata hai.
 */
export function textSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find((slot) => slot.kind === "text")?.id ?? null;
}

/**
 * Scene ka **dikhne wala** asset slot — tasveer ya video.
 *
 * ⚠️ Pehle yahan sirf `asset:image` dekha jaata tha, aur wo ek asli chhed tha jo
 * chala kar dekhne par mila: AI aksar `screen_recording` scene banata hai, jiska
 * slot `asset:video` hota hai. Wizard uske liye koi button dikhata hi nahi tha,
 * isliye wo scene bhara ja hi nahi sakta tha aur ant me "asset library me nahi
 * mili" keh kar chhoot jaata tha — aur aadmi ke paas use theek karne ka koi
 * raasta nahi hota tha.
 */
export function visualSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return (
    type?.slots.find((slot) => slot.kind === "asset:image" || slot.kind === "asset:video")?.id ??
    null
  );
}

/** Wo slot tasveer maangta hai ya video — picker aur label dono isse tay hote hain. */
export function visualSlotKind(typeId: string): "image" | "video" | null {
  const type = getSceneType(typeId);
  const slot = type?.slots.find(
    (entry) => entry.kind === "asset:image" || entry.kind === "asset:video",
  );
  if (!slot) return null;
  return slot.kind === "asset:video" ? "video" : "image";
}

export function audioSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find((slot) => slot.kind === "asset:audio")?.id ?? null;
}

/**
 * Tasveer chhodne par ye scene sach me kaunsa type banega.
 *
 * ⚠️ Seedha `text` par gir jaana sabse aasan tha aur galat hota: `text` me audio
 * ka slot hai hi nahi, yaani aadmi ki banayi hui **awaaz chup-chaap gayab** ho
 * jaati — scene banta, text dikhta, bas awaaz chali jaati. Isliye awaaz ho to
 * `text_audio`, warna `text`.
 */
/**
 * Jis type me awaaz ka slot hi nahi, uska awaaz-wala bhai.
 *
 * WARNING: Ye map paanchvi baar wahi galti pakadne ke baad aaya. AI aksar scene
 * ka type `text` ya `image` chunta hai. Aadmi us scene par awaaz banata hai,
 * screen par "awaaz lag gayi" likha aata hai — aur apply ke waqt wo CHUP-CHAAP
 * GIR jaati hai, kyunki us type me audio ka slot hai hi nahi. Reel ban jaati
 * hai, scene dikhta hai, bas wo line boli nahi jaati.
 *
 * Pehle iska ilaaj har baar ek naya slot jodkar kiya gaya (`text_audio` bana,
 * phir `video` me slot aaya, phir `cta` me, phir `screen_recording` me). Wo ilaaj
 * har baar ek hi type ka tha; ye us halat ko poori tarah band karta hai — jahan
 * bhi awaaz ho par slot na ho, type upar chadh jaata hai.
 */
const VOICE_UPGRADE: Record<string, string> = {
  text: "text_audio",
  image: "image_audio",
};

export function effectiveType(scene: WizardScene): string {
  return withVoiceSlot(baseType(scene), scene);
}

/** Awaaz ho par type me uska slot na ho to upar chadha do. */
function withVoiceSlot(typeId: string, scene: WizardScene): string {
  if (!scene.voiceAssetId || audioSlotId(typeId)) return typeId;
  return VOICE_UPGRADE[typeId] ?? typeId;
}

function baseType(scene: WizardScene): string {
  if (scene.visualAssetId) {
    /*
     * Chuni hui cheez us scene type ke slot se mel khaati hai? Na khaaye to type
     * badalna hi padta hai - warna `image` ka item ek video ki id le kar baith
     * jaata hai aur render me khaali frame aata hai, bina kisi error ke.
     */
    const want = scene.visualAssetKind;
    // Phone frame maanga ho to wahi type jisme wo frame banta hai.
    if (want === "video" && scene.phoneFrame) return "screen_recording";
    if (!want || visualSlotKind(scene.type) === want) return scene.type;
    return want === "video" ? "video" : "image_audio";
  }

  const visual = visualSlotId(scene.type);
  const type = getSceneType(scene.type);
  const required = type?.slots.find((slot) => slot.id === visual)?.required ?? false;
  if (!visual || !required) return scene.type;

  return scene.voiceAssetId ? "text_audio" : "text";
}

/** Sifaarish ke liye scene ka chhota roop. */
function asSceneLike(scene: WizardScene): WizardSceneLike {
  return { type: effectiveType(scene), text: scene.text, hasImage: Boolean(scene.visualAssetId) };
}

/* -------------------------------------------------------------- draft banao */

/** AI ke script se pehla draft. */
export function draftFromScript(script: AiScript): WizardDraft {
  return {
    summary: script.summary,
    textScale: 1,
    textColor: null,
    replaceExisting: false,
    scenes: script.scenes.map((scene, index) => {
      const textSlot = textSlotId(scene.type);
      const rest: Record<string, string> = { ...scene.slots };
      if (textSlot) delete rest[textSlot];

      return {
        index,
        type: scene.type,
        name: scene.name,
        durationSeconds: scene.durationSeconds,
        text: (textSlot ? scene.slots[textSlot] : "") ?? "",
        slots: rest,
        visualAssetId: null,
        visualAssetKind: null,
        visualSize: null,
        visualTrim: null,
        phoneFrame: false,
        textPosition: "center",
        voiceAssetId: null,
        voiceSeconds: null,
        voiceRate: 1,
        voiceForText: null,
        hideText: false,
        animationPresetId: null,
        transitionId: null,
        removed: false,
      };
    }),
  };
}

/**
 * Bani hui awaaz ab purane shabdon ki hai? (26.9)
 *
 * ⚠️ Trim kar ke milaya jaata hai — aage-peeche ka space badal jaana aam hai
 * (aadmi text ke ant me enter daba deta hai), aur uspar "awaaz purani hai" ka
 * laal nishaan dikhana ek jhoothi chetavni hai. Jhoothi chetavni ka anjaam
 * hamesha ek hi hota hai: kuch dinon me use koi padhta hi nahi.
 */
export function voiceStale(scene: WizardScene): boolean {
  if (!scene.voiceAssetId || scene.voiceForText === null) return false;
  return scene.voiceForText.trim() !== scene.text.trim();
}

/**
 * Is scene par text sach me chhupega?
 *
 * WARNING: `hideText` akela kaafi nahi hai. Bina tasveer wale scene par text
 * chhupane ka matlab hai ek KHAALI scene - kaala frame, jispar bas awaaz chalti
 * hai. Aadmi wo maangta nahi; wo aksar tab hota hai jab usne pehle text chhupaya
 * aur baad me tasveer hata di. Isliye do shart hain, ek nahi.
 */
export function textHidden(scene: WizardScene): boolean {
  return scene.hideText && Boolean(scene.visualAssetId);
}

/**
 * Is tasveer/video ko frame me kaise baithana hai (26.23).
 *
 * ⚠️ Default `cover` hai aur wo aksar theek hai — par tab nahi jab source ka
 * aakaar frame se bahut alag ho. Ek 1698x926 (landscape) tasveer 1080x1920
 * (portrait) frame ko bharne ke liye **2.07 guna** phailti hai. Screen par wo
 * dhundhli dikhti hai, aur wajah dekhne wale ko kabhi samajh nahi aati — file to
 * badi hai, "1698 pixel" likha hai.
 *
 * Us haalat me `contain` ulta behtar hai: wahi tasveer 0.64 guna par baithti hai
 * (yaani CHHOTI hoti hai, phailti nahi) aur bilkul saaf rehti hai. Kinaron ki
 * khaali jagah usi tasveer ke dhundhle roop se bharti hai, isliye wo kaali patti
 * nahi lagti — wahi tarika `screen_recording` pehle se istemal karta hai.
 *
 * ⚠️ Hadd 1.6x par hai, 1.0 par nahi. Thoda sa phailna (1.2-1.4x) aankh pakadti
 * nahi, aur us par blur wala background lagana ulta nuksaan karta: poora frame
 * bharna hamesha behtar dikhta hai jab tak wo saaf ho.
 */
const MAX_UPSCALE = 1.6;

export function fitFor(
  source: { width: number; height: number } | null,
  project: { width: number; height: number },
): { mode: "cover" | "contain"; blurred: boolean } {
  if (!source || source.width <= 0 || source.height <= 0) return { mode: "cover", blurred: false };

  const cover = Math.max(project.width / source.width, project.height / source.height);
  if (cover <= MAX_UPSCALE) return { mode: "cover", blurred: false };

  return { mode: "contain", blurred: true };
}

/**
 * Do line ke beech ki saans — awaaz khatam hone ke baad itna scene aur chalta hai.
 *
 * WARNING: Ye zero nahi hai, aur wo jaan-boojhkar hai. Awaaz ke aakhri sample par
 * hi scene kaat dene se agli line pichhli par chadhi hui sunai deti hai - aadmi
 * bolne me saans leta hai, aur bina us saans ke do line ek hi saans me boli hui
 * lagti hain. Aur ye utna hi chhota hai ki "ruk gaya" na lage.
 */
const VOICE_TAIL_SECONDS = 0.25;

/** Scene itne se chhota nahi hoga — chahe awaaz kitni bhi chhoti ho. */
const MIN_SCENE_SECONDS = 1.2;

/**
 * Is scene ki asli lambai — **awaaz se**, AI ke andaaze se nahi.
 *
 * ⚠️ Tarteeb maayne rakhti hai. Awaaz ho to wahi tay karti hai, kyunki uska kat
 * jaana ya uske baad chup baith jaana dono saaf sunai dete hain. Video ka chuna
 * hua hissa usse bada ho to wo jeetta hai - warna chuni hui footage beech me hi
 * kat jaati, aur aadmi ko lagta hai uska trim maana hi nahi gaya.
 */
/**
 * Awaaz screen par kitni der chalegi — raftaar laga kar, saans jod kar.
 *
 * `null` = is scene par awaaz hai hi nahi (ya uski lambai pata nahi).
 */
export function voiceSeconds(scene: WizardScene): number | null {
  if (!scene.voiceAssetId || !scene.voiceSeconds || scene.voiceSeconds <= 0) return null;
  const rate = scene.voiceRate > 0 ? scene.voiceRate : 1;
  return scene.voiceSeconds / rate + VOICE_TAIL_SECONDS;
}

export function sceneSeconds(scene: WizardScene): number {
  const trimmed = scene.visualTrim
    ? Math.max(0.5, scene.visualTrim.endSeconds - scene.visualTrim.startSeconds)
    : null;

  const voice = voiceSeconds(scene);

  if (voice === null) return trimmed ?? scene.durationSeconds;
  return Math.max(MIN_SCENE_SECONDS, voice, trimmed ?? 0);
}

/**
 * Jo chunav abhi khaali hain, unme sifaarish bhar do (26.8).
 *
 * ⚠️ Ye function bhare hue chunav ko **kabhi nahi** chhoota. Sab kuch dobara
 * likh dena ek galti hai jiska pata bahut der se chalta hai: aadmi ne 20 minute
 * laga kar chuna, ek button daba, aur sab wapas default. Wo dobara us button ke
 * paas nahi jaata — aur aksar tool ke paas bhi nahi.
 */
export function autoFill(draft: WizardDraft): WizardDraft {
  const live = draft.scenes.filter((scene) => !scene.removed);

  return {
    ...draft,
    scenes: draft.scenes.map((scene) => {
      if (scene.removed) return scene;

      /*
       * ⚠️ Sifaarish ke liye number **bache hue** scenes me se lena hai, draft ke
       * asli index se nahi. Beech ka scene hata dene par asli index me gaddha ban
       * jaata hai, aur "pehla scene" (jise transition nahi milta) wo reh jaata
       * hai jo ab pehla hai hi nahi.
       */
      const at = live.indexOf(scene);
      const previous = at > 0 ? live[at - 1] : null;

      return {
        ...scene,
        animationPresetId:
          scene.animationPresetId ?? suggestAnimation(asSceneLike(scene), at),
        transitionId:
          scene.transitionId ??
          suggestTransition(at, Boolean(scene.visualAssetId), Boolean(previous?.visualAssetId)),
      };
    }),
  };
}

/* ------------------------------------------------------------------ apply */

export interface ApplyWizardResult {
  doc: Doc;
  /** Kitne scene bane. */
  applied: number;
  /** Jo chhoot gaye, wajah ke saath. */
  skipped: { index: number; reason: string }[];
}

/**
 * Poora draft doc me lagao — **ek baar me** (26.11).
 *
 * Raasta wahi hai jo AI panel ka tha, sirf ab uske slots bhare hue hain:
 *
 *     draft → AiScript → buildProposal → applyProposal → animation + transition
 *
 * ⚠️ Yahan koi naya raasta nahi banaya gaya. `addScene`, `applyAnimationPreset`,
 * `setTransition` — sab wahi ops hain jo haath ke button chalate hain (21.7).
 * Wizard ke liye alag raasta banane par ek din wizard se bani reel aur haath se
 * banayi reel do alag cheezein ban jaati.
 */
export function applyWizard(args: { doc: Doc; draft: WizardDraft }): ApplyWizardResult {
  const live = args.draft.scenes.filter((scene) => !scene.removed);

  /*
   * Purane scene hatana — sabse pehle, taaki uske baad ka poora hisaab (naye
   * scene pehchaanna, lambai, layout) saaf doc par chale.
   */
  const startDoc: Doc = args.draft.replaceExisting
    ? {
        ...args.doc,
        scenes: [],
        items: args.doc.items.filter((item) => !item.sceneId),
      }
    : args.doc;

  const assetByRole: Record<string, string> = {};
  const scenes: AiScene[] = live.map((scene, at) => {
    const type = effectiveType(scene);
    const slots: Record<string, string> = { ...scene.slots };

    const textSlot = textSlotId(type);
    // Text chhupa hua ho to slot bharte hi nahi — awaaz phir bhi chalti rehti hai.
    if (textSlot && scene.text.trim() && !textHidden(scene)) slots[textSlot] = scene.text;

    /*
     * ⚠️ Asset id seedha slot me nahi likhi jaati. `applyProposal` slots ko
     * `assetByRole` se guzarta hai, isliye yahan **role ka naam** jaata hai aur
     * asli id map me. Id seedha likhne par wo naam samajh kar dhoondhi jaati aur
     * na milne par slot khaali reh jaata — bina kisi error ke.
     */
    const visualSlot = visualSlotId(type);
    if (visualSlot && scene.visualAssetId) {
      const role = `visual:${scene.index}`;
      slots[visualSlot] = role;
      assetByRole[role] = scene.visualAssetId;
    } else if (visualSlot) {
      delete slots[visualSlot];
    }

    const audioSlot = audioSlotId(type);
    if (audioSlot && scene.voiceAssetId) {
      const role = `voice:${scene.index}`;
      slots[audioSlot] = role;
      assetByRole[role] = scene.voiceAssetId;
    } else if (audioSlot) {
      delete slots[audioSlot];
    }

    return {
      type,
      name: scene.name,
      /*
       * WARNING: Lambai ka poora hisaab `sceneSeconds()` me hai, yahan nahi.
       * Wo hisaab UI ko bhi chahiye (aadmi ko reel ki asli lambai dikhani hai),
       * aur do jagah likhne par ek din wizard "30 second" bolta aur reel 34 ki
       * banti - wo farak sirf ban jaane ke baad pakda jaata.
       */
      durationSeconds: sceneSeconds(scene),
      slots,
      reason: `wizard · scene ${at + 1}`,
    };
  });

  const script: AiScript = { summary: args.draft.summary, scenes };
  const proposal = buildProposal({ doc: startDoc, script, mode: "append" });

  /*
   * ⚠️ Scene id pakadne ka ek hi bharosemand tarika hai: **pehle-baad ka farak**.
   * `applyProposal` sirf ginti lautata hai, id nahi, aur `append` mode naye scene
   * hamesha aakhir me jodta hai. Isliye pehle se maujood id yaad rakh kar baad me
   * jo naya mile wahi is wizard ka hai.
   *
   * Peeche se ginn kar (`slice(-n)`) lena aasan tha aur galat: beech ka koi scene
   * `skipped` me chala jaaye to ginti khisak jaati hai aur animation galat scene
   * par lag jaati — bina kisi error ke.
   */
  const before = new Set(startDoc.scenes.map((scene) => scene.id));
  const result = applyProposal({
    doc: startDoc,
    proposal,
    acceptedIds: proposal.entries.map((entry) => entry.id),
    assetByRole,
  });

  const skippedEntries = new Set(result.skipped.map((entry) => entry.id));
  /** Jo scene sach me bane — usi kram me jis kram me bheje the. */
  const madeFrom = live.filter((_, at) => !skippedEntries.has(`proposal_${at}`));

  const created = [...result.doc.scenes]
    .filter((scene) => !before.has(scene.id))
    .sort((a, b) => a.order - b.order);

  let doc = result.doc;

  created.forEach((scene, at) => {
    const source = madeFrom[at];
    if (!source) return;

    const primary = primarySceneItem(doc, scene.id);
    // Jis scene me dikhne layak kuch nahi (sirf awaaz), wahan animation ka
    // sawaal hi nahi uthta — SceneAnimation bhi wahan dropdown nahi dikhata.
    if (!primary) return;

    /*
     * ⚠️ Harkat ab **text par bhi** lagti hai, aur ye guard jaan-boojhkar hataya
     * gaya hai. Pehle yahan `&& source.visualAssetId` tha, is dar se ki zoom wala
     * preset text par lag jaayega. Us dar ki keemat ye thi ki bina tasveer wali
     * reel — yaani shuru ki har reel — poore 30 second sthir rehti thi: line
     * achanak aati, achanak jaati. Wo "kam animation" nahi tha, wo animation ka
     * na hona tha.
     *
     * Ab sifaarish khud text ke liye text wala preset chunti hai
     * (`suggestAnimation`), aur jo aadmi haath se chunta hai wo uska chunav hai.
     */
    if (source.animationPresetId) {
      doc = applyAnimationPreset(doc, {
        itemIds: [primary.id],
        presetId: source.animationPresetId,
      });
    }

    /*
     * Fit — tasveer/video frame me kaise baithe.
     *
     * WARNING: Ye `primary` par lagta hai, jo scene ka dikhne wala item hai. Jahan
     * scene me tasveer hai hi nahi (sirf text), wahan `primary` text ka item hota
     * hai aur uspar fit ka koi matlab nahi — isliye guard.
     */
    /*
     * WARNING: Phone frame wale scene par fit **nahi** chhua jaata. `screen_recording`
     * ka apna fit hai (frame ke andar `cover`), aur uske upar contain+blur lagane
     * par recording frame ke andar chhoti ho kar beech me baith jaati hai — phone
     * ke andar ek aur chhota phone.
     */
    /*
     * WARNING: Wizard fit ko sirf **contain ki taraf** badalta hai, kabhi wapas
     * cover par nahi laata. Wajah ek jaanch ne pakdi: CTA ka logo apne `build()`
     * me jaan-boojhkar `contain` par set hota hai (warna chaukor logo ke kinare
     * kat jaate hain), aur wizard uspar apna hisaab laga kar use wapas `cover`
     * kar deta tha. Yaani scene type ka soch-samajh kar liya hua faisla ek aam
     * niyam se mit jaata tha.
     *
     * Yahan ka kaam sirf ek halat sudhaarna hai — bahut zyada phailna — na ki
     * har item ka fit tay karna.
     */
    if (source.visualAssetId && primary.assetId === source.visualAssetId && !source.phoneFrame) {
      const fit = fitFor(source.visualSize, doc.project);
      if (fit.mode === "contain") {
        doc = {
          ...doc,
          items: doc.items.map((item) =>
            item.id === primary.id
              ? {
                  ...item,
                  fit: {
                    mode: "contain" as const,
                    background: fit.blurred
                      ? { kind: "blurred-asset" as const, value: null }
                      : item.fit.background,
                  },
                }
              : item,
          ),
        };
      }
    }

    /*
     * Video ka chuna hua hissa. Ye `applyAnimationPreset` se **pehle** nahi, baad
     * me lagta hai - dono alag cheezein hain aur ek doosre ko chhoote nahi.
     */
    if (source.visualTrim && primary.assetId === source.visualAssetId) {
      doc = trimItemToSourceRange(doc, {
        itemId: primary.id,
        startSeconds: source.visualTrim.startSeconds,
        endSeconds: source.visualTrim.endSeconds,
      });
    }

    if (source.transitionId && source.transitionId !== "none") {
      doc = setTransition(doc, {
        itemIds: [primary.id],
        side: "in",
        type: source.transitionId,
      });
    }
  });

  /*
   * Awaaz ki raftaar — us scene ke audio item par.
   *
   * WARNING: Ye `created.forEach` ke baad alag se lagti hai, `build()` ke andar
   * nahi. Wajah: `build()` ko rate ka pata hi nahi hai — wo registry me hai aur
   * wizard ke baahar bhi chalta hai (Scene Cards, AI patch). Rate ek wizard ka
   * chunav hai, scene type ka gun nahi.
   */
  created.forEach((scene, at) => {
    const src = madeFrom[at];
    if (!src || src.voiceRate === 1) return;
    doc = {
      ...doc,
      items: doc.items.map((item) =>
        item.sceneId === scene.id && item.type === "audio"
          ? { ...item, playbackRate: src.voiceRate }
          : item,
      ),
    };
  });

  /*
   * Text ki jagah — har scene ki apni.
   *
   * WARNING: Ye `applyProposal` ke baad lagti hai, us scene ke text items par.
   * Scene ke `build()` ke andar karna mumkin nahi: wahan har type ka apna layout
   * hai (CTA me logo aur patti bhi hain), aur ek hi niyam sab par thopne se wo
   * layout toot jaata.
   */
  created.forEach((scene, at) => {
    const src = madeFrom[at];
    if (!src || src.textPosition === "center") return;
    const shift = Math.round(doc.project.height * (src.textPosition === "top" ? -0.28 : 0.28));
    doc = {
      ...doc,
      items: doc.items.map((item) =>
        item.sceneId === scene.id && item.text
          ? { ...item, transform: { ...item.transform, y: item.transform.y + shift } }
          : item,
      ),
    };
  });

  /*
   * Text ka size sabse aakhir me - saare scene ban jaane ke baad. Har scene ke
   * andar karne par CTA jaise type chhoot jaate, jinka text `build()` ke andar
   * banta hai aur bahar se dikhta hi nahi.
   */
  const scale = args.draft.textScale;
  const color = args.draft.textColor;
  if (scale !== 1 || color) {
    const madeIds = new Set(
      doc.items.filter((item) => !before.has(item.sceneId ?? "")).map((item) => item.id),
    );
    /*
     * WARNING: CTA ka button yahan chhoda jaata hai. Uska rang uske apne background
     * (terracotta patti) ke hisaab se chuna gaya hai - `brand.textOnAccent`, jo
     * gehra hai. Reel ka text safed ho to wo button par bhi safed ho jaata, aur
     * terracotta par safed padha nahi jaata. Ek chunav jo poori reel ke liye theek
     * hai, ek jagah par ulta baithta hai - aur wahi ek jagah CTA hai.
     */
    const skipColor = (item: (typeof doc.items)[number]): boolean =>
      Boolean(item.text?.background);

    doc = {
      ...doc,
      items: doc.items.map((item) => {
        if (!madeIds.has(item.id) || !item.text) return item;
        return {
          ...item,
          text: {
            ...item.text,
            fontSize: scale === 1 ? item.text.fontSize : Math.round(item.text.fontSize * scale),
            color: color && !skipColor(item) ? color : item.text.color,
          },
        };
      }),
    };
  }

  /*
   * Project ki lambai reel ke bilkul aakhri frame par — na ek frame zyada.
   *
   * WARNING: Ye zaroori hai kyunki project ki lambai apne aap sirf **badhti**
   * hai, ghatti nahi (`growDuration`). Naya project 30s ka banta hai; wizard 24s
   * ki reel banata hai; aur MP4 30s ka nikalta hai — aakhri 6 second bilkul
   * KAALA aur chup. Wo galti editor me nazar nahi aati (aadmi reel dekh kar khush
   * ho jaata hai) aur render ke baad hi milti hai — aur tab tak wo reel bhej bhi
   * di ja chuki hoti hai.
   *
   * Ops me ye ghatana jaan-boojhkar nahi hota, aur wo waajib hai: aadmi ne aage
   * jagah chhodi ho to har chhoti edit use kha jaati. Par wizard ka poora maqsad
   * "poori reel ek baar me" hai — yahan aage ki khaali jagah kabhi jaan-boojhkar
   * nahi hoti.
   */
  const lastFrame = doc.items.reduce(
    (max, item) => Math.max(max, item.startFrame + item.durationInFrames),
    0,
  );
  if (lastFrame > 0) {
    doc = { ...doc, project: { ...doc.project, durationInFrames: lastFrame } };
  }

  return {
    doc,
    applied: result.applied,
    skipped: result.skipped.map((entry) => {
      const at = Number(entry.id.replace("proposal_", ""));
      return { index: live[at]?.index ?? at, reason: entry.reason };
    }),
  };
}

/* ------------------------------------------------------ chetavni aur salaah */

export interface WizardAdvice {
  /** `warn` = kuch galat baithega. `tip` = theek hai, par behtar ho sakta hai. */
  level: "warn" | "tip";
  text: string;
}

/**
 * Ek scene par kya galat baithega — **ban jaane se pehle** (26.22).
 *
 * ⚠️ Ye jaanch yahan is liye hai ki asli jaanch (`validateExportSettings`) bahut
 * der se bolti hai: wo Export ke waqt chalti hai, jab aadmi saara kaam kar chuka
 * hota hai. Reel ki lay se judi galtiyan — awaaz bahut tez, scene bahut lamba,
 * line bahut badi — export rokne layak nahi hoti (video ban to jaati hai), isliye
 * wahan wo aati bhi nahi. Par wahi galtiyan reel ko buri banati hain.
 *
 * ⚠️ Yahan har baat par chetavni nahi hai, aur wo jaan-boojhkar hai. Jo cheez
 * "shayad" galat hai wo `tip` hai; `warn` sirf wahan jahan nateeja pakka bura
 * hai. Sab kuch laal kar dene par kuch dinon me laal ka matlab hi khatam ho
 * jaata hai — aur phir asli wali bhi anpadhi jaati hai.
 */
export function sceneAdvice(scene: WizardScene, at: number): WizardAdvice[] {
  const out: WizardAdvice[] = [];
  if (scene.removed) return out;

  const seconds = sceneSeconds(scene);
  const words = scene.text.trim().split(/\s+/).filter(Boolean).length;

  if (voiceStale(scene)) {
    out.push({
      level: "warn",
      text: "Awaaz banne ke baad text badla hai — reel me kuch aur bolega, screen par kuch aur likha hoga. Dobara banao.",
    });
  }

  if (scene.voiceRate >= 1.4) {
    out.push({
      level: "warn",
      text: `Awaaz ${scene.voiceRate.toFixed(2)}x par hai — itni tez me shabd samajh nahi aate. 1.25x tak theek rehta hai.`,
    });
  } else if (scene.voiceRate <= 0.75) {
    out.push({
      level: "warn",
      text: `Awaaz ${scene.voiceRate.toFixed(2)}x par hai — itni dheemi me dekhne wala scroll kar deta hai.`,
    });
  }

  /*
   * Bina awaaz wale scene ki lambai AI ke andaaze se aati hai, aur us andaaze ka
   * padhne ki raftaar se koi rishta nahi hota. ~2.5 shabd/second ek aaram se
   * padhne wali raftaar hai; usse tez me line poori padhi hi nahi jaati.
   */
  if (!scene.voiceAssetId && words > 0 && words / seconds > 2.5) {
    out.push({
      level: "warn",
      text: `${words} shabd ${seconds.toFixed(1)}s me — padhne ka waqt hi nahi milega. Ya line chhoti karo, ya awaaz laga do (tab lambai apne aap awaaz jitni ho jaati hai).`,
    });
  }

  if (scene.voiceAssetId && scene.voiceSeconds === null) {
    out.push({
      level: "tip",
      text: "Is awaaz ki lambai pata nahi chali, isliye scene AI ke andaaze par chalega — awaaz beech me kat sakti hai.",
    });
  }

  if (seconds > 9) {
    out.push({
      level: "tip",
      text: `Ye scene ${seconds.toFixed(1)}s ka hai. Ek hi frame par 9s se zyada rukne par nazar hat jaati hai — do scene me toda ja sakta hai.`,
    });
  }

  if (at === 0 && seconds > 5) {
    out.push({
      level: "tip",
      text: "Pehla scene reel ka sabse mehnga hissa hai — yahan 3-4 second me baat shuru ho jaani chahiye.",
    });
  }

  if (textHidden(scene) && !scene.voiceAssetId) {
    out.push({
      level: "warn",
      text: "Text chhupa hua hai aur awaaz bhi nahi — is scene par koi baat pahunchegi hi nahi.",
    });
  }

  return out;
}

/** Poori reel par ek nazar — scene-dar-scene wali baatein `sceneAdvice` me hain. */
export function draftAdvice(draft: WizardDraft): WizardAdvice[] {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const total = live.reduce((sum, scene) => sum + sceneSeconds(scene), 0);
  const out: WizardAdvice[] = [];

  if (live.length === 0) return [{ level: "warn", text: "Ek bhi scene nahi bacha." }];

  if (total > 90) {
    out.push({
      level: "warn",
      text: `Reel ${Math.round(total)}s ki ban rahi hai. Reels/Shorts par 90s ke baad log nikal jaate hain — kuch scene hata do.`,
    });
  } else if (total > 60) {
    out.push({
      level: "tip",
      text: `Reel ${Math.round(total)}s ki hai. 30-45s sabse zyada poori dekhi jaati hai.`,
    });
  }

  const withVoice = live.filter((scene) => scene.voiceAssetId).length;
  if (withVoice > 0 && withVoice < live.length) {
    out.push({
      level: "warn",
      text: `${live.length - withVoice} scene par awaaz nahi hai. Beech me chup ho jaana toota hua lagta hai — ya sab par awaaz lagao, ya kisi par nahi.`,
    });
  }

  /*
   * Ek hi raftaar poori reel me — alag-alag rate lagane par awaaz "kudti" hai.
   * Ye chetavni nahi hai; kabhi-kabhi ye jaan-boojhkar hota hai (ek line par zor).
   */
  const rates = new Set(live.filter((s) => s.voiceAssetId).map((s) => s.voiceRate.toFixed(2)));
  if (rates.size > 2) {
    out.push({
      level: "tip",
      text: `${rates.size} alag raftaar chal rahi hain — sunne me bolne wala badalta hua lagta hai.`,
    });
  }

  return out;
}

/** UI ke liye: is draft me kya-kya abhi baaki hai. */
export function draftProgress(draft: WizardDraft): {
  total: number;
  withImage: number;
  withVoice: number;
  staleVoice: number;
  needsChoice: number;
} {
  const live = draft.scenes.filter((scene) => !scene.removed);
  return {
    total: live.length,
    withImage: live.filter((scene) => scene.visualAssetId).length,
    withVoice: live.filter((scene) => scene.voiceAssetId).length,
    staleVoice: live.filter(voiceStale).length,
    needsChoice: live.filter(
      (scene) => scene.transitionId === null || (scene.visualAssetId && !scene.animationPresetId),
    ).length,
  };
}

/** Registry me ye type hai bhi? — UI galat type par gir na jaaye. */
export function knownType(typeId: string): boolean {
  try {
    requireSceneType(typeId);
    return true;
  } catch {
    return false;
  }
}
