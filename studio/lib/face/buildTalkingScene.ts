import {
  addItem,
  addTrack,
  applyAnimationPreset,
  applyEffectPreset,
  createItem,
  secondsToFrames,
  setItemsProperty,
  type Doc,
  type FaceData,
  type VisemeTrackFrame,
} from "@reel/core";

/**
 * Bolti tasveer ka poora scene doc me lagao — **sirf hisaab, koi React nahi**.
 *
 * ⚠️ Ye panel se alag file me isliye hai ki ise **chala kar jaancha ja sake**
 * (`scripts/check-talking-scene.ts`). Iski galtiyan aisi hain jo TypeScript
 * kabhi nahi pakadta: track ka type ek string hai, item ka type ek string hai,
 * aur galat string par sab kuch compile ho jaata hai aur chalte waqt phat'ta hai.
 *
 * Ye baat andaaze se nahi likhi — banate waqt yahan `"voice"` naam ki ek track
 * type maan li gayi thi jo hai hi nahi. `tsc` chup raha; wo galti tabhi milti jab
 * aadmi "Bana do" dabata.
 */

export interface TalkingSceneInput {
  doc: Doc;
  /** Bolne wali tasveer. */
  imageAssetId: string;
  /** Bani hui awaaz. */
  voiceAssetId: string;
  face: FaceData;
  /** Tasveer ka apna naap. */
  sourceSize: { width: number; height: number };
  track: readonly VisemeTrackFrame[];
  emotionId: string;
  durationSeconds: number;
  /** `ANIMATION_PRESETS` ka id — khaali = koi harkat nahi. */
  animationId?: string;
  /** `EFFECT_PRESETS` ka id — khaali = koi rang nahi. */
  effectId?: string;
  /** Bola ja raha text screen par bhi dikhe? */
  showText?: boolean;
  /** Screen par dikhne wala text — `showText` par hi lagta hai. */
  text?: string;
}

/**
 * Maujooda track dobara, nayi tabhi jab ho hi na.
 *
 * ⚠️ Har baar nayi banane par do-teen bolti tasveer ke baad timeline me chhe
 * khaali qatarein ho jaati hain, aur unhe haath se hataana padta hai.
 */
function useTrack(doc: Doc, typeId: string): { doc: Doc; trackId: string } {
  const already = doc.tracks.find((track) => track.type === typeId);
  if (already) return { doc, trackId: already.id };
  const grown = addTrack(doc, { typeId });
  return { doc: grown, trackId: grown.tracks[grown.tracks.length - 1]!.id };
}

export function buildTalkingScene(input: TalkingSceneInput): Doc {
  const fps = input.doc.project.fps;
  const frames = secondsToFrames(input.durationSeconds, fps);

  /*
   * ⚠️ Naya scene maujooda kaam ke **baad** lagta hai, frame 0 par nahi. Shuru me
   * daalne par wo purane items ke upar chadh jaata hai, aur aadmi ko lagta hai ki
   * uska pehle wala kaam gayab ho gaya — jabki wo neeche daba hota hai.
   */
  const startFrame = input.doc.items.reduce(
    (end, item) => Math.max(end, item.startFrame + item.durationInFrames),
    0,
  );

  let doc = input.doc;

  const visual = useTrack(doc, "image");
  doc = visual.doc;

  /*
   * ⚠️ `audio` — koi `voice` naam ki track type hai hi nahi (`TRACK_TYPES` dekho).
   * Ye line ek asli galti thi jo `tsc` ne nahi pakdi.
   */
  const voiceLane = useTrack(doc, "audio");
  doc = voiceLane.doc;

  const photo = createItem("talking_photo", {
    fps,
    trackId: visual.trackId,
    name: "Bolti tasveer",
    startFrame,
    durationInFrames: frames,
  });

  doc = addItem(doc, {
    item: {
      ...photo,
      assetId: input.imageAssetId,
      talkingPhoto: {
        voiceAssetId: input.voiceAssetId,
        emotionId: input.emotionId,
        face: input.face,
        sourceSize: input.sourceSize,
        track: [...input.track],
      },
    },
  });

  const voice = createItem("audio", {
    fps,
    trackId: voiceLane.trackId,
    name: "Awaaz",
    startFrame,
    durationInFrames: frames,
  });
  doc = addItem(doc, { item: { ...voice, assetId: input.voiceAssetId } });

  /*
   * Text screen par — sirf tab jab maanga gaya ho.
   *
   * ⚠️ Ye chunav sach me kuch karta hai. Ek toggle jo kuch na kare wo toota hua
   * button hai, aur uska nuksaan chhupa hua hota hai: aadmi use daba kar maan
   * leta hai ki text aayega, aur wo galti export ke baad hi dikhti hai.
   */
  const caption = input.text?.trim() ?? "";
  if (input.showText && caption) {
    const lane = useTrack(doc, "text");
    doc = lane.doc;
    const item = createItem("text", {
      fps,
      trackId: lane.trackId,
      name: "Text",
      startFrame,
      durationInFrames: frames,
    });
    doc = addItem(doc, { item });
    doc = setItemsProperty(doc, {
      itemIds: [item.id],
      path: "text.content",
      value: caption,
    });
  }

  if (input.animationId) {
    doc = applyAnimationPreset(doc, { itemIds: [photo.id], presetId: input.animationId });
  }
  if (input.effectId) {
    doc = applyEffectPreset(doc, { itemIds: [photo.id], presetId: input.effectId });
  }

  /*
   * ⚠️ Project ki lambai badhani padti hai. Wo apne aap sirf badhti hai
   * (`growDuration`), par naya scene ant me lagta hai — aur agar project usse
   * chhota raha to reel bane hue clip se pehle hi khatam ho jaati hai, yaani wo
   * MP4 me aata hi nahi.
   */
  const lastFrame = doc.items.reduce(
    (end, item) => Math.max(end, item.startFrame + item.durationInFrames),
    0,
  );
  if (lastFrame > doc.project.durationInFrames) {
    doc = { ...doc, project: { ...doc.project, durationInFrames: lastFrame } };
  }

  return doc;
}
