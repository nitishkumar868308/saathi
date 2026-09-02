import { z } from "zod";

import { EASING_IDS, DEFAULT_EASING } from "../config/easing";
import { DIMENSION_STEP, MAX_DIMENSION, MIN_DIMENSION } from "../config/presets";
import { MAX_FPS, MIN_FPS } from "../time";

/**
 * Project JSON — poore product ka **ekmatra** sach.
 *
 * AI ise likhta hai, template ise likhte hain, haath se editing ise badalti hai,
 * renderer sirf ise padhta hai. Isi ek faisle ki wajah se AI-generated reel baad
 * me bhi editable rehti hai.
 *
 * Do baatein locked hain (00-architecture Section E):
 *  1. Timing **integer frames** me hai, seconds me nahi. Float seconds par split
 *     karne se hamesha 1-frame ka gap ya overlap aa jaata hai.
 *  2. `version` din ek se maujood hai, taaki `migrate.ts` purane docs utha sake.
 *
 * Types yahan haath se nahi likhe — sab `z.infer` se aate hain, warna schema aur
 * type dhire-dhire alag ho jaate hain aur runtime par pata chalta hai.
 */

export const SCHEMA_VERSION = 1;

const IdSchema = z.string().min(1);

/** Timeline par jagah — hamesha integer frame. */
export const FrameSchema = z.number().int().min(0);

/** Lambai — kam se kam 1 frame, warna clip kabhi dikhega hi nahi. */
export const DurationFramesSchema = z.number().int().min(1);

/**
 * Rang ya to hex hai (`#C25A37`) ya **brand token** (`brand.primary`).
 * Token likhne se brand badalte hi poori reel badal jaati hai — isliye UI hamesha
 * token ki taraf dhakelta hai (Dynamic rule 9).
 *
 * Resolve karne wale helpers `config/brand.ts` me hain (`isBrandToken`, `resolveToken`).
 */
export const ColorSchema = z.string().min(1);

const evenDimension = (label: string) =>
  z
    .number()
    .int()
    .min(MIN_DIMENSION)
    .max(MAX_DIMENSION)
    .refine((n) => n % DIMENSION_STEP === 0, {
      // yuv420p ka chroma plane aadha hota hai — visham (odd) size par encoder rota hai.
      message: `${label} even hona chahiye (yuv420p ki zaroorat)`,
    });

/**
 * Audio ka source — **teen mode, ek hi model** (22.1).
 *
 * ⚠️ Scene ka audio slot aur audio item **dono** yahi use karte hain. Do jagah
 * do model rakhne par ek din scene me "both" mode aata aur item me nahi, aur
 * user ko lagta ki wahi cheez kabhi chalti hai kabhi nahi.
 *
 * Teen mode ka matlab:
 *  - `generate` — text likho, awaaz ban jaaye (TTS)
 *  - `upload`   — apni recording
 *  - `both`     — dono; `primary` batata hai kaun sunai dega
 *
 * `both` sabse zaroori hai aur sabse aasani se galat samjha jaata hai: wo "dono
 * ek saath baja do" nahi hai. Wo "dono rakho, ek chalao" hai — taaki apni
 * recording aane tak generated wali chalti rahe, aur aane ke baad ek click me
 * badal jaaye.
 */
export const AudioSourceSchema = z
  .object({
    mode: z.enum(["generate", "upload", "both"]).default("generate"),

    /** `generate` / `both` — jo bolna hai. */
    text: z.string().default(""),
    /**
     * Awaaz kahan se aayegi — `TTS_PROVIDERS` ka id ("gemini" / "edge").
     *
     * Khaali ka matlab "jo bhi chalne layak ho" — aur ye default jaan-boojhkar
     * hai. Doc me `gemini` likh dene par wo doc kisi aisi machine par khulega
     * jahan key hai hi nahi, aur wahan generate har baar fail karega bina wajah
     * bataye. Khaali chhodne par system wahi chunta hai jo us machine par sach
     * me chal sakta hai.
     */
    providerId: z.string().default(""),

    /**
     * Kaisi awaaz — `VOICE_CATEGORIES` ka id ("male" / "female" / "boy" …).
     *
     * ⚠️ Yahi wo cheez hai jo doc me rehni chahiye, provider ki apni voice id
     * nahi. "male" har provider par kuch na kuch matlab rakhta hai; `Charon`
     * sirf Gemini par rakhta hai. Provider badalte hi doc ka matlab khatam ho
     * jaana sabse buri baat hoti.
     */
    categoryId: z.string().default(""),

    /**
     * Us provider ki apni voice id — `hi-IN-MadhurNeural` ya `Charon` jaisa.
     *
     * Ye **nateeja** hai, chunaav nahi: `categoryId` + `providerId` se nikalti
     * hai aur sirf isliye likhi jaati hai ki baad me dekha ja sake ki asal me
     * kaunsi voice bani thi.
     */
    voiceId: z.string().default(""),
    rate: z.number().min(0.5).max(2).default(1),
    pitch: z.number().min(-12).max(12).default(0),

    /** Jo file user ne di. */
    uploadedAssetId: IdSchema.nullable().default(null),
    /** Jo TTS ne banayi — `temporary` lifecycle par rehti hai (22.9). */
    generatedAssetId: IdSchema.nullable().default(null),

    /** `both` me kaun sunai dega. */
    primary: z.enum(["uploaded", "generated"]).default("uploaded"),

    /**
     * Jo text se ye awaaz bani thi.
     *
     * ⚠️ Iske bina "voice outdated" pakda hi nahi ja sakta (22.10). Text badalne
     * par purani awaaz chup-chaap chalti rehti hai aur user ko lagta hai ki
     * regenerate kaam nahi kar raha — jabki usne kabhi dabaya hi nahi.
     */
    generatedFromText: z.string().default(""),

    cleanup: z
      .object({
        enabled: z.record(z.boolean()).default({}),
        params: z.record(z.record(z.union([z.number(), z.boolean()]))).default({}),
        order: z.array(z.string()).default([]),
      })
      .default({}),
  })
  .nullable();

export const AudioSettingsSchema = z.object({
  /** 1 = jaisa hai. 1 se upar clipping ka khatra — Phase 20 validation warn karegi. */
  volume: z.number().min(0).max(4),
  muted: z.boolean(),
  fadeInFrames: FrameSchema,
  fadeOutFrames: FrameSchema,

  /**
   * Solo — is track/item ke alawa sab chup.
   *
   * Ye ek **kaam ka** switch hai, save karne layak setting nahi... par save hota
   * hai, aur ye jaan-boojhkar hai: project band karke kholne par bhi wahi sunai
   * dena chahiye jo band karte waqt sunai de raha tha. Warna user ko lagta hai
   * ki uska mix apne aap badal gaya.
   */
  solo: z.boolean().default(false),

  /** Fade ka aakaar — `equal-power` (default) ya `linear`. */
  fadeShape: z.enum(["equal-power", "linear"]).default("equal-power"),

  /**
   * Music ko clip ki poori lambai tak dohrao.
   *
   * Sirf tab lagta hai jab source clip se chhota ho. Bina iske chhota loop
   * lagane ke liye user ko haath se 8 baar clip copy karni padti hai.
   */
  loop: z.boolean().default(false),

  /**
   * Stereo pan — -1 (poora baayan) se +1 (poora daayan).
   *
   * ⚠️ **Schema me hai, lagta nahi hai — aur UI me iska koi control bhi nahi.**
   * Remotion ke `<Audio>` par sirf `volume` hota hai, pan nahi (`props.d.ts`
   * dekho). Pan lagane ke liye har audio item ka apna Web Audio graph chahiye
   * hoga, ya audio ko alag se mix karna padega — dono Phase 15 ke bahar hain.
   *
   * Field yahan isliye hai ki jab wo bane tab purane project bina migration ke
   * khul jaayein. Slider abhi dikhana galat hota: user use ghumata aur kuch na
   * hota, aur wo galti dhoondhne me ghanton jaate.
   */
  pan: z.number().min(-1).max(1).default(0),

  /**
   * Awaaz kahan se aayi (22.1).
   *
   * `null` = seedha `assetId` wali file (purana raasta, aur wo abhi bhi chalta
   * hai). Ye field tabhi bharti hai jab user ne Generate/Upload/Both wala form
   * use kiya ho.
   */
  source: AudioSourceSchema.default(null),
});

/**
 * Ducking — voice chale to music apne aap neeche (15.3).
 *
 * ⚠️ Ye **rule** hai, per-clip setting nahi. Isi wajah se ye project par hai:
 * har music clip par alag-alag duck settings rakhne par mix ek hi video me
 * jagah-jagah alag lagta hai, aur user ko wajah kabhi samajh nahi aati.
 *
 * Tarika timing-based hai (silence detection nahi): jahan voice track par koi
 * item hai, wahan duck. Ye seedha hai, preview me turant dikhta hai, aur render
 * me bilkul wahi nikalta hai — kyunki dono ek hi function chalate hain.
 */
export const DuckingSchema = z.object({
  enabled: z.boolean().default(false),
  /** Jin tracks ki awaaz "voice" maani jaaye. */
  voiceTrackIds: z.array(IdSchema).default([]),
  /** Jin tracks ko neeche laana hai. */
  duckedTrackIds: z.array(IdSchema).default([]),
  /** Kitna neeche — dB me (negative). */
  targetDb: z.number().min(-60).max(0).default(-18),
  /** Neeche jaane me kitne frames. */
  attackFrames: FrameSchema.default(6),
  /** Wapas upar aane me kitne frames. */
  releaseFrames: FrameSchema.default(15),
});

/** Master audio — poore mix par (15.6). */
export const MasterAudioSchema = z.object({
  volume: z.number().min(0).max(4).default(1),
  /** Final MP4 ka loudness target. Phase 11 ka finalize yahi leta hai. */
  loudnessLufs: z.number().min(-32).max(-5).default(-14),
  /**
   * Limiter — peak ko `-1 dBTP` ke neeche rakhta hai.
   *
   * Band karne ka option isliye hai ki kuch platform khud normalize karte hain
   * aur do baar limit karna awaaz ko chapta kar deta hai.
   */
  limiter: z.boolean().default(true),
  ducking: DuckingSchema.default({}),
});

export const ProjectSettingsSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Kaunsa size preset chuna gaya tha — "custom" bhi ho sakta hai. */
  sizePresetId: z.string().min(1),
  width: evenDimension("width"),
  height: evenDimension("height"),
  fps: z.number().int().min(MIN_FPS).max(MAX_FPS),
  durationInFrames: DurationFramesSchema,
  background: ColorSchema,
  /** Master + ducking. Purane project bina iske bhi khulte hain (default). */
  audio: MasterAudioSchema.default({}),
});

export const TrackSchema = z.object({
  id: IdSchema,
  /** TRACK_TYPES registry ka id. Track ki ginti fixed nahi hai — sirf type fixed hai. */
  type: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().min(0),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),

  /**
   * Solo — sirf ye (aur doosre solo wale) track dikhein/sunai dein (16.2).
   *
   * Item ka apna solo alag hai aur wo sirf awaaz ke liye hai. Track ka solo
   * **dono** par lagta hai, kyunki track ke solo ka matlab hi hai "abhi sirf is
   * parat par kaam kar raha hoon".
   */
  solo: z.boolean().default(false),

  /** Poore track ki paardarshita (16.2). 1 = jaisa hai. */
  opacity: z.number().min(0).max(1).default(1),

  /**
   * Timeline me track kitna ooncha dikhe, pixels me.
   *
   * `null` = registry ka apna default (audio track chhota, video ooncha).
   * Yahan koi number likh dena galat hota: tab har track ek hi oonchai par shuru
   * hoti aur registry ka `defaultHeight` bekaar ho jaata.
   *
   * Ye doc me hai (localStorage me nahi) aur ye bhi jaan-boojhkar hai: video
   * track ko ooncha karke thumbnails dekhna project ka hissa hai, machine ka
   * nahi. Doosri machine par project kholne par wahi layout milna chahiye.
   */
  heightPx: z.number().int().min(24).max(400).nullable().default(null),
});

/**
 * Marker — timeline par ek nishaan (16.8).
 *
 * Markers doc me hain, kisi UI state me nahi: "yahan beat girti hai" ya "yahan
 * cut karna hai" project ka hissa hai. localStorage me rakhne par wo doosri
 * machine par gayab ho jaate aur user ko lagta ki project hi kharab ho gaya.
 */
export const MarkerSchema = z.object({
  id: IdSchema,
  frame: FrameSchema,
  name: z.string().default(""),
  color: z.string().default("#e8a33d"),
});

export const CropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const TransformSchema = z.object({
  /** Frame ke center se offset, project pixels me. */
  x: z.number(),
  y: z.number(),
  /** Fit ki base scale ke **upar** lagne wali user scale (fit.ts ka contract). */
  scale: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  anchor: z.tuple([z.number(), z.number()]),
  crop: CropSchema.nullable(),
});

export const FitBackgroundSchema = z.object({
  kind: z.enum(["color", "brand", "blurred-asset", "gradient"]),
  /** `blurred-asset` ko value nahi chahiye — isliye nullable. */
  value: z.string().nullable(),
});

export const FitSchema = z.object({
  mode: z.enum(["cover", "contain", "fill", "custom"]),
  background: FitBackgroundSchema,
});

export const EasingSchema = z
  .string()
  .refine((value) => EASING_IDS.includes(value), {
    message: `easing inme se ek hona chahiye: ${EASING_IDS.join(", ")}`,
  });

/**
 * Ek keyframe. Value ka type property par nirbhar hai (number, color string,
 * vector…) isliye yahan `unknown` — asli check registry ke control descriptor se
 * hota hai. Isi wajah se koi bhi nayi property apne aap keyframable ban jaati hai.
 */
export const KeyframeSchema = z.object({
  frame: FrameSchema,
  value: z.unknown(),
  easing: EasingSchema.default(DEFAULT_EASING),
  /**
   * Apna curve — `[x1, y1, x2, y2]`, bilkul CSS ke `cubic-bezier()` jaisa (13.2).
   *
   * ⚠️ Ye `easing` ki jagah nahi, uske **upar** hai: bezier diya ho to wahi
   * chalta hai. Do alag fields isliye hain ki dropdown se chuna hua easing (jo
   * 95% baar kaafi hota hai) padhne me saaf rahe, aur curve editor se banaya
   * hua custom curve uske saath baith sake — bina har keyframe me chaar number
   * bhare.
   */
  bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().default(null),
});

/** Key = property path (`"transform.scale"`), value = us path ke keyframes. */
export const KeyframesSchema = z.record(z.string().min(1), z.array(KeyframeSchema));

/** Animation/effect ke type-specific fields registry validate karti hai. */
export const AnimationSchema = z
  .object({
    type: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .passthrough();

export const EffectSchema = z
  .object({
    type: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .passthrough();

/**
 * Mask — item ka kaunsa hissa dikhega (14.9).
 *
 * `null` = koi mask nahi, aur ye default hai. Mask hamesha item ke **apne dabbe**
 * ke andar naapa jaata hai, frame ke nahi — isliye item ko khiskane par mask
 * uske saath jaata hai, jo har editor me hota hai.
 */
export const MaskSchema = z
  .object({
    shape: z.enum(["rect", "rounded", "circle"]).default("rect"),
    /** Chaaron taraf se andar — item ke chhote wale kinare ka percent. */
    inset: z.number().min(0).max(49).default(0),
    /** Sirf `rounded` ke liye — px me. */
    radius: z.number().min(0).max(500).default(48),
    /** Kinara kitna narm — 0 = bilkul saaf kata hua. */
    feather: z.number().min(0).max(50).default(0),
    /**
     * Image mask ke liye jagah (spec §17).
     *
     * ⚠️ Schema me hai par UI me **koi button nahi** — kyunki abhi ye lagta nahi
     * hai. Aadhi bani cheez ka button dikhana sabse bura hota hai: user use daba
     * kar sochta hai ki usne kuch galat kiya.
     */
    assetId: IdSchema.nullable().default(null),
  })
  .nullable()
  // Mask Phase 24 me aayi, isliye usse purane har save me ye field hai hi nahi.
  // Bina default ke wo saare docs parse par gir jaate hain aur project khulta hi
  // nahi — `SCHEMA_VERSION` badhaye bina migration chain ko mauka bhi nahi milta.
  .default(null);

/**
 * Blend mode — item apne peeche wali parat ke saath kaise mile (14.10).
 *
 * List chhoti aur jaan-boojhkar chhoti hai: yahi chaar reel me sach me kaam aate
 * hain. Baaki 12 CSS modes dene se dropdown bhar jaata hai aur faisla mushkil ho
 * jaata hai.
 */
export const BLEND_MODES = ["normal", "multiply", "screen", "overlay"] as const;
export const BlendModeSchema = z.enum(BLEND_MODES).default("normal");

export const TransitionSchema = z
  .object({
    /** TRANSITIONS registry ka id. `"none"` ka matlab koi transition nahi. */
    type: z.string().min(1),
    durationInFrames: FrameSchema,
  })
  /*
   * `passthrough` — bilkul `AnimationSchema` ki tarah, aur usi wajah se.
   *
   * Har transition ke apne params hote hain (`slide` ka `direction`, `zoom` ka
   * `from`, sabka `easing`) aur wo TRANSITIONS registry me apne zod schema ke
   * saath rehte hain. Un sab ko yahan ginana matlab registry ki poori list is
   * file me dobara likhna — aur tab naya transition jodna do jagah ka kaam ban
   * jaata, jo poore dynamic-first design ke khilaf hai.
   *
   * Ye gap type-checker ne pakda tha: params kahin save hi nahi ho paate the,
   * aur transition hamesha apne default par chalti rehti.
   */
  .passthrough();

export const TextStrokeSchema = z.object({
  color: ColorSchema,
  width: z.number().min(0),
});

export const TextShadowSchema = z.object({
  color: ColorSchema,
  blur: z.number().min(0),
  x: z.number(),
  y: z.number(),
});

export const TextBackgroundSchema = z.object({
  color: ColorSchema,
  paddingX: z.number().min(0),
  paddingY: z.number().min(0),
  radius: z.number().min(0),
});

export const TextSpecSchema = z.object({
  content: z.string(),
  /** Brand token (`brand.font.display`) ya seedha font family. */
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  color: ColorSchema,
  align: z.enum(["left", "center", "right"]),
  verticalAlign: z.enum(["top", "middle", "bottom"]),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
  uppercase: z.boolean(),
  /** Frame ki chaudai ka percent — pixels nahi, taaki har project size par chale. */
  maxWidthPercent: z.number().min(1).max(100).nullable(),
  stroke: TextStrokeSchema.nullable(),
  shadow: TextShadowSchema.nullable(),
  background: TextBackgroundSchema.nullable(),
});

/**
 * Subtitle (19.1) — cues + style, ek item me.
 *
 * ⚠️ Cue ke frames **item-local** hain, doc ke nahi. Doc ke frames rakhne par
 * subtitle item ko timeline par khiskane se saare cue apni jagah reh jaate aur
 * caption video se alag ho jaati — aur wo galti aankh se hi pakdi jaati, wo bhi
 * poori reel dekhne par.
 *
 * Text ka roop (font, size, rang) `text` field se aata hai — wahi jo text item
 * use karta hai. Do jagah text ka style rakhne par ek din subtitle ka font
 * update hona bhool jaata aur wo akela purana dikhta.
 */
export const SubtitleSchema = z
  .object({
    /** `CAPTION_STYLES` registry ka id. */
    styleId: z.string().min(1).default("normal"),
    /** Style ke apne params — registry ka schema inhe jaanchta hai. */
    params: z.record(z.unknown()).default({}),
    cues: z
      .array(
        z.object({
          id: IdSchema,
          startFrame: FrameSchema,
          endFrame: FrameSchema,
          text: z.string(),
          words: z
            .array(
              z.object({
                text: z.string(),
                startFrame: FrameSchema,
                endFrame: FrameSchema,
                /**
                 * Machine kitni pakki thi (0..1). `null` = bataya hi nahi (23.9).
                 *
                 * ⚠️ Ye shape `captions/cues.ts` ke `CaptionWordSchema` ki nakal
                 * hai, aur wo jaan-boojhkar hai: `captions/*` is file ko import
                 * karta hai (FrameSchema ke liye), isliye ulta import circular
                 * ho jaata. Dono ko saath badalna padta hai — aur wahi keemat
                 * hai jo yahan likh kar chukayi ja rahi hai.
                 */
                confidence: z.number().min(0).max(1).nullable().default(null),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
    /**
     * Kis bhasha ki caption (19.10).
     *
     * Do bhasha = do subtitle item, ek me do nahi. Ek hi item me do bhasha
     * rakhne par har cue par "ye kaun si bhasha hai" ka sawaal aata aur
     * on/off karna namumkin ho jaata.
     */
    language: z.string().default("hi"),
  })
  .nullable();

export const ShapeSpecSchema = z.object({
  kind: z.enum(["rect", "ellipse", "line"]),
  fill: ColorSchema.nullable(),
  stroke: TextStrokeSchema.nullable(),
  /** Frame ke percent me — 100 = poori chaudai. Magic pixels se bachne ke liye. */
  widthPercent: z.number().positive(),
  heightPercent: z.number().positive(),
  radius: z.number().min(0),
});

/**
 * Phone mockup (18.1) — item ke andar ka media ek phone frame me baithta hai.
 *
 * `null` = koi frame nahi (raw recording). Ye default hai aur jaan-boojhkar hai:
 * har video par phone frame chadha dena galat hoga — frame sirf **screen
 * recording** par kaam ka hai, camera footage par nahi.
 */
export const MockupSchema = z
  .object({
    /** `BUILTIN_DEVICES` ka id. */
    deviceId: z.string().min(1).default("phone-tall"),
    /** Device ki apni color list ka id. */
    colorId: z.string().min(1).default("graphite"),
    /** Frame ki chaudai — project frame ki chaudai ka percent. */
    widthPercent: z.number().min(10).max(200).default(58),
    shadow: z.boolean().default(true),
    /** Screen par halki chamak — kabhi accha lagta hai, kabhi nakli. */
    glare: z.boolean().default(false),
    /**
     * 3D tilt (18.4) — degrees.
     *
     * Ye `transform.rotation` se **alag** hai: wo poore item ko ghumata hai
     * (2D), ye perspective ke saath ghumata hai. Dono ek hi field me daalne par
     * user ka seedha rotate chup-chaap 3D ho jaata.
     */
    tiltX: z.number().min(-45).max(45).default(0),
    tiltY: z.number().min(-45).max(45).default(0),
    /** Screen ke andar media kaise baithe. */
    screenFit: z.enum(["cover", "contain"]).default("cover"),

    /**
     * Tap ke nishaan (18.11) — screen par ungli kahan padi.
     *
     * ⚠️ `frame` **item-local** hai (clip ke apne start se), aur `x`/`y` screen ke
     * andar 0..1 me. Dono jaan-boojhkar aise hain: clip sarkane par nishaan saath
     * sarakte hain, aur device ya frame ka naap badalne par bhi wo screen ki usi
     * jagah par rehte hain. Pixel me rakhne par device badalte hi har nishaan
     * apni jagah chhod deta.
     *
     * `.default([])` — ye field Phase 18 ke baad judi, aur uske bina har purana
     * doc parse par gir jaata (wahi chot jo `mask` ne di thi).
     */
    taps: z
      .array(
        z.object({
          frame: FrameSchema,
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        }),
      )
      .default([]),
  })
  .nullable();

export const ItemSchema = z.object({
  id: IdSchema,
  trackId: IdSchema,
  /** ITEM_TYPES registry ka id: image / video / audio / text / shape … */
  type: z.string().min(1),
  /** Scene sirf grouping hai — item kis scene ka hissa hai. */
  sceneId: IdSchema.nullable(),
  name: z.string().min(1),

  /** Timeline par jagah. */
  startFrame: FrameSchema,
  durationInFrames: DurationFramesSchema,

  /** Source ke andar non-destructive trim — asli file kabhi nahi badalti. */
  trimStartFrame: FrameSchema,
  playbackRate: z.number().positive(),

  /**
   * Source kitna lamba hai, **project ke fps me** (15.1).
   *
   * `null` = pata nahi (image, shape, text — inka koi source lambai hoti hi
   * nahi; ya asset abhi probe nahi hui).
   *
   * ⚠️ Ye field isliye aayi ki iske bina teen cheezein sirf andaaze par chalti
   * thi: trim ki daayein hadd, music ka loop, aur "clip source se lambi hai"
   * wali chetavni. Pehle `trimItemEnd` ise ek argument ki tarah maangta tha,
   * yaani har caller ko yaad rakhna padta tha — aur jo bhool jaata uska trim
   * source ke ant se aage nikal jaata aur wahan kaala frame aata.
   */
  sourceDurationFrames: z.number().int().positive().nullable().default(null),

  assetId: IdSchema.nullable(),

  transform: TransformSchema,
  fit: FitSchema,

  animations: z.array(AnimationSchema),
  keyframes: KeyframesSchema,
  effects: z.array(EffectSchema),
  mask: MaskSchema,
  blendMode: BlendModeSchema,
  mockup: MockupSchema.default(null),
  audio: AudioSettingsSchema,

  transitionIn: TransitionSchema,
  transitionOut: TransitionSchema,

  text: TextSpecSchema.nullable(),
  shape: ShapeSpecSchema.nullable(),
  subtitle: SubtitleSchema.default(null),

  hidden: z.boolean(),
  locked: z.boolean(),

  /**
   * Group — ek saath chalne wale items (16.10).
   *
   * `null` = akela. Ek hi `groupId` wale items ek saath move/trim hote hain.
   *
   * ⚠️ Group ek **field** hai, ek naya "group item" nahi. Group ko apna item
   * banane par har op ko do tarah ke item sambhalne padte (asli aur group), aur
   * har naya op ek din group wala case bhool jaata. Field hone se group sirf
   * selection ko badalta hai, aur baaki poora system waisa ka waisa rehta hai.
   */
  groupId: IdSchema.nullable().default(null),
});

export const SceneSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  order: z.number().int().min(0),
  itemIds: z.array(IdSchema),

  /**
   * SCENE_TYPES registry ka id (Phase 12).
   *
   * `.default("custom")` isliye hai ki Phase 1-11 ke docs me scenes ke paas
   * type tha hi nahi. Unhe migration se guzarna padta to har purana project
   * ek baar rewrite hota — aur wo ek aisa kaam hai jo kabhi-kabhi aadha hokar
   * chhoot jaata hai. Default se purana doc bina chhue chalta rehta hai, aur
   * "custom" ka matlab saaf hai: ye scene kisi registry type se nahi bana.
   */
  type: z.string().min(1).default("custom"),

  /**
   * Scene ke slots ki abhi ki value — `{ image: "as_123", caption: "Namaste" }`.
   *
   * Khula record isliye hai ki har scene type ke apne slots hote hain aur wo
   * uski registry entry me likhe hain. Yahan unhe ginana matlab poori list
   * dobara likhna, aur naya scene type jodna do jagah ka kaam ban jaata.
   */
  slots: z.record(z.unknown()).default({}),
});

/**
 * Watermark / logo (17.9 / 17.12).
 *
 * `assetId` `null` par kuch nahi dikhta — chahe `enabled` sach ho. Ye jaan-
 * boojhkar hai: "watermark on hai par logo nahi chuna" ek aisi haalat hai
 * jisme user ko lagta hai ki watermark toota hua hai, jabki wo sirf khaali hai.
 */
export const WatermarkSchema = z.object({
  enabled: z.boolean().default(false),
  assetId: IdSchema.nullable().default(null),
  position: z
    .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
    .default("bottom-right"),
  /** Frame ki chaudai ka percent. */
  sizePercent: z.number().min(1).max(50).default(12),
  opacity: z.number().min(0).max(1).default(0.8),
  /** Safe-area se kitna andar — frame ke chhote kinare ka percent. */
  marginPercent: z.number().min(0).max(20).default(4),
});

/** End screen (17.9 / 17.12) — reel ke ant me CTA. */
export const EndScreenSchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().default(""),
  durationSeconds: z.number().min(0.5).max(10).default(3),
});

/**
 * Brand — preset ka id **aur** uske upar ke apne badlav (17.9 / 17.11).
 *
 * ⚠️ `tokens` yahan isliye hai ki project apne aap me poora rehna chahiye. Sirf
 * `presetId` rakhne par project kholne ke liye DB se preset laana zaroori ho
 * jaata — aur preset delete ho jaaye to purani reel ka rang chup-chaap badal
 * jaata. Yahan ki copy use jama deti hai.
 */
export const BrandSchema = z.object({
  presetId: z.string().min(1).nullable(),
  /** Preset ke upar is project ke apne token. Khaali = preset jaisa hi. */
  tokens: z.record(z.string()).default({}),
  logoAssetId: IdSchema.nullable().default(null),
  watermark: WatermarkSchema.default({}),
  cta: z
    .object({
      text: z.string().default(""),
      link: z.string().default(""),
    })
    .default({}),
  endScreen: EndScreenSchema.default({}),
});

export const MetaSchema = z.object({
  createdBy: z.enum(["manual", "ai", "template"]),
  sourceStory: z.string().nullable(),
  /**
   * Wizard ki yaadgaar — samajhne ka kaam `wizard/memory.ts` karta hai.
   *
   * ⚠️ `z.unknown()` jaan-boojhkar hai. Yahan sakht schema rakhne par draft ka
   * shape badalte hi har purana doc parse hona band kar deta — aur doc parse na
   * hone ka matlab **render fail** hai (worker `parseDoc` se guzarta hai). Ek UI
   * ki suvidha kabhi video banne ke beech me nahi aani chahiye.
   *
   * ⚠️ `optional` hai, isliye purane doc bina badle khulte hain aur
   * `SCHEMA_VERSION` badalne ki koi zaroorat nahi.
   */
  wizard: z.unknown().optional(),
});

const DocShape = z.object({
  version: z.literal(SCHEMA_VERSION),
  project: ProjectSettingsSchema,
  tracks: z.array(TrackSchema),
  items: z.array(ItemSchema),
  scenes: z.array(SceneSchema),
  markers: z.array(MarkerSchema).default([]),
  brand: BrandSchema,
  meta: MetaSchema,
});

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Poora doc + referential integrity.
 *
 * Ye checks schema me hi rakhe hain (alag helper me nahi) kyunki ek toota
 * reference — item ka gayab track — renderer me jaakar aisi jagah phatta hai
 * jahan se asli wajah dhoondhna mushkil ho jaata hai.
 */
export const DocSchema = DocShape.superRefine((doc, ctx) => {
  const trackIds = doc.tracks.map((track) => track.id);
  const itemIds = doc.items.map((item) => item.id);
  const sceneIds = doc.scenes.map((scene) => scene.id);

  for (const [label, ids, path] of [
    ["track", trackIds, "tracks"],
    ["item", itemIds, "items"],
    ["scene", sceneIds, "scenes"],
  ] as const) {
    const duplicates = findDuplicates(ids);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `Duplicate ${label} id: ${duplicates.join(", ")}`,
      });
    }
  }

  const trackIdSet = new Set(trackIds);
  const itemIdSet = new Set(itemIds);
  const sceneIdSet = new Set(sceneIds);

  doc.items.forEach((item, index) => {
    if (!trackIdSet.has(item.trackId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "trackId"],
        message: `Item "${item.id}" ka track "${item.trackId}" maujood nahi hai`,
      });
    }
    if (item.sceneId !== null && !sceneIdSet.has(item.sceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "sceneId"],
        message: `Item "${item.id}" ka scene "${item.sceneId}" maujood nahi hai`,
      });
    }
  });

  doc.scenes.forEach((scene, index) => {
    scene.itemIds.forEach((id, itemIndex) => {
      if (!itemIdSet.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenes", index, "itemIds", itemIndex],
          message: `Scene "${scene.id}" ek gayab item "${id}" ko point kar raha hai`,
        });
      }
    });
  });
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Crop = z.infer<typeof CropSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type FitBackground = z.infer<typeof FitBackgroundSchema>;
export type Fit = z.infer<typeof FitSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type Keyframes = z.infer<typeof KeyframesSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Mask = z.infer<typeof MaskSchema>;
export type Marker = z.infer<typeof MarkerSchema>;
export type Watermark = z.infer<typeof WatermarkSchema>;
export type Mockup = z.infer<typeof MockupSchema>;
export type Subtitle = z.infer<typeof SubtitleSchema>;
export type AudioSource = z.infer<typeof AudioSourceSchema>;
export type Ducking = z.infer<typeof DuckingSchema>;
export type MasterAudio = z.infer<typeof MasterAudioSchema>;
export type BlendMode = (typeof BLEND_MODES)[number];
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type TextSpec = z.infer<typeof TextSpecSchema>;
export type ShapeSpec = z.infer<typeof ShapeSpecSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Doc = z.infer<typeof DocSchema>;

/** Sakht parse — galat doc par saaf error. */
export function parseDoc(input: unknown): Doc {
  return DocSchema.parse(input);
}

export function safeParseDoc(input: unknown): z.SafeParseReturnType<unknown, Doc> {
  return DocSchema.safeParse(input);
}

/** Item ka aakhri frame (exclusive) — timeline ka sabse zyada dohraaya jaane wala hisaab. */
export function itemEndFrame(item: Pick<Item, "startFrame" | "durationInFrames">): number {
  return item.startFrame + item.durationInFrames;
}
