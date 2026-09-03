import type { AiScene, AiScript } from "../ai/types";
import { applyProposal, buildProposal } from "../ai/proposal";
import { getSceneType, requireSceneType } from "../registry/sceneTypes";
import type { Doc, Item, Scene } from "../schema/project";
import { createItem } from "../schema/factory";
import {
  addItem,
  addKeyframe,
  addTrack,
  applyAnimationPreset,
  applyEffectPreset,
  setTransition,
  trimItemToSourceRange,
} from "../timeline/ops";
import { primarySceneItem } from "../scenes/primary";
import { writeWizardMemory } from "./memory";
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

/**
 * Scene ke andar awaaz ka ek mod — "yahan se itna tez" (26.29).
 *
 * ⚠️ Ye `voiceVolume` / `musicVolume` ki jagah nahi leta, unke **upar** chalta
 * hai. Wo do ek scene ka *ek* level hain; ye us level ka **safar** hai. Dono ki
 * zaroorat asli hai: 90% scene par ek hi level theek hota hai (aur wahan teen
 * point maangna bekaar ka kaam hai), par jahan hook ke baad music uthana ho ya
 * bolne wale ke aate hi dhun ko peeche karna ho, wahan ek level ka koi jawab
 * nahi hota.
 *
 * ⚠️ `atSeconds` **scene ke shuru se** ginta hai, reel ke shuru se nahi. Reel ke
 * hisaab se rakhne par scene upar-neeche karte hi har point galat jagah chala
 * jaata — aur wo galti sirf poori reel sun kar pakdi jaati hai.
 */
export interface VolumePoint {
  /** Scene ke shuru se — second me. */
  atSeconds: number;
  /** 0 = chup, 1 = poora. */
  volume: number;
  /**
   * Yahan tak **dhire** pahunche (`true`) ya **turant** badle (`false`).
   *
   * ⚠️ Do alag cheezein hain aur dono chahiye. Music ko dhire uthana chahiye
   * (turant uthne par wo "kisi ne volume ka button daba diya" jaisa lagta hai),
   * aur bolne wale ke aate hi use turant peeche jaana chahiye (dhire jaane par
   * pehle do shabd dhun me dab jaate hain). Ek hi tarika rakhne par aadha kaam
   * hamesha galat lagta.
   */
  ramp: boolean;
}

/**
 * Point ki list se `audio.volume` ke keyframes — **ek hi jagah ka hisaab** (26.29).
 *
 * Lauta ta hai: item-local frame aur us frame par volume. Khaali list ka matlab
 * "kuch nahi badalna" hai — tab item ka sthir volume hi chalta rehta hai, aur
 * uspar ek bhi keyframe nahi likha jaata (`itemVolume` tab har frame par function
 * bulane se bach jaata hai).
 *
 * ⚠️ `ramp: false` par ek **extra keyframe theek pichhle frame par** likha jaata
 * hai, purani value ke saath. Iske bina "turant" jaisa kuch hota hi nahi:
 * keyframes ke beech hamesha interpolation hoti hai, isliye 0s ka point aur 3s
 * ka point milkar teen second ki dheemi dhalaan bana dete hain — jabki aadmi ne
 * teen second tak *sthir* maanga tha aur uske baad ek mod.
 *
 * ⚠️ Poora hisaab yahan hai, UI me nahi, aur wo jaan-boojhkar hai: ise ek script
 * se chala kar dekha ja sakta hai (`check-wizard.ts`). UI me likhne par ise sirf
 * kaan se jaancha ja sakta tha — yaani har badlav ke baad poori reel sunna.
 */
export function volumeCurve(args: {
  points: readonly VolumePoint[];
  /** Point na hone par jo level chalta — pehla keyframe isi ka banta hai. */
  base: number;
  durationInFrames: number;
  fps: number;
}): { frame: number; value: number }[] {
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const base = clamp(args.base);
  const last = Math.max(0, args.durationInFrames - 1);

  const points = args.points
    .filter((point) => Number.isFinite(point.atSeconds) && Number.isFinite(point.volume))
    .map((point) => ({
      frame: Math.max(0, Math.min(last, Math.round(point.atSeconds * args.fps))),
      value: clamp(point.volume),
      ramp: point.ramp,
    }))
    .sort((a, b) => a.frame - b.frame);

  if (points.length === 0) return [];

  const curve: { frame: number; value: number }[] = [{ frame: 0, value: base }];
  let previous = base;

  for (const point of points) {
    if (!point.ramp && point.frame > 0) curve.push({ frame: point.frame - 1, value: previous });
    curve.push({ frame: point.frame, value: point.value });
    previous = point.value;
  }

  return curve;
}

/** Is safar me kahin awaaz hai bhi? (`muted` ka faisla isi se hota hai.) */
export function curveIsSilent(curve: readonly { value: number }[]): boolean {
  return curve.every((entry) => entry.value <= 0);
}

/**
 * Ek cheez screen par **kaise aati hai** (26.30).
 *
 * ⚠️ Ye scene ke `animationPresetId` ki jagah nahi leta, uske **upar** ek element
 * par baithta hai. Preset poore scene ka mood hai (aur wo sirf dikhne wale
 * bade item par lagta hai); ye ek cheez ka apna aana hai. Dono ki zaroorat asli
 * hai, aur CTA us baat ka sabse saaf misaal hai: wahan logo, ek line, aur ek
 * button — teeno ek saath hote hain, aur teeno ka ek jaisa aana bilkul bekaar
 * dikhta hai. Logo beech me se ubharna chahiye, button neeche se uthna chahiye.
 *
 * ⚠️ `kind: "inherit"` ka matlab "maine kuch nahi kaha" hai, "kuch nahi" nahi.
 * Do alag cheezein hain: `inherit` par scene ka apna chunav chalta rehta hai
 * (aur wo aksar theek hota hai), `none` par us cheez par jaan-boojhkar koi harkat
 * nahi lagti. Ek hi value rakhne par "harkat hatao" aur "abhi socha nahi" me
 * farak hi nahi bachta — aur tab har naya element chup-chaap sthir ban jaata.
 */
export interface ElementEntry {
  kind: "inherit" | "none" | "fade" | "slide" | "pop" | "blur" | "spin";
  /**
   * `slide` ke liye — **kahan se** aata hai.
   *
   * ⚠️ Ye registry ke `direction` se ULTA padh sakta hai, isliye badalna
   * `SLIDE_FROM` se hota hai. Registry me `direction: "down"` ka matlab "neeche
   * se upar aata hai" hai (wo neeche se chal kar apni jagah par aata hai), aur
   * seedha "bottom" ko "up" par bhej dene par button upar se gir'ta hua dikhta —
   * theek ulta. Wo galti dikhne me chhoti hai aur sirf chala kar pakdi jaati hai.
   */
  from: "bottom" | "top" | "left" | "right";
  /** Kitni door se — frame ke naap ka percent. "kahan tak" ka jawab. */
  distancePercent: number;
  /** Aane me kitna waqt — raftaar. Chhota = tez. */
  seconds: number;
  /** Saath me halka fade bhi. */
  withFade: boolean;
}

/** Kuch nahi kaha — scene ka apna chunav chalta rahe. */
export const NO_ENTRY: ElementEntry = {
  kind: "inherit",
  from: "bottom",
  distancePercent: 20,
  seconds: 0.5,
  withFade: true,
};

/**
 * "Kahan se" → registry ka `direction`.
 *
 * ⚠️ Upar wala ⚠️ dekho: `bottom` (neeche se aata hai) registry me `down` hai.
 */
const SLIDE_FROM: Record<ElementEntry["from"], string> = {
  bottom: "down",
  top: "up",
  left: "left",
  right: "right",
};

/** Aane ki raftaar ki hadd — isse tez jhatka lagta hai, isse dheema atka hua. */
export const MIN_ENTRY_SECONDS = 0.1;
export const MAX_ENTRY_SECONDS = 3;

/**
 * Ek `ElementEntry` se asli animations ki list (26.30).
 *
 * ⚠️ Yahan koi naya animation nahi banaya gaya — sab `ANIMATIONS` registry ke
 * wahi entries hain jo panel me bhi hain (`slide`, `fade`, `scalePop`, `blurIn`,
 * `rotateIn`). Wizard ke liye apna alag raasta banane par ek din wizard se bani
 * reel aur haath se banayi reel do alag cheezein ban jaati.
 *
 * ⚠️ Fade **aakhir me** judta hai, aur wo kram maayne rakhta hai: `composeAnimations`
 * opacity guna karta hai, isliye khisakne ke saath fade dono ek saath chalte hain
 * aur cheez "aati hui" lagti hai, "phisalti hui" nahi.
 */
export function entryAnimations(entry: ElementEntry, fps: number): Item["animations"] {
  if (entry.kind === "inherit" || entry.kind === "none") return [];

  const seconds = Math.max(MIN_ENTRY_SECONDS, Math.min(MAX_ENTRY_SECONDS, entry.seconds));
  const durationInFrames = Math.max(1, Math.round(seconds * fps));
  const list: Item["animations"] = [];

  if (entry.kind === "slide") {
    list.push({
      type: "slide",
      enabled: true,
      direction: SLIDE_FROM[entry.from],
      distancePercent: Math.max(0, Math.min(100, entry.distancePercent)),
      durationInFrames,
      easing: "ease-out",
    });
  } else if (entry.kind === "pop") {
    list.push({ type: "scalePop", enabled: true, from: 0.6, durationInFrames, easing: "spring" });
  } else if (entry.kind === "blur") {
    list.push({ type: "blurIn", enabled: true, blurPx: 24, durationInFrames, easing: "ease-out" });
  } else if (entry.kind === "spin") {
    list.push({ type: "rotateIn", enabled: true, degrees: -12, durationInFrames, easing: "ease-out" });
  }

  /*
   * ⚠️ `fade` wale chunav par ye shart hamesha sach honi chahiye, chahe aadmi ne
   * "saath me fade" band kar rakha ho — warna "Fade" chunne par kuch hota hi
   * nahi, aur wo ek aisa chunav ban jaata hai jo dabta hai par lagta nahi.
   */
  if (entry.withFade || entry.kind === "fade") {
    list.push({ type: "fade", enabled: true, mode: "in", durationInFrames, easing: "ease-out" });
  }

  return list;
}

/**
 * Preview me haath se kiya hua chhota sudhaar — **ek element par** (26.28).
 *
 * ⚠️ Ye scene ke baaki chunav (`animationPresetId`, `textPosition`…) ki jagah
 * nahi hai, unke **upar** hai. Wo chunav poore scene ke hain; ye ek cheez ke —
 * "wo tasveer thodi badi", "ye line thodi baayen". Dono ko ek hi khaane me
 * daalne par "scene ka text neeche" aur "is line ko 40px baayen" ek doosre ko
 * mita dete, aur aadmi ko sirf itna dikhta ki uska pehla chunav gayab ho gaya.
 *
 * ⚠️ Naap aur jagah **judte** hain, likhte nahi (`scale` guna, `x`/`y` jama).
 * Seedha likh dene par scene type ka apna layout — CTA ka logo, phone frame ki
 * screen — chup-chaap mit jaata, aur wo galti sirf us ek scene par dikhti.
 */
export interface SceneTweak {
  /** Guna hone wala naap — 1 = jaisa tha. */
  scale: number;
  /** Daayen-baayen khisakna, project pixels me. Rina (-) = baayen. */
  x: number;
  /** Upar-neeche khisakna, project pixels me. Rina (-) = upar. */
  y: number;
  /** Ghumav, degree me. */
  rotation: number;
  /** Kitna dikhe — 1 = poora. */
  opacity: number;
  /** Ye cheez screen par kaise aaye — dekho `ElementEntry`. */
  entry: ElementEntry;
  /** Is cheez par rang ka effect mat lagao. */
  noEffect: boolean;
  /** Ye cheez reel me dikhni hi nahi chahiye. */
  hidden: boolean;
}

/** Kuch nahi badla — har naye tweak ki shuruaat yahin se hoti hai. */
export const NO_TWEAK: SceneTweak = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  entry: NO_ENTRY,
  noEffect: false,
  hidden: false,
};

/** Is tweak me kuch hai bhi ya wo `NO_TWEAK` ke barabar hai? */
export function tweakIsEmpty(tweak: SceneTweak | undefined | null): boolean {
  if (!tweak) return true;
  return (
    tweak.scale === 1 &&
    tweak.x === 0 &&
    tweak.y === 0 &&
    tweak.rotation === 0 &&
    tweak.opacity === 1 &&
    (tweak.entry?.kind ?? "inherit") === "inherit" &&
    !tweak.noEffect &&
    !tweak.hidden
  );
}

/**
 * Scene ke andar ek cheez ki **pehchaan** — `"image:0"`, `"text:1"`.
 *
 * ⚠️ Item ki apni `id` yahan kaam nahi aati, aur wahi is function ki poori
 * wajah hai. Har baar `applyWizard` chalne par scene naye sire se banta hai aur
 * har item ko nayi id milti hai — yaani preview me chuni hui cheez ka tweak
 * agle hi render me kisi ka nahi rehta. Kram `build()` ka hai aur wo har baar
 * wahi hota hai, isliye "is scene ka pehla text" ek tikaau naam hai.
 *
 * ⚠️ Ginti **type ke hisaab se** hai, list ki position se nahi. Position lene par
 * scene me ek caption jud'te hi tasveer ka naam `0` se `1` ho jaata aur uska
 * naap chup-chaap kisi aur cheez par chala jaata.
 *
 * `items` wahi kram me hone chahiye jo `scene.itemIds` me hai — dekho
 * `sceneItemsInOrder`.
 */
export function elementKeyMap(items: readonly Item[]): Record<string, string> {
  const seen: Record<string, number> = {};
  const keys: Record<string, string> = {};
  for (const item of items) {
    const nth = seen[item.type] ?? 0;
    seen[item.type] = nth + 1;
    keys[item.id] = `${item.type}:${nth}`;
  }
  return keys;
}

/** Scene ke items, usi kram me jisme `build()` ne unhe banaya tha. */
export function sceneItemsInOrder(items: readonly Item[], scene: Scene): Item[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return scene.itemIds
    .map((id) => byId.get(id))
    .filter((item): item is Item => item !== undefined);
}

export interface WizardScene {
  /** AI ke script me is scene ka number (0 se). Kabhi nahi badalta. */
  index: number;
  /** `SCENE_TYPES` ka id — jo AI ne chuna. */
  type: string;
  name: string;
  durationSeconds: number;
  /**
   * Aadmi ne haath se tay ki hui lambai — `null` = apne aap (awaaz/AI se).
   *
   * ⚠️ Ye `durationSeconds` se alag field hai, aur wo farak zaroori hai.
   * `durationSeconds` AI ka andaaza hai; ise badalne par pata nahi chalta ki
   * lambai kisne chuni — aadmi ne ya AI ne. Do alag field rehne se "apne aap"
   * par wapas jaana ek tap hai, aur wizard bata sakta hai ki abhi kaun chala
   * raha hai.
   *
   * ⚠️ Aadmi ka likha hua number **jeetta hai** — awaaz se bhi bada. Wajah:
   * reel ki lambai kaabu me rakhna is chunav ka poora maqsad hai, aur "tumhara
   * number maana nahi gaya kyunki awaaz badi thi" ka matlab hota ki control hai
   * hi nahi. Par us halat me awaaz kat sakti hai — isliye wahan `sceneAdvice`
   * saaf chetavni deta hai, chup-chaap kaatne ki jagah.
   */
  durationOverrideSeconds: number | null;
  /** Screen par dikhne wala / bola jaane wala text. Aadmi badal sakta hai. */
  text: string;
  /** AI ke diye baaki slots (role naam ke saath), jaise ke waise. */
  slots: Record<string, string>;

  /**
   * Peeche chalne wali tasveer — **scene ke visual se alag cheez** (26.27).
   *
   * ⚠️ Ise `visualAssetId` me mila dena sabse aasan tha aur sabse galat. Scene ka
   * visual wo hai jo scene *hai* (ek tasveer, ek video, ek screen recording);
   * background wo hai jo uske **peeche** chalta hai. Ek hi khaana rakhne par CTA
   * jaise scene par — jiska apna visual hai hi nahi — dono ek doosre ki jagah le
   * lete, aur aadmi ko sirf itna dikhta ki uski tasveer "kahin aur" chali gayi.
   *
   * ⚠️ Har scene par ho sakti hai, kisi par bhi nahi — dono theek hain. Ye ek
   * **chunav** hai, koi zaroori khaana nahi: `null` ka matlab hai "peeche kuch
   * nahi", aur wahi default hai.
   */
  backgroundAssetId: string | null;

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
   * Usi file ki **frame me fit ki hui** copy — `null` = abhi nahi bani (ya nahi chahiye).
   *
   * ⚠️ `visualAssetId` wahi rehti hai jo aadmi ne chuni thi, aur wo jaan-boojhkar
   * hai: picker me uski apni file dikhni chahiye, humari banayi hui nahi. Reel me
   * jo sach me jaata hai wo `visualAssetOf()` deta hai — fit wali, ho to.
   *
   * ⚠️ Fit ki hui file asli ke **upar** nahi likhi jaati, uske bagal me banti hai.
   * Upar likh dene par aadmi ki apni file hamesha ke liye kat/dab kar reh jaati,
   * aur harkat badalne par usi kati hui file se dobara fit hoti — nuksaan har
   * baar jud'ta jaata. Alag rakhne se fit hatana ek tap hai.
   */
  visualFitAssetId: string | null;
  /**
   * Fit karna hi nahi hai — aadmi ne asli file par wapas jaana chuna.
   *
   * ⚠️ Ye field is liye hai ki "abhi tak fit nahi hui" aur "fit nahi karni hai"
   * do alag halat hain, aur dono me `visualFitAssetId` `null` hota hai. Bina iske
   * fit hatate hi wo apne aap dobara ban jaati thi — yaani wo button dabta tha
   * par lagta nahi tha (README rule 5), aur har baar ek naya encode bhi kharch
   * hota tha.
   *
   * ⚠️ Ye per-scene hai, poori reel ka nahi. Ek hi reel me ek chaudi tasveer ko
   * fit karna theek hota hai aur ek poster ko nahi — wo faisla us tasveer ka hai,
   * reel ka nahi.
   */
  visualFitOff: boolean;
  /**
   * Jab tasveer/video frame me poori nahi bharti, to bache hue kinare kaise
   * bharein — `null` = uski hi dhundhli copy (default).
   *
   * ⚠️ Ye chunav **sirf tab maayne rakhta hai jab kinare sach me bachte hon**
   * (`contain`). Poora bharne wali tasveer par ye kuch nahi karta, aur usi wajah
   * se UI use wahan dikhata bhi nahi — ek dikhta hua control jo kuch na kare, wo
   * toota hua control hai.
   *
   * ⚠️ Default dhundhli copy hi rehta hai, aur wo soch kar hai: 16:9 footage ko
   * 9:16 reel me daalne par wahi sabse kam khatakta hai. Rang chunna behtar tab
   * hota hai jab reel ka apna ek pakka rang ho — aur wo aadmi jaanta hai, hum
   * nahi.
   */
  containBackground: { kind: string; value: string | null } | null;
  /**
   * Jo fit abhi lagi hai, wo **kis maang par** bani thi.
   *
   * ⚠️ Ye sirf hisaab bachane ke liye nahi hai. Iske bina UI ko ye pata hi nahi
   * chalta ki maujooda fit abhi wali maang ki hai ya kisi purani ki — aur uska
   * ek hi imaandaar jawab bachta tha: har baar dobara poochho. Nateeja ye tha ki
   * Tasveer wale step par lautte hi har qatar "fit ho rahi hai…" dikhati thi,
   * jabki kuch ho hi nahi raha hota tha (server cache se turant wahi file
   * lautati thi). Ek nishaan jo bina kaam ke chamakta ho, wo dhire-dhire padha
   * jaana band ho jaata hai.
   *
   * Isme wahi cheezein hain jo `fitCacheKey` me hain — file, naap, cover/contain,
   * aur video ka chuna hua hissa.
   */
  visualFitKey: string | null;
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
   * Awaaz ka kaunsa hissa lena hai — file ke andar ka waqt (26.28).
   *
   * ⚠️ `null` matlab poori awaaz, aur wo aam haalat hai. Ye field is liye aayi ki
   * TTS aur apni recording dono me aksar **kinare** kharab hote hain: shuru me ek
   * lambi saans ya "umm", ant me ek adhoora shabd jo dobara banane par bhi wahi
   * rehta. Uska ek hi ilaaj bacha tha — poora editor kholo, clip dhoondho, dono
   * taraf se kheencho — yaani theek wo kaam jisse bachne ke liye wizard bana hai.
   *
   * ⚠️ Ye kaat **file ko nahi badalti**, sirf ye batati hai ki uska kaunsa hissa
   * bajega (`trimItemToSourceRange`). Isliye kaat hatana ek tap hai, aur wahi
   * asli file har waqt bachi rehti hai — video ke `visualTrim` wala hi niyam.
   *
   * ⚠️ Scene ki lambai bhi isi se banti hai (`voiceSeconds`). Bina uske aadmi
   * awaaz me se 2 second kaat deta aur scene wahi purani lambai ka reh jaata —
   * yaani ant me do second ki chuppi, jo sunne me "reel atak gayi" jaisi lagti
   * hai.
   */
  voiceTrim: { startSeconds: number; endSeconds: number } | null;
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
   * Is scene par awaaz kitni tez — 1 = jaisi bani thi, 0 = chup.
   *
   * ⚠️ Ye per-scene hai (baaki awaaz ke chunav poori reel ke liye ek hain), aur
   * wo jaan-boojhkar hai: "is line par zor do" aur "ye line dhime se" ek scene ka
   * faisla hai, poori reel ka nahi. Aur 0 ka apna matlab hai — us scene par sirf
   * music aur tasveer, koi bolne wala nahi.
   */
  voiceVolume: number;
  /**
   * Is scene ke andar bolne wale ka safar — khaali = ek hi level poore scene par.
   *
   * ⚠️ Ye music wale se alag field hai, ek nahi. Aksar dono ek doosre ke ulte
   * chalte hain (bolne wala uthta hai to dhun neeche jaati hai), aur ek hi list
   * rakhne par wo likha hi nahi ja sakta.
   */
  voiceVolumePoints: VolumePoint[];
  /**
   * Is scene ka apna gaana — `null` = poori reel wala (draft ka).
   *
   * ⚠️ Ye `WizardDraft.musicAssetId` ki jagah nahi leta, uske **upar** baithta
   * hai. 90% reel me ek hi dhun poore video par chalti hai, aur wo chunav ek hi
   * baar hona chahiye — har scene par gaana poochhne par aadmi teesre scene par
   * chhod deta hai. Par kuch reel do hisson ki hoti hain (samasya, phir hal), aur
   * wahan dhun ka badalna hi wo mod dikhata hai.
   *
   * ⚠️ `null` aur "wahi gaana jo reel ka hai" do alag cheezein hain. `null` par
   * reel ka music badalne se ye scene bhi saath badalta hai; id likh dene par wo
   * yahin jam jaata hai — jo tabhi theek hai jab aadmi ne sach me chuna ho.
   */
  musicAssetId: string | null;
  /**
   * Is scene ke andar music ka safar — khaali = ek hi level poore scene par.
   *
   * ⚠️ Dekho `VolumePoint`. Khaali list aur `[{ atSeconds: 0, ... }]` do alag
   * cheezein hain: khaali par ek bhi keyframe nahi likha jaata, aur wo sirf
   * saaf-suthrapan nahi hai — bina keyframe ke Remotion volume ek hi baar naapta
   * hai, har frame par nahi.
   */
  musicVolumePoints: VolumePoint[];
  /**
   * Is scene par music kitna tez — `null` = poori reel wala (draft ka).
   *
   * ⚠️ `null` aur `0` do alag cheezein hain, aur ye farak zaroori hai. `null`
   * matlab "isme kuch khaas nahi, jo poori reel me chal raha hai wahi" — baad me
   * poori reel ka music kam karo to ye scene bhi saath me kam ho jaata hai. `0`
   * matlab "yahan music **band**", chahe baaki reel me kuch bhi chal raha ho — wo
   * aksar us scene par lagta hai jahan koi zaroori baat boli ja rahi hai.
   */
  musicVolume: number | null;
  /**
   * Kis text se awaaz bani thi.
   *
   * ⚠️ Iske bina 26.9 ka nishaan lagana namumkin hai: text badalne ke baad bani
   * hui awaaz purane shabdon ki reh jaati hai, aur wo galti kahin dikhti nahi.
   */
  voiceForText: string | null;
  /**
   * Kis awaaz (category) se ye bani thi — `VOICE_CATEGORIES` ka id.
   *
   * ⚠️ `null` ke do matlab hain aur dono theek hain: ya to awaaz aadmi ki apni
   * file hai (upload/library), ya wo tab bani thi jab ye field tha hi nahi.
   * Dono me "kaunsi awaaz thi" ka jawab hai hi nahi, isliye uspar chetavni bhi
   * nahi lagti — jhoothi chetavni ka anjaam hamesha ek hi hota hai.
   *
   * ⚠️ Iske bina 26.9 ka doosra aadha hissa pakda hi nahi jaata. Text badalne
   * par nishaan lagta tha, par **awaaz ka chunav** badalne par nahi: aadmi
   * "Aurat" par teen scene banata, dropdown "Aadmi" par le jaata (ya step
   * badalne par wo khud reset ho jaata tha), baaki chaar banata — aur reel me
   * beech se bolne wala badal jaata tha. Wo galti sirf reel sun kar pakdi jaati
   * hai.
   */
  voiceCategoryId: string | null;

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
   * Rang ka effect — `EFFECT_PRESETS` ka id. `null` = koi nahi.
   *
   * ⚠️ Ye `autoFill` se **kabhi nahi** bharta, aur wo animation se ulta hai. Har
   * scene par apne aap ek effect laga dena poori reel ka rang badal deta hai, aur
   * aadmi ko wajah kabhi samajh nahi aati ("tasveerein aisi thi hi nahi") — jabki
   * animation ka na hona reel ko sthir aur mari hui bana deta hai. Isliye harkat
   * ki sifaarish hai, rang ki nahi.
   */
  effectPresetId: string | null;

  /**
   * Screen par text mat dikhao — sirf bolo.
   *
   * WARNING: Ye sirf tab lagta hai jab scene me tasveer ho (dekho `textHidden`).
   * Bina tasveer ke text chhupane par scene me kuch bachta hi nahi - ek kaala
   * frame jispar awaaz chalti hai. Wo chunav aadmi jaan-boojhkar nahi karta,
   * isliye wo lagne bhi nahi diya jaata.
   */
  hideText: boolean;

  /**
   * Preview me chun kar kiye hue sudhaar — key `elementKeyMap` se (26.28).
   *
   * ⚠️ Khaali record ka matlab "kuch haath se nahi badla", aur wo aam haalat
   * hai. Har element ka khaana pehle se bana dena aasan tha aur do cheezein
   * todta: draft teen guna bada ho jaata (jiska poora fayda sifar hai), aur
   * "kuch badla hai ya nahi" ka jawab har jagah ek-ek field ginn kar nikalna
   * padta — jabki abhi wo sirf ek `Object.keys().length` hai.
   */
  tweaks: Record<string, SceneTweak>;

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
  /**
   * Do scene ke beech ki saans (second) — 0 = ek ke baad ek, bilkul chipke hue.
   *
   * ⚠️ Ye **khaali (kaala) waqt nahi hai**, aur ye farak is poore field ki jaan
   * hai. Beech me sach me gap chhodne par reel me ek kaala frame aata hai aur wo
   * "video atak gayi" jaisa lagta hai — sabse bura wala nateeja. Yahan gap us
   * scene ki apni lambai me jud jaata hai: tasveer utni der aur thehri rehti hai,
   * awaaz apne waqt par khatam ho jaati hai. Yaani saans milti hai, khalaa nahi.
   *
   * ⚠️ Aakhri scene par gap nahi lagta. Wahan wo reel ke ant me ek thehra hua
   * frame ban jaata hai, jise dekhne wala "khatam ho gaya par ruka hua hai"
   * samajhta hai.
   *
   * ⚠️ Default 0 hai. Reels ki chaal tez hoti hai; har scene ke baad aadha second
   * jodna 8 scene par 4 second bekaar ke jod deta hai.
   */
  gapSeconds: number;
  /**
   * Poori reel ke peeche chalne wala music — `null` = koi nahi.
   *
   * ⚠️ Ye poori reel ka **default** hai, aur aam haalat me akela chunav bhi. Har
   * scene par gaana poochhna reel ko jode hue tukdon ka dher bana deta hai, aur
   * aadmi teesre scene par wo chunav chhod deta hai. Isliye chunav yahan ek baar
   * hota hai; jise sach me alag chahiye wo `WizardScene.musicAssetId` se apne
   * scene par usse upar likh sakta hai.
   *
   * ⚠️ Ye wizard me isliye hai ki bina iske reel ka aadha asar hi nahi banta —
   * chup reel dekhne wale ko adhoori lagti hai — aur uske liye aadmi ko poora
   * editor kholna padta tha: track banao, clip daalo, volume set karo, loop
   * karo. Wizard ka poora vaada hi ye hai ki wo na karna pade.
   */
  musicAssetId: string | null;
  /**
   * Music ka level — 0 se 1. Default halka hai, aur wo jaan-boojhkar hai.
   *
   * ⚠️ 0.15 par music **peeche** rehta hai. Uske upar wo bolne wale se ladta hai,
   * aur us ladai me hamesha bolne wala haarta hai: dekhne wale ko lagta hai ki
   * "awaaz saaf nahi hai", jabki awaaz bilkul saaf hoti hai — music tez hota hai.
   * Ye galti banane wale ko kabhi sunai nahi deti, kyunki use pata hota hai ki
   * kya bola ja raha hai.
   */
  musicVolume: number;
  /**
   * Poori reel ki awaaz ka chunav — `VOICE_CATEGORIES` ka id, `null` = abhi nahi chuna.
   *
   * ⚠️ Ye draft me hai, kisi step ke `useState` me nahi — aur wo ek asli bug ka
   * ilaaj hai. Pehle ye Awaaz wale step ke andar rehta tha: aadmi "Aurat" chunta,
   * teen scene banata, "Dekho" par jaakar wapas aata — aur step dobara banne par
   * chunav pehli category ("Aadmi") par gir jaata tha. Baaki chaar scene us nayi
   * awaaz me ban jaate the, aur reel ke beech se bolne wala badal jaata tha.
   * Screen par kahin kuch galat nahi dikhta tha; wo galti sirf reel sun kar
   * pakdi jaati hai.
   *
   * ⚠️ Ye per-scene nahi hai, aur wo jaan-boojhkar hai — ek hi reel me har scene
   * ka bolne wala badalta rahe to wo reel tooti hui lagti hai.
   */
  voiceCategoryId: string | null;
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
/**
 * ⚠️ `background` yahan se **jaan-boojhkar bahar** hai (26.27). Wo bhi
 * `asset:image` hai, isliye bina is rok ke wo un types me "visual" ban jaata
 * jinme koi aur tasveer wala slot nahi hai (jaise `text`) — aur tab scene ki
 * asli tasveer chup-chaap peeche chali jaati, screen ke beech me kuch na hota,
 * aur aadmi ko sirf itna dikhta ki "tasveer lagi to hai par dikh nahi rahi".
 *
 * Slots ki tarteeb (background hamesha aakhir me) bhi yahi rok lagati hai. Do
 * jagah rokna is liye hai ki naya scene type jodte waqt tarteeb ka dhyan rakhna
 * yaad rahe ya na rahe, ye check phir bhi sahi jawab dega.
 */
const BACKGROUND_SLOT_ID = "background";

function isVisualSlot(slot: { id: string; kind: string }): boolean {
  if (slot.id === BACKGROUND_SLOT_ID) return false;
  return slot.kind === "asset:image" || slot.kind === "asset:video";
}

export function visualSlotId(typeId: string): string | null {
  const type = getSceneType(typeId);
  return type?.slots.find(isVisualSlot)?.id ?? null;
}

/** Wo slot tasveer maangta hai ya video — picker aur label dono isse tay hote hain. */
export function visualSlotKind(typeId: string): "image" | "video" | null {
  const type = getSceneType(typeId);
  const slot = type?.slots.find((entry) =>
    isVisualSlot(entry),
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

/**
 * Bina AI ke khaali draft — ek saada scene, aur bas (26.27).
 *
 * ⚠️ Ye wizard ko AI se **alag** karta hai, aur yehi is function ka poora maqsad
 * hai. Pehle wizard sirf tab khulta tha jab AI ki script aa chuki ho, yaani ek
 * scene khud likhne ke liye bhi ek API call karni padti thi — aur wo call paise
 * bhi leti thi aur waqt bhi. Jise sirf apni tasveer aur apna text lagana hai,
 * usse AI ki keemat kyun chukwayi jaaye.
 *
 * ⚠️ Pehla scene `blankScene()` se aata hai — wahi function jo "+" wala button
 * chalata hai. Ise alag se likhna aasan tha, par tab pehla scene aur joda hua
 * scene do alag cheezein ban jaate: ek din unme se ek me koi naya field chhoot
 * jaata, aur wo galti "khaali wizard me feature X kaam hi nahi karta" bankar
 * aati — sirf pehle scene par, jise pakadna sabse mushkil hota hai.
 *
 * ⚠️ `summary` khaali hai, koi bhara hua vaakya nahi. Wo hissa UI me tabhi
 * dikhta hai jab usme kuch ho, aur yahan dikhane ko kuch hai bhi nahi — AI ne
 * kuch socha hi nahi. "Apni reel banao" jaisi line wahan bhar dena us jagah ko
 * ek bekaar heading bana deta jise aadmi doosri baar se padhna chhod deta hai.
 */
export function emptyDraft(): WizardDraft {
  return {
    summary: "",
    textScale: 1,
    textColor: null,
    replaceExisting: false,
    gapSeconds: 0,
    musicAssetId: null,
    musicVolume: 0.15,
    // `draftFromScript` ki tarah yahan bhi `null` — awaaz ka chunav Awaaz wala
    // step khulte hi hota hai, pehle se koi default thopna nahi.
    voiceCategoryId: null,
    scenes: [blankScene(0)],
  };
}

/** AI ke script se pehla draft. */
export function draftFromScript(script: AiScript): WizardDraft {
  return {
    summary: script.summary,
    textScale: 1,
    textColor: null,
    replaceExisting: false,
    gapSeconds: 0,
    musicAssetId: null,
    musicVolume: 0.15,
    /*
     * ⚠️ Yahan `null` hai, koi default category nahi — aur wo farak asli hai.
     * Koi ek awaaz pehle se chun dene par UI ke paas ye batane ka tarika nahi
     * rehta ki aadmi ne wo sach me chuni thi ya wo bas pehli likhi hui thi. Step
     * khulte hi pehli maujood category is field me likh di jaati hai, aur uske
     * baad wo wahin tikti hai.
     */
    voiceCategoryId: null,
    scenes: script.scenes.map((scene, index) => {
      const textSlot = textSlotId(scene.type);
      const rest: Record<string, string> = { ...scene.slots };
      if (textSlot) delete rest[textSlot];

      return {
        index,
        type: scene.type,
        name: scene.name,
        durationSeconds: scene.durationSeconds,
        durationOverrideSeconds: null,
        text: (textSlot ? scene.slots[textSlot] : "") ?? "",
        slots: rest,
        backgroundAssetId: null,
        visualAssetId: null,
        visualAssetKind: null,
        visualFitAssetId: null,
        visualFitOff: false,
        containBackground: null,
        visualFitKey: null,
        visualSize: null,
        visualTrim: null,
        phoneFrame: false,
        textPosition: "center",
        voiceAssetId: null,
        voiceSeconds: null,
        voiceTrim: null,
        voiceRate: 1,
        voiceVolume: 1,
        voiceVolumePoints: [],
        musicVolume: null,
        musicVolumePoints: [],
        voiceForText: null,
        voiceCategoryId: null,
        musicAssetId: null,
        hideText: false,
        animationPresetId: null,
        transitionId: null,
        effectPresetId: null,
        tweaks: {},
        removed: false,
      };
    }),
  };
}

/* --------------------------------------------- scene jodna aur upar-neeche */

/**
 * Naye scene ka number.
 *
 * ⚠️ `scenes.length` se ginna galat hai aur wo galti chup-chaap kaam karti hui
 * dikhti hai: hataye hue scene bhi list me pade rehte hain, aur ek scene hata kar
 * naya jodne par wahi number dobara ban jaata. Do scene ka ek hi `index` hone par
 * `update()` dono ko badalta hai — aadmi ek scene ka text likhta hai aur wo do
 * jagah likha jaata hai. Isliye ginti **sabse bade number se aage** hoti hai.
 */
export function nextSceneIndex(draft: WizardDraft): number {
  return draft.scenes.reduce((max, scene) => Math.max(max, scene.index), -1) + 1;
}

/**
 * Ek khaali scene — jise aadmi khud bharega.
 *
 * ⚠️ Type `text` hai, `image_audio` nahi. Naya scene banate waqt aadmi ke paas
 * abhi kuch nahi hota; `image_audio` ka tasveer wala slot **required** hai, aur us
 * scene par kuch daale bina "Editor me daalo" dabane par wo chup-chaap chhoot
 * jaata ("zaroori slot khaali"). `text` har haalat me ban jaata hai, aur tasveer
 * ya awaaz lagte hi `effectiveType()` khud use upar chadha deta hai.
 */
export function blankScene(index: number): WizardScene {
  return {
    index,
    containBackground: null,
    type: "text",
    name: `Scene ${index + 1}`,
    /*
     * 3 second — ek line padhne layak. Ye `getSceneType("text")` ke default se
     * jaan-boojhkar alag nahi hai; wahi number lena theek hai par yahan likha
     * hona zaroori hai, warna khaali scene 0s ka ban kar timeline me dikhta hi
     * nahi.
     */
    durationSeconds: 3,
    durationOverrideSeconds: null,
    text: "",
    slots: {},
    backgroundAssetId: null,
    visualAssetId: null,
    visualAssetKind: null,
    visualFitAssetId: null,
    visualFitOff: false,
    visualFitKey: null,
    visualSize: null,
    visualTrim: null,
    phoneFrame: false,
    textPosition: "center",
    voiceAssetId: null,
    voiceSeconds: null,
    voiceTrim: null,
    voiceRate: 1,
    voiceVolume: 1,
    voiceVolumePoints: [],
    musicVolume: null,
    musicVolumePoints: [],
    voiceForText: null,
    voiceCategoryId: null,
    musicAssetId: null,
    hideText: false,
    animationPresetId: null,
    transitionId: null,
    effectPresetId: null,
    tweaks: {},
    removed: false,
  };
}

/**
 * Naya scene daalo — kisi maujooda scene ke **theek baad**.
 *
 * ⚠️ Jagah `index` se nahi, list ki asli position se tay hoti hai. `index` sirf
 * pehchaan hai (wo kabhi nahi badalta), isliye usse "kaunsa scene teesra hai" ka
 * jawab nahi milta — aur upar-neeche karne ke baad to bilkul nahi.
 *
 * `afterIndex` `null` ho to sabse aakhir me.
 */
export function insertSceneAfter(draft: WizardDraft, afterIndex: number | null): WizardDraft {
  const fresh = blankScene(nextSceneIndex(draft));
  if (afterIndex === null) return { ...draft, scenes: [...draft.scenes, fresh] };

  const at = draft.scenes.findIndex((scene) => scene.index === afterIndex);
  if (at === -1) return { ...draft, scenes: [...draft.scenes, fresh] };

  const scenes = [...draft.scenes];
  scenes.splice(at + 1, 0, fresh);
  return { ...draft, scenes };
}

/**
 * Scene ko ek kadam upar / neeche karo (`delta` = -1 / +1).
 *
 * ⚠️ Padosi **bacha hua** (non-removed) scene hai, list ka seedha padosi nahi. Ye
 * chala kar dekhne par nikla: beech ka ek scene hata dene ke baad "upar karo"
 * dabane par kuch hota hi nahi dikhta — wo hataye hue scene se jagah badal leta
 * hai, jo screen par kahin dikhta hi nahi. Aadmi dobara dabata hai, phir dobara,
 * aur samajhta hai ki button toota hua hai.
 *
 * ⚠️ Hataye hue scene apni jagah par pade rehte hain (unhe khiskaya nahi jaata) —
 * "wapas laao" par wo apne purane padosi ke paas hi wapas aate hain.
 */
export function moveScene(draft: WizardDraft, index: number, delta: -1 | 1): WizardDraft {
  const from = draft.scenes.findIndex((scene) => scene.index === index);
  if (from === -1 || draft.scenes[from]?.removed) return draft;

  let to = from + delta;
  while (to >= 0 && to < draft.scenes.length && draft.scenes[to]?.removed) to += delta;
  if (to < 0 || to >= draft.scenes.length) return draft;

  const scenes = [...draft.scenes];
  const a = scenes[from];
  const b = scenes[to];
  if (!a || !b) return draft;
  scenes[from] = b;
  scenes[to] = a;
  return { ...draft, scenes };
}

/** Ye scene upar/neeche ja sakta hai? — UI ke button isse mard/zinda hote hain. */
export function canMoveScene(draft: WizardDraft, index: number, delta: -1 | 1): boolean {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const at = live.findIndex((scene) => scene.index === index);
  if (at === -1) return false;
  return delta === -1 ? at > 0 : at < live.length - 1;
}

/**
 * Bani hui awaaz **kis wajah se** purani ho chuki hai (26.9 / 26.25).
 *
 * `null` = taaza hai. Warna do me se ek wajah:
 *
 *  - `"text"`   — awaaz banne ke baad shabd badal gaye
 *  - `"choice"` — shabd wahi hain, par ab poori reel par doosri awaaz chuni hai
 *
 * ⚠️ Do wajah alag rakhi gayi hain kyunki unke **ilaaj alag hain aur nateeje
 * bhi**. Text badalne par awaaz aur likha hua ek doosre se ulat jaate hain (sabse
 * bura wala nateeja, aur scene ki lambai bhi jhoothi ho jaati hai). Chunav badalne
 * par jo bola gaya hai wo bilkul theek hai — bas reel ke beech se bolne wala badal
 * jaata hai. Dono par ek hi line dikhana matlab aadhi baat har baar galat dikhana.
 *
 * ⚠️ Text trim kar ke milaya jaata hai — aage-peeche ka space badal jaana aam hai
 * (aadmi text ke ant me enter daba deta hai), aur uspar "awaaz purani hai" ka
 * laal nishaan dikhana ek jhoothi chetavni hai. Jhoothi chetavni ka anjaam
 * hamesha ek hi hota hai: kuch dinon me use koi padhta hi nahi.
 *
 * ⚠️ Jis awaaz ka `voiceCategoryId` `null` hai uspar chunav wali chetavni kabhi
 * nahi lagti. Wo aadmi ki apni upload ki hui file hai (ya us waqt ki bani hui jab
 * ye field tha hi nahi) — uske liye "kaunsi awaaz thi" ka jawab hai hi nahi, aur
 * na hone ko galat bata dena jhooth hai.
 */
export type VoiceStaleReason = "text" | "choice";

export function voiceStaleReason(
  scene: WizardScene,
  draft?: Pick<WizardDraft, "voiceCategoryId"> | null,
): VoiceStaleReason | null {
  if (!scene.voiceAssetId) return null;
  if (scene.voiceForText !== null && scene.voiceForText.trim() !== scene.text.trim()) {
    return "text";
  }
  const want = draft?.voiceCategoryId ?? null;
  if (want && scene.voiceCategoryId && scene.voiceCategoryId !== want) return "choice";
  return null;
}

/**
 * Sirf **shabd** badle hain? — lambai ka hisaab isi par chalta hai.
 *
 * ⚠️ Ye `voiceStale` se alag hai aur alag hona zaroori hai. Awaaz ka chunav
 * badalne par file ki lambai bilkul sahi rehti hai (wahi shabd, doosri awaaz),
 * isliye scene ki lambai usse hilni nahi chahiye. Text badalne par wo lambai
 * purane shabdon ki ho jaati hai — aur usi par scene bandha ho to reel chup-chaap
 * galat lambai ki ban jaati hai.
 */
export function voiceTextStale(scene: WizardScene): boolean {
  return voiceStaleReason(scene) === "text";
}

export function voiceStale(
  scene: WizardScene,
  draft?: Pick<WizardDraft, "voiceCategoryId"> | null,
): boolean {
  return voiceStaleReason(scene, draft) !== null;
}

/**
 * Is scene par text sach me chhupega?
 *
 * WARNING: `hideText` akela kaafi nahi hai. Bina kisi cheez ke text chhupane ka
 * matlab hai ek KHAALI scene - kaala frame jispar kuch nahi. Aadmi wo maangta
 * nahi; wo aksar tab hota hai jab usne pehle text chhupaya aur baad me tasveer
 * hata di. Isliye do shart hain, ek nahi.
 *
 * ⚠️ Awaaz bhi ginti hai, sirf tasveer nahi — aur ye badla hua hai. Pehle yahan
 * sirf `visualAssetId` dekha jaata tha, jiska nateeja ye tha ki jis scene par
 * sirf awaaz thi wahan text chhupaya hi nahi ja sakta tha: aadmi "chhupa do"
 * dabata, screen par "Chhupa hua" likha aata, aur reel me text phir bhi dikhta.
 * Ek chunav jo dabta hai par lagta nahi, toote hue button jaisa hi hai.
 *
 * Sirf awaaz wala scene jaan-boojhkar chalne diya jaata hai: kuch line aisi hoti
 * hain jo sirf suni jaani chahiye (brand ka background frame me rehta hai, kaala
 * nahi). Jahan awaaz bhi na ho, wahan `sceneAdvice` chetavni deta hai.
 */
export function textHidden(scene: WizardScene): boolean {
  return scene.hideText && Boolean(scene.visualAssetId || scene.voiceAssetId);
}

/**
 * Reel me sach me kaunsi file jaayegi — fit wali, ya asli (26.25).
 *
 * ⚠️ Ye ek hi jagah hai jahan ye faisla hota hai, aur wahi iski poori wajah hai.
 * Do jagah likhne par wo ek din alag ho jaate hain: wizard fit ki hui file ki
 * chetavni dikhata aur reel me asli chali jaati — aur wo farak sirf bani hui reel
 * dekh kar pakda jaata.
 */
export function visualAssetOf(scene: WizardScene): string | null {
  return scene.visualFitAssetId ?? scene.visualAssetId;
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
/**
 * File me se kitni awaaz sach me bajegi — kaat laga kar (26.28).
 *
 * `null` = awaaz hai hi nahi (ya uski lambai pata nahi).
 *
 * ⚠️ Kaat file ki apni lambai ke andar hi baandhi jaati hai. Ek purana draft
 * (jisme kaat kisi aur, lambi file ki likhi hai) yahan bina hadd ke nikal jaata
 * to scene us awaaz se lamba ban jaata jo hai hi nahi — yaani ant me chuppi, aur
 * uski wajah kahin dikhti nahi.
 */
export function voiceSourceSeconds(scene: WizardScene): number | null {
  if (!scene.voiceAssetId || !scene.voiceSeconds || scene.voiceSeconds <= 0) return null;
  if (!scene.voiceTrim) return scene.voiceSeconds;

  const start = Math.max(0, Math.min(scene.voiceTrim.startSeconds, scene.voiceSeconds));
  const end = Math.max(start, Math.min(scene.voiceTrim.endSeconds, scene.voiceSeconds));
  const cut = end - start;
  return cut > 0 ? cut : scene.voiceSeconds;
}

export function voiceSeconds(scene: WizardScene): number | null {
  const source = voiceSourceSeconds(scene);
  if (source === null) return null;
  const rate = scene.voiceRate > 0 ? scene.voiceRate : 1;
  return source / rate + VOICE_TAIL_SECONDS;
}

/**
 * Wahi lambai — **par sirf tab jab wo abhi bhi sach ho** (26.25).
 *
 * `null` = ya to awaaz hai hi nahi, ya wo purane shabdon ki hai.
 *
 * ⚠️ Ye function ek asli, chup-chaap chalne wali galti rokta hai. Text badalne ke
 * baad file wahi purani padi rehti hai, aur uski naapi hui lambai bhi wahi. Us
 * lambai par scene bandha rehne ka nateeja ye tha ki **Shabd wale step me kuch
 * badalta hi nahi dikhta**: aadmi 12 shabd ki line ko 30 shabd ka bana deta tha
 * aur scene 5.2s ka hi likha rehta tha, uspar "naapi hui" ka thappa bhi laga
 * hota tha. Yaani screen wo number pakka bata rahi thi jo ab kisi aur text ka
 * tha.
 *
 * Ab wo lambai girte hi scene naye shabdon ke andaaze par aa jaata hai (`~`
 * ke saath), aur awaaz dobara banate hi wapas naap par. Yaani ek hi niyam: jo
 * number dikh raha hai wo hamesha usi text ka hai jo abhi likha hai.
 */
export function usableVoiceSeconds(scene: WizardScene): number | null {
  if (voiceTextStale(scene)) return null;
  return voiceSeconds(scene);
}

/** Scene itne se lamba bhi nahi — haath se likha number bhi is hadd me aata hai. */
export const MAX_SCENE_SECONDS = 30;

/**
 * Bolne me kitna waqt lagega — **awaaz banne se pehle** (26.24).
 *
 * ⚠️ Ye andaaza hai, naap nahi, aur ye farak har jagah likha jaata hai ("~"). Par
 * andaaza bhi kuch na hone se bahut behtar hai: is field ke bina aadmi ek scene
 * par teen line likh deta hai, "Awaaz banao" dabata hai, aur tab pata chalta hai
 * ki wo ek line 11 second ki hai — yaani poori reel ka hisaab bigad gaya. Ab wo
 * likhte hi dikh jaata hai.
 *
 * ⚠️ Raftaar (`words/second`) Hindi-Hinglish bolne ki hai, angrezi ki nahi.
 * TTS ki aawaz aaram se bolti hai — 2.3 shabd/second naap kar liya gaya hai
 * (Gemini ki awaaz, aam reel wali line). Angrezi ke liye aam number ~2.8 hai;
 * usse hisaab lagane par har scene chhota andaaza deta aur wo galti hamesha ek hi
 * taraf hoti — reel lambi banti.
 */
const WORDS_PER_SECOND = 2.3;

export function estimateSpeechSeconds(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const speed = rate > 0 ? rate : 1;
  return words / WORDS_PER_SECOND / speed + VOICE_TAIL_SECONDS;
}

export function sceneSeconds(scene: WizardScene): number {
  /*
   * ⚠️ Aadmi ka likha hua number sabse pehle, aur wo awaaz se bhi jeetta hai.
   * Ulta karne par (awaaz ko jitane dene par) "scene 4 second ka karo" ka koi
   * matlab nahi rehta jab awaaz 7 second ki ho — aur yahi wo halat hai jisme
   * aadmi lambai badalta hai. Awaaz kat sakti hai; uski chetavni `sceneAdvice`
   * deta hai, chup-chaap kaatna nahi hota.
   */
  if (scene.durationOverrideSeconds !== null) {
    return Math.min(
      MAX_SCENE_SECONDS,
      Math.max(MIN_SCENE_SECONDS, scene.durationOverrideSeconds),
    );
  }

  const trimmed = scene.visualTrim
    ? Math.max(0.5, scene.visualTrim.endSeconds - scene.visualTrim.startSeconds)
    : null;

  const voice = usableVoiceSeconds(scene);

  /*
   * ⚠️ Awaaz purane shabdon ki ho to uski lambai **nahi** ginti, par AI ka
   * andaaza bhi nahi lagta — naye shabdon ka apna andaaza lagta hai. AI ka
   * `durationSeconds` us script ka hai jo ab badal chuki hai; uspar girne se wo
   * scene aksar 4s par chipak jaata tha chahe aadmi ne usme kitna bhi likh diya
   * ho.
   */
  if (voice === null) {
    const guess = voiceTextStale(scene) ? estimateSpeechSeconds(scene.text, scene.voiceRate) : 0;
    return Math.max(MIN_SCENE_SECONDS, guess, trimmed ?? scene.durationSeconds);
  }
  return Math.max(MIN_SCENE_SECONDS, voice, trimmed ?? 0);
}

/** Gap itne se zyada nahi — usse aage reel me "atak gayi" jaisa lagta hai. */
export const MAX_GAP_SECONDS = 1.5;

/** Draft ka gap, hadd me baandha hua — UI kuch bhi bhej de to bhi. */
export function gapSecondsOf(draft: WizardDraft): number {
  const gap = draft.gapSeconds;
  if (!Number.isFinite(gap) || gap <= 0) return 0;
  return Math.min(MAX_GAP_SECONDS, gap);
}

/**
 * Is scene ki poori lambai — gap ke saath.
 *
 * `isLast` par gap nahi lagta (reel ke ant me wo ek thehra hua frame ban jaata
 * hai, jise dekhne wala "atak gayi" samajhta hai).
 *
 * ⚠️ Ye function wahi hai jo `applyWizard` lagata hai aur wahi jo footer me
 * dikhta hai. Do jagah hisaab likhne par wizard "30 second" bolta aur reel 34 ki
 * banti — aur wo farak sirf export ke baad pakda jaata.
 */
export function sceneSecondsWithGap(
  scene: WizardScene,
  draft: WizardDraft,
  isLast: boolean,
): number {
  return sceneSeconds(scene) + (isLast ? 0 : gapSecondsOf(draft));
}

/**
 * Awaaz aur scene ki lambai ka mel — **ek hi jagah ka hisaab** (26.24).
 *
 * `null` = mel theek hai (ya awaaz hi nahi). Warna:
 *  - `cut` — scene chhota hai, awaaz beech me kat jaayegi
 *  - `silence` — scene bada hai, awaaz ke baad chup baithi rahegi
 *
 * ⚠️ Ye function alag isliye hai ki jawab **do jagah** chahiye: us scene ki
 * chetavni me, aur poore wizard ke footer ki ginti me ("2 scene par mel nahi").
 * Dono jagah alag hadd likhne par footer 2 bolta aur scene par ek hi nishaan
 * dikhta — aur us farak ko koi kabhi samajh nahi paata.
 *
 * ⚠️ Hadd dono taraf alag hai, aur ye jaan-boojhkar hai. Awaaz katna hamesha
 * bura hai, isliye wahan hadd bahut chhoti (0.15s — ek shabd ka hissa). Awaaz ke
 * baad ki chuppi thodi der theek lagti hai (saans), isliye wahan 1.2s tak koi
 * chetavni nahi. Dono taraf ek hi hadd rakhne par ya to aadhi galtiyan chhoot
 * jaati, ya har scene par ek jhoothi chetavni lagti.
 */
export interface VoiceMismatch {
  kind: "cut" | "silence";
  voiceSeconds: number;
  sceneSeconds: number;
  offBySeconds: number;
}

const CUT_TOLERANCE_SECONDS = 0.15;
const SILENCE_TOLERANCE_SECONDS = 1.2;

export function voiceMismatch(scene: WizardScene): VoiceMismatch | null {
  /*
   * ⚠️ Purane shabdon wali awaaz par mel ka hisaab lagana bekaar hai — wo file
   * dobara banegi aur uski lambai badal jaayegi. Us halat me "aakhri 2.1s kat
   * jaayega" dikhana ek aisi ginti hai jo ab kisi cheez ki nahi hai, aur uske
   * saath asli chetavni ("awaaz purani hai") dab jaati hai.
   */
  const voice = usableVoiceSeconds(scene);
  if (voice === null) return null;

  const seconds = sceneSeconds(scene);
  const spare = seconds - voice;

  if (spare < -CUT_TOLERANCE_SECONDS) {
    return { kind: "cut", voiceSeconds: voice, sceneSeconds: seconds, offBySeconds: -spare };
  }
  if (spare > SILENCE_TOLERANCE_SECONDS) {
    return { kind: "silence", voiceSeconds: voice, sceneSeconds: seconds, offBySeconds: spare };
  }
  return null;
}

/** Poori reel kitni lambi banegi — gap jod kar. */
export function draftTotalSeconds(draft: WizardDraft): number {
  const live = draft.scenes.filter((scene) => !scene.removed);
  return live.reduce(
    (sum, scene, at) => sum + sceneSecondsWithGap(scene, draft, at === live.length - 1),
    0,
  );
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
  /**
   * Bane hue doc scene ki id se wapas draft ke scene ka `index`.
   *
   * ⚠️ Iske bina preview me chuni hui cheez ka koi maalik nahi hota. Doc me item
   * ke paas sirf `sceneId` hai, aur wo id har baar naye sire se banti hai —
   * yaani "ye tasveer kis scene ki thi" ka jawab UI ke paas hai hi nahi. Wo
   * jawab yahan banta hai, jahan dono list ek saath haath me hain.
   */
  sceneIndexById: Record<string, number>;
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
    /*
     * ⚠️ Reel me fit ki hui file jaati hai, asli nahi (`visualAssetOf`). Asli
     * `visualAssetId` sirf ye yaad rakhne ke liye hai ki aadmi ne kya chuna tha —
     * usse dobara fit hoti hai jab harkat badalti hai.
     */
    const visualId = visualAssetOf(scene);
    if (visualSlot && visualId) {
      const role = `visual:${scene.index}`;
      slots[visualSlot] = role;
      assetByRole[role] = visualId;
    } else if (visualSlot) {
      delete slots[visualSlot];
    }

    /*
     * Logo — **apne aap, project ke brand se** (26.26).
     *
     * ⚠️ Wizard me logo chunne ka koi khaana kabhi tha hi nahi, isliye CTA wala
     * scene hamesha bina logo ke banta tha — jabki logo project ke brand me pehle
     * se pada hota hai (`doc.brand.logoAssetId`). Aadmi ko wo baad me editor
     * kholkar haath se lagana padta tha, yaani theek wo cheez jisse bachne ke liye
     * wizard bana hai.
     *
     * ⚠️ AI ne kuch likha ho to uspar **nahi** likha jaata. Wo aadmi ka (ya script
     * ka) chunav hai, aur uske upar chup-chaap apna faisla thop dena wahi galti
     * hai jisse `autoFill` bachta hai.
     *
     * ⚠️ Logo par fit ka hisaab **nahi** lagta, aur ye zaroori hai. `sceneTypes`
     * use jaan-boojhkar `contain` par rakhta hai bina dhundhle background ke —
     * chaukor logo ko cover karne par uske kinare kat jaate hain, aur uske peeche
     * uski hi dhundhli copy ek dhabba bana deti hai. Dono galtiyan dikhti nahi,
     * bas logo "thoda ajeeb" lagta hai.
     */
    const logoSlot = getSceneType(type)?.slots.find((slot) => slot.id === "logo");
    if (logoSlot && !slots.logo && args.doc.brand.logoAssetId) {
      const role = `logo:${scene.index}`;
      slots.logo = role;
      assetByRole[role] = args.doc.brand.logoAssetId;
    }

    /*
     * Peeche ki tasveer — apna role, visual se bilkul alag (26.27).
     *
     * ⚠️ `background` slot har scene type me hai, isliye yahan type dekhne ki
     * zaroorat nahi. Ye jaan-boojhkar hai: aadmi ne kaha tha ki background kisi
     * bhi scene par lag sake, ya kisi par bhi nahi — to use type ki shart ke
     * peeche baandhna usi baat ko todta.
     */
    if (scene.backgroundAssetId) {
      const role = `background:${scene.index}`;
      slots.background = role;
      assetByRole[role] = scene.backgroundAssetId;
    } else {
      delete slots.background;
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
       * WARNING: Lambai ka poora hisaab `sceneSecondsWithGap()` me hai, yahan
       * nahi. Wo hisaab UI ko bhi chahiye (aadmi ko reel ki asli lambai dikhani
       * hai), aur do jagah likhne par ek din wizard "30 second" bolta aur reel 34
       * ki banti - wo farak sirf ban jaane ke baad pakda jaata.
       *
       * ⚠️ Gap isi lambai me juda hua hai, do scene ke beech ki khaali jagah ke
       * roop me nahi. Timeline me scenes hamesha ek ke baad ek chipke rehte hain
       * (`relayoutScenes`); beech me sach me jagah chhodne ka koi tarika hai bhi
       * nahi, aur hota to wahan kaala frame aata.
       */
      durationSeconds: sceneSecondsWithGap(scene, args.draft, at === live.length - 1),
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

  /** Bane hue scene se wapas draft ke scene tak — preview ki selection ke liye. */
  const sceneIndexById: Record<string, number> = {};
  created.forEach((scene, at) => {
    const source = madeFrom[at];
    if (source) sceneIndexById[scene.id] = source.index;
  });

  let doc = result.doc;

  created.forEach((scene, at) => {
    const source = madeFrom[at];
    if (!source) return;

    const primary = primarySceneItem(doc, scene.id);
    // Jis scene me dikhne layak kuch nahi (sirf awaaz), wahan animation ka
    // sawaal hi nahi uthta — SceneAnimation bhi wahan dropdown nahi dikhata.
    if (!primary) return;

    /*
     * Preview me haath se kiye hue sudhaar (26.28).
     *
     * ⚠️ Pehchaan `elementKeyMap` se banti hai, item ki id se nahi — id har baar
     * nayi hoti hai. Aur wo `doc` ke abhi wale roop se banti hai, sabse pehle:
     * neeche fit, trim aur effect items ko badalte hain par unki id kabhi nahi
     * badalte, isliye ek hi baar ginna kaafi hai.
     */
    const tweaks = source.tweaks ?? {};
    const keyById = elementKeyMap(sceneItemsInOrder(doc.items, scene));
    const tweakOf = (itemId: string): SceneTweak | null => tweaks[keyById[itemId] ?? ""] ?? null;

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
    /*
     * ⚠️ Element ka apna chunav preset se **jeetta** hai, par preset ko mitata
     * nahi. Preset scene ka chunav hai; "ye cheez neeche se aaye" us ek cheez ka.
     * Preset `null` kar dene par aadmi ka pehla chunav chup-chaap chala jaata, aur
     * "jaisa tha waisa" par wapas jaane ka koi raasta nahi bachta.
     */
    if (source.animationPresetId && (tweakOf(primary.id)?.entry.kind ?? "inherit") === "inherit") {
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
    /*
     * ⚠️ Fit ki hui file par ye hisaab **nahi** lagta, aur wo zaroori hai. Wo file
     * pehle se theek frame ke naap ki hai; uspar `visualSize` (asli file ka naap)
     * se contain+blur lagana matlab ek hi kaam do baar — tasveer frame ke andar
     * dobara chhoti ho kar baith jaati hai, kinare par dhundhli patti ke saath.
     */
    const fitVisual = visualAssetOf(source);
    if (
      fitVisual &&
      source.visualFitAssetId === null &&
      primary.assetId === fitVisual &&
      !source.phoneFrame
    ) {
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
                    /*
                     * ⚠️ Aadmi ka chunav pehle, default baad me. Pehle yahan
                     * hamesha dhundhli copy lagti thi, aur `CONTAIN_BACKGROUNDS`
                     * ki poori registry kahin istemal hi nahi hoti thi — yaani
                     * chaar chunav likhe hue the aur ek bhi pahunchta nahi tha.
                     */
                    background: source.containBackground
                      ? {
                          kind: source.containBackground.kind as "color",
                          value: source.containBackground.value,
                        }
                      : fit.blurred
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
    /*
     * ⚠️ Fit ki hui video me trim **pehle se laga hua** hai (fit usi hisse ko
     * kaat kar banti hai), isliye uspar dobara trim nahi lagta — warna chuna hua
     * hissa apne hi andar se dobara kat jaata hai.
     */
    if (source.visualTrim && source.visualFitAssetId === null && primary.assetId === fitVisual) {
      doc = trimItemToSourceRange(doc, {
        itemId: primary.id,
        startSeconds: source.visualTrim.startSeconds,
        endSeconds: source.visualTrim.endSeconds,
      });
    }

    /*
     * Rang ka effect — sirf **dikhne wale** item par (26.24).
     *
     * ⚠️ Ye `primary` par lagta hai, poore scene par nahi. Text ke item par
     * grayscale/sepia lagana bekaar nahi, ulta nuksaan hai: "B & W" chunne par
     * safed text bhi bhoora pad jaata hai aur aadmi ko lagta hai ki rang ka
     * chunav toota hua hai. Effect tasveer ka gun hai, poore scene ka nahi.
     *
     * ⚠️ Anjaan id par `applyEffectPreset` phat'ta hai (`TimelineOpError`), aur
     * use yahan pakadna zaroori hai — warna ek purana draft (jisme koi hataya hua
     * preset likha hai) poore wizard ko gira deta, aur wo galti "Editor me daalo"
     * dabane par hi dikhti.
     */
    if (source.effectPresetId && !tweakOf(primary.id)?.noEffect) {
      try {
        doc = applyEffectPreset(doc, {
          itemIds: [primary.id],
          presetId: source.effectPresetId,
        });
      } catch {
        // Effect na lagna reel ko rokne layak baat nahi — baaki sab lagta rehta hai.
      }
    }

    if (source.transitionId && source.transitionId !== "none") {
      doc = setTransition(doc, {
        itemIds: [primary.id],
        side: "in",
        type: source.transitionId,
      });
    }

    /*
     * Naap / jagah / ghumav — sabse aakhir me, aur **jodkar**.
     *
     * ⚠️ Ye scene ke apne layout ke upar lagta hai, uski jagah nahi leta. Seedha
     * likh dene par CTA ka logo apni jagah se hat jaata aur phone frame ke andar
     * ki recording frame se bahar nikal jaati — dono galtiyan sirf us ek scene
     * par dikhti hain, aur aadmi ne wahan kuch kiya bhi nahi hota.
     */
    /*
     * Har cheez ka apna aana (26.30).
     *
     * ⚠️ Ye `applyAnimationPreset` ke **baad** lagta hai aur us item ki purani
     * animations ko badal deta hai — kyunki aadmi ne is cheez ke liye saaf-saaf
     * kuch kaha hai. Upar jodne par preset ka zoom aur uska slide dono ek saath
     * chalte, aur nateeja wo hota jo kisi ne nahi maanga.
     *
     * ⚠️ Ye sirf primary par nahi, **har** item par lag sakta hai — aur wahi is
     * poore feature ki wajah hai. CTA me logo, line aur button teen alag item
     * hain; preset unme se sirf ek par lagta hai, aur baaki do hamesha ek jaise
     * aate the.
     */
    const entryKeys = Object.keys(tweaks).filter(
      (key) => tweaks[key]!.entry && tweaks[key]!.entry.kind !== "inherit",
    );
    if (entryKeys.length > 0) {
      doc = {
        ...doc,
        items: doc.items.map((item) => {
          const entry = tweakOf(item.id)?.entry;
          if (!entry || entry.kind === "inherit") return item;
          return { ...item, animations: entryAnimations(entry, doc.project.fps) };
        }),
      };
    }

    const tweakedKeys = Object.keys(tweaks);
    if (tweakedKeys.length > 0) {
      doc = {
        ...doc,
        items: doc.items.map((item) => {
          const tweak = tweakOf(item.id);
          if (!tweak) return item;
          return {
            ...item,
            hidden: item.hidden || tweak.hidden,
            transform: {
              ...item.transform,
              // 0 ya rina scale par item gayab ho jaata hai aur schema bhi use
              // nahi maanta (`positive`) — isliye ek chhoti si farsh.
              scale: Math.max(0.05, item.transform.scale * tweak.scale),
              x: item.transform.x + tweak.x,
              y: item.transform.y + tweak.y,
              rotation: item.transform.rotation + tweak.rotation,
              opacity: Math.max(0, Math.min(1, item.transform.opacity * tweak.opacity)),
            },
          };
        }),
      };
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
    if (!src) return;

    /*
     * ⚠️ Raftaar **kaat se pehle** lagti hai, aur ye kram badla nahi ja sakta.
     * `trimItemToSourceRange` source ke frames ko timeline ke frames me badalne
     * ke liye item ka `playbackRate` padhta hai — 1.3x par source ke 3 second
     * timeline par 2.3 bharte hain. Rate baad me likhne par kaat hamesha 1x ke
     * hisaab se lagti, aur tez awaaz apne ant se pehle hi kat jaati.
     */
    if (src.voiceRate !== 1 || src.voiceVolume !== 1) {
      doc = {
        ...doc,
        items: doc.items.map((item) =>
          item.sceneId === scene.id && item.type === "audio"
            ? {
                ...item,
                playbackRate: src.voiceRate,
                /*
                 * ⚠️ Level yahin lagta hai, aur `muted` bhi saath me. Sirf volume
                 * 0 kar dena kaafi lagta hai par nahi hai: properties panel me
                 * clip "chal rahi" dikhti hai aur uska volume slider 0 par hota
                 * hai, jise aadmi ek galti samajh kar wapas 1 kar deta hai.
                 * `muted: true` wo baat saaf kehta hai — "ye jaan-boojhkar chup
                 * hai".
                 */
                audio: {
                  ...item.audio,
                  volume: Math.max(0, Math.min(1, src.voiceVolume)),
                  muted: src.voiceVolume <= 0,
                },
              }
            : item,
        ),
      };
    }

    /*
     * Awaaz ka chuna hua hissa (26.28).
     *
     * ⚠️ Item `assetId` se dhoondha jaata hai, sirf `type === "audio"` se nahi.
     * Aage chal kar isi scene par music ka tukda bhi ek audio item hi banta hai;
     * bina is shart ke ek din wo kaat gaane par lag jaati — aur wo galti sirf
     * poori reel sun kar pakdi jaati.
     *
     * ⚠️ Kaat item ki apni lambai bhi ghatati hai, poore scene ki nahi. Scene ki
     * lambai `voiceSeconds()` se aati hai jo yahi kaat pehle se jodta hai —
     * isliye dono ka jawab ek rehta hai aur ant me chuppi nahi bachti.
     */
    if (src.voiceTrim && src.voiceAssetId) {
      const voice = doc.items.find(
        (item) =>
          item.sceneId === scene.id && item.type === "audio" && item.assetId === src.voiceAssetId,
      );
      if (voice) {
        doc = trimItemToSourceRange(doc, {
          itemId: voice.id,
          startSeconds: src.voiceTrim.startSeconds,
          endSeconds: src.voiceTrim.endSeconds,
        });
      }
    }

    /*
     * Bolne wale ka safar — scene ke andar level ka badalna (26.29).
     *
     * ⚠️ Ye kaat ke **baad** lagta hai, aur ye kram zaroori hai: `volumeCurve`
     * point ko item ki lambai ke andar baandhta hai, aur kaat lagne ke baad wo
     * lambai badal chuki hoti hai. Pehle likhne par aakhri point clip se bahar
     * chala jaata aur chup-chaap gir jaata.
     */
    const voiceItem = src.voiceAssetId
      ? doc.items.find(
          (item) =>
            item.sceneId === scene.id && item.type === "audio" && item.assetId === src.voiceAssetId,
        )
      : undefined;

    if (voiceItem && src.voiceVolumePoints?.length) {
      const curve = volumeCurve({
        points: src.voiceVolumePoints,
        base: src.voiceVolume,
        durationInFrames: voiceItem.durationInFrames,
        fps: doc.project.fps,
      });

      /*
       * ⚠️ `muted` yahan hatana padta hai. Base 0 ("Chup") par upar wala hissa
       * `muted: true` likh chuka hota hai, aur `itemGainAt` uspar seedha 0 lauta
       * deta hai — yaani beech me level uthane wala har point bekaar. Safar me
       * kahin awaaz ho to chuppi ka thappa jhootha hai.
       */
      if (!curveIsSilent(curve)) {
        doc = {
          ...doc,
          items: doc.items.map((item) =>
            item.id === voiceItem.id
              ? { ...item, audio: { ...item.audio, muted: false } }
              : item,
          ),
        };
      }

      for (const point of curve) {
        doc = addKeyframe(doc, {
          itemId: voiceItem.id,
          path: "audio.volume",
          frame: point.frame,
          value: point.value,
        });
      }
    }
  });

  /*
   * ------------------------------------------------------------------ music
   *
   * ⚠️ **Har scene ka apna music clip banta hai, ek lamba clip nahi** (26.24).
   *
   * Ek hi clip poori reel par daalna aasan tha aur ek cheez namumkin bana deta:
   * "is scene par music band karo". Uske liye volume par keyframes lagane padte,
   * jo wizard ke aadmi ke liye ek naya aur bekaar sawaal hai.
   *
   * Ab har scene ke saath uska tukda hai, aur har tukda **wahin se** chalta hai
   * jahan pichhla chhoda tha (`trimStartFrame` aage badhta hai). Yaani sunne me
   * ek hi dhun chalti hai, par har scene par uska level alag ho sakta hai — aur
   * "yahan music band" ek tap hai, ek keyframe nahi.
   *
   * ⚠️ Clips scene se **judi hui** hain (`sceneId`). Isliye scene hatane par uska
   * music bhi jaata hai, scene upar-neeche karne par music saath chalta hai, aur
   * "purane scene hata do" par purana music bhi mit'ta hai. Bina `sceneId` ke wo
   * doosri baar wizard chalane par jama hote rehte — do gaane ek saath.
   */
  /** Is scene par kaunsa gaana bajega — scene ka apna, warna reel ka. */
  const musicOf = (src: WizardScene | undefined): string | null =>
    src ? (src.musicAssetId ?? args.draft.musicAssetId) : null;

  if (created.length > 0 && madeFrom.some((src) => musicOf(src) !== null)) {
    const musicTrack =
      doc.tracks.find((track) => track.type === "music") ??
      (() => {
        doc = addTrack(doc, { typeId: "music" });
        return doc.tracks.find((track) => track.type === "music");
      })();

    if (musicTrack) {
      /**
       * Har gaane ka apna cursor — wo kahan tak baj chuka.
       *
       * ⚠️ Ek hi cursor rakhna tab tak theek tha jab tak poori reel par ek hi
       * gaana tha. Alag-alag gaane hone par wo cursor doosre gaane ke andar bhi
       * aage badh jaata, aur teesre scene par pehla gaana apne beech se shuru
       * hota — sunne me wo "gaana kat gaya" jaisa lagta hai, aur uski wajah
       * kahin dikhti nahi.
       */
      const cursorOf: Record<string, number> = {};

      created.forEach((scene, at) => {
        const src = madeFrom[at];
        if (!src) return;

        const assetId = musicOf(src);
        if (!assetId) return;

        const items = doc.items.filter((item) => item.sceneId === scene.id);
        if (items.length === 0) return;

        const start = Math.min(...items.map((item) => item.startFrame));
        const end = Math.max(...items.map((item) => item.startFrame + item.durationInFrames));
        const duration = end - start;
        if (duration <= 0) return;

        const volume = src.musicVolume ?? args.draft.musicVolume;
        const fade = Math.round(doc.project.fps * 0.5);

        /*
         * Fade **wahan** jahan gaana sach me shuru ya khatam hota hai.
         *
         * ⚠️ Pehle ye sirf pehle aur aakhri scene par tha, is dalil par ki beech
         * ke jode chipke rehne chahiye — aur wo dalil tab tak sahi thi jab poori
         * reel par ek hi gaana tha. Alag gaana lagate hi wo galat ho jaati hai:
         * beech me ek dhun poore level par achanak katti hai aur doosri poore
         * level par achanak shuru hoti hai. Wo jhatka reel ki sabse buri awaaz
         * hai, aur wo sirf sun kar pakda jaata hai.
         *
         * Isliye shart gaane ki hai, scene ki position ki nahi: pichhle/agle
         * scene par yahi gaana ho to jod chipka rehta hai, warna dono taraf
         * aadha second ka fade lagta hai.
         */
        const samePrevious = at > 0 && musicOf(madeFrom[at - 1]) === assetId;
        const sameNext = at < created.length - 1 && musicOf(madeFrom[at + 1]) === assetId;

        const cursor = cursorOf[assetId] ?? 0;

        const music = createItem("audio", {
          fps: doc.project.fps,
          trackId: musicTrack.id,
          sceneId: scene.id,
          name: "Music",
          assetId,
          startFrame: start,
          durationInFrames: duration,
          trimStartFrame: cursor,
          audio: {
            volume: Math.max(0, Math.min(1, volume)),
            muted: volume <= 0,
            fadeInFrames: samePrevious ? 0 : fade,
            fadeOutFrames: sameNext ? 0 : fade,
          },
        });

        doc = addItem(doc, { item: music });

        /*
         * Dhun ka safar — isi scene ke tukde par (26.29).
         *
         * ⚠️ Ye per-scene hai aur wahi iski poori taakat hai. Ek lambi clip par
         * ye keyframes reel ke frame par lagte (yaani scene khiskate hi galat
         * jagah), aur "is scene par teen second baad music uthao" likhne ke liye
         * aadmi ko poori reel ka waqt ginna padta. Har scene ka apna tukda hone
         * se point scene ke apne waqt me rehte hain.
         */
        if (src.musicVolumePoints?.length) {
          const curve = volumeCurve({
            points: src.musicVolumePoints,
            base: volume,
            durationInFrames: duration,
            fps: doc.project.fps,
          });

          if (!curveIsSilent(curve)) {
            doc = {
              ...doc,
              items: doc.items.map((item) =>
                item.id === music.id ? { ...item, audio: { ...item.audio, muted: false } } : item,
              ),
            };
          }

          for (const point of curve) {
            doc = addKeyframe(doc, {
              itemId: music.id,
              path: "audio.volume",
              frame: point.frame,
              value: point.value,
            });
          }
        }

        cursorOf[assetId] = cursor + duration;
      });
    }
  }

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
  /*
   * Tasveer wale scene ke text ke peeche ek halki parat.
   *
   * WARNING: Bina iske safed serif text tasveer par jagah-jagah gayab ho jaata
   * hai — Papa ka safed kurta, app ka halka card, ya koi bhi chamakdaar hissa
   * aur wahi shabd padhe hi nahi jaate. Aur wo galti sirf **us ek frame** par
   * hoti hai jahan tasveer halki hai, isliye editor me scroll karte hue wo kabhi
   * nazar nahi aati; pakdi tab jaati hai jab poori reel dekhi jaaye.
   *
   * WARNING: Parat halki hai (45%), gehri nahi. Poora kaala dabba lagane par
   * text to padha jaata hai par reel "caption chipkaya hua" jaisi lagne lagti
   * hai — tasveer aur shabd do alag cheezein dikhte hain.
   *
   * Jinke paas apna background pehle se hai (CTA ka button) unhe chhoda jaata
   * hai — un par ye doosri parat ek dabbe ke andar dabba bana deti.
   */
  /*
   * ⚠️ CTA yahan se bahar hai. Uski tasveer logo hai, jo text se door upar
   * baithta hai — text uske upar aata hi nahi. Wahan parat lagane ka matlab
   * hota saaf kaale background par ek aur kaala dabba, jo bewajah dikhta hai.
   */
  const withVisual = new Set(
    created
      .map((scene, at) => {
        const src = madeFrom[at];
        if (!src?.visualAssetId || effectiveType(src) === "cta") return null;
        return scene.id;
      })
      .filter((id): id is string => id !== null),
  );
  doc = {
    ...doc,
    items: doc.items.map((item) =>
      item.text && !item.text.background && item.sceneId && withVisual.has(item.sceneId)
        ? {
            ...item,
            text: {
              ...item.text,
              background: { color: "rgba(0,0,0,0.45)", paddingX: 32, paddingY: 18, radius: 18 },
            },
          }
        : item,
    ),
  };

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
      item.text?.color === "brand.textOnAccent";

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

  /*
   * Wizard ka apna draft doc ke saath jama — "Wizard me kholo" ka poora aadhaar.
   *
   * ⚠️ Ye yahan hai, UI me nahi, aur wo jaan-boojhkar hai. Doc yahi function
   * banata hai; yaad bhi yahi rakhega. Dono jagah alag rakhne par ek din wo alag
   * ho jaate hain — doc me kuch aur hota aur yaadgaar kuch aur kehti — aur wo
   * farak sirf wizard dobara khol kar pakda jaata.
   *
   * ⚠️ Har render job doc ka frozen snapshot rakhta hai, isliye ye yaadgaar us
   * video ke saath apne aap jam jaati hai. Alag column banane ki zaroorat isi
   * wajah se nahi padi.
   */
  doc = {
    ...doc,
    meta: {
      ...doc.meta,
      wizard: writeWizardMemory({
        draft: args.draft,
        appliedSceneIds: Object.keys(sceneIndexById),
      }),
    },
  };

  return {
    doc,
    applied: result.applied,
    sceneIndexById,
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
export function sceneAdvice(
  scene: WizardScene,
  at: number,
  /** Poori reel ka awaaz wala chunav — na do to sirf text wali jaanch chalti hai. */
  draft?: Pick<WizardDraft, "voiceCategoryId"> | null,
): WizardAdvice[] {
  const out: WizardAdvice[] = [];
  if (scene.removed) return out;

  const seconds = sceneSeconds(scene);
  const words = scene.text.trim().split(/\s+/).filter(Boolean).length;

  const staleReason = voiceStaleReason(scene, draft);
  if (staleReason === "text") {
    out.push({
      level: "warn",
      text: "Awaaz banne ke baad text badla hai — reel me kuch aur bolega, screen par kuch aur likha hoga. Dobara banao.",
    });
  } else if (staleReason === "choice") {
    out.push({
      level: "warn",
      text: "Ye awaaz us chunav ki hai jo ab badal chuka hai — reel ke beech me bolne wala badal jaayega. Dobara banao.",
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

  /*
   * Awaaz aur scene ki lambai ka mel — **ban jaane se pehle** (26.24).
   *
   * ⚠️ Ye chetavni tabhi ban sakti hai jab dono number alag ho sakte hon, aur
   * wo halat haath se lambai likhne (ya video trim karne) se banti hai. Bina is
   * chetavni ke wo galti sirf sun kar pakdi jaati hai: aakhri do shabd gayab, ya
   * scene ke ant me ek suna hua khalaa. Dekhne wale ko dono ek hi cheez lagti
   * hain — "awaaz ruk jaati hai" — aur wo poori reel ko tooti hui bana deta hai.
   */
  const mismatch = voiceMismatch(scene);
  if (mismatch) {
    out.push({
      level: "warn",
      text:
        mismatch.kind === "cut"
          ? `Awaaz ${mismatch.voiceSeconds.toFixed(1)}s ki hai par scene ${mismatch.sceneSeconds.toFixed(1)}s ka — aakhri ${mismatch.offBySeconds.toFixed(1)}s BEECH ME KAT jaayega. Ya lambai badhao, ya raftaar tez karo, ya line chhoti karo.`
          : `Awaaz ${mismatch.voiceSeconds.toFixed(1)}s me khatam ho jaati hai par scene ${mismatch.sceneSeconds.toFixed(1)}s chalta hai — beech me ${mismatch.offBySeconds.toFixed(1)}s chup rahega, jo "atak gaya" jaisa lagta hai.`,
    });
  } else if (voiceSeconds(scene) === null && words > 0) {
    /*
     * Awaaz abhi nahi bani — to bata do ki banne par lambai kya ho jaayegi.
     * Warna aadmi ek scene ki lambai 3s par set karta hai, phir Awaaz wale step
     * par jaata hai, aur wahan wo 7s ki ban jaati hai. Us farak ka pata do step
     * baad chalta hai, jab wo peeche aakar dobara sab dekhta hai.
     */
    const guess = estimateSpeechSeconds(scene.text, scene.voiceRate);
    if (guess > seconds + 0.6) {
      out.push({
        level: "tip",
        text: `Is line ko bolne me ~${guess.toFixed(1)}s lagenge, par scene ${seconds.toFixed(1)}s ka hai. Awaaz lagate hi lambai apne aap badh jaayegi (jab tak tumne haath se tay na ki ho).`,
      });
    }
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

  /*
   * Text chhupane ke teen anjaam hain, aur teen alag baatein — ek hi chetavni me
   * jama kar dene par har halat par galat line dikhti hai.
   */
  if (scene.hideText && !scene.visualAssetId && !scene.voiceAssetId) {
    out.push({
      level: "tip",
      text: "Text chhupane ke liye scene me tasveer ya awaaz honi chahiye — abhi dono nahi hain, isliye text phir bhi dikhega.",
    });
  } else if (textHidden(scene) && !scene.voiceAssetId) {
    out.push({
      level: "tip",
      text: "Is scene par sirf tasveer chalegi — na likha hua, na bola hua. B-roll ke liye theek hai; baat kehni ho to awaaz laga do.",
    });
  } else if (textHidden(scene) && !scene.visualAssetId) {
    out.push({
      level: "tip",
      text: "Screen par kuch nahi dikhega, sirf awaaz chalegi — background hi dikhta rahega.",
    });
  }

  return out;
}

/** Poori reel par ek nazar — scene-dar-scene wali baatein `sceneAdvice` me hain. */
export function draftAdvice(draft: WizardDraft): WizardAdvice[] {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const total = draftTotalSeconds(draft);
  const out: WizardAdvice[] = [];

  if (live.length === 0) return [{ level: "warn", text: "Ek bhi scene nahi bacha." }];

  /*
   * Gap ka jama hua kharcha — ek scene par wo chhota lagta hai, poori reel par
   * nahi. 8 scene par 0.5s ka gap 3.5 second jodta hai, aur wo 3.5 second bilkul
   * thehre hue frame ke hote hain. Ye ginti aadmi khud kabhi nahi karta.
   */
  const gap = gapSecondsOf(draft);
  if (gap > 0 && live.length > 1) {
    const added = gap * (live.length - 1);
    out.push({
      level: gap >= 0.8 ? "warn" : "tip",
      text: `Scene ke beech ${gap.toFixed(2)}s ki saans hai — poori reel me ${added.toFixed(1)}s isi ke hain, jisme tasveer thehri rehti hai. Reels ki chaal tez hoti hai; 0.2-0.4s se zyada aksar sust lagta hai.`,
    });
  }

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
  /** Jin scene par awaaz aur lambai ka mel nahi (`voiceMismatch`). */
  mismatch: number;
  needsChoice: number;
} {
  const live = draft.scenes.filter((scene) => !scene.removed);
  return {
    total: live.length,
    withImage: live.filter((scene) => scene.visualAssetId).length,
    withVoice: live.filter((scene) => scene.voiceAssetId).length,
    staleVoice: live.filter((scene) => voiceStale(scene, draft)).length,
    mismatch: live.filter((scene) => voiceMismatch(scene) !== null).length,
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
