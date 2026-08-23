import { z } from "zod";

import { createItem } from "../schema/factory";
import type { Item } from "../schema/project";
import { DEFAULT_DEVICE_ID } from "../config/devices";
import { durationFromSeconds } from "../time";
import { createRegistry, type Registry } from "./types";

/**
 * SCENE_TYPES — "koi bhi video bana sake" wala hissa (12.1).
 *
 * ⚠️ **Sabse zaroori baat: manual scene aur AI scene ek hi cheez hain.**
 * `build()` hi wo ekmatra jagah hai jahan scene se items bante hain, aur Scene
 * Cards ka form bhi wahi bulata hai aur Phase 21 ka AI bhi. Do raaste rakhne par
 * do editor ban jaate hain — aur unme se ek hamesha thoda peeche reh jaata hai
 * (AI ke banaye scene me wo cheez nahi hoti jo haath se banane par hoti hai, ya
 * ulta). Ye Section E ka locked faisla hai.
 *
 * ⚠️ `slots` **declarative** hain (12.2). UI unhi se banta hai — `asset:image`
 * dekh kar picker, `text` dekh kar khaana. Har scene type ke liye haath se form
 * likhna wahi galti hoti jo properties panel me hoti (Dynamic rule 2).
 */

/** Ek slot kya maangta hai. UI isi se apna control chunta hai. */
export type SlotKind =
  | "asset:image"
  | "asset:video"
  | "asset:audio"
  | "asset:any"
  | "text"
  | "number";

export interface SlotDef {
  id: string;
  label: string;
  kind: SlotKind;
  /** `false` = bina iske bhi scene ban jaata hai. */
  required: boolean;
  hint?: string;
  /** `text` slot ke liye — kai lineon ka khaana chahiye? */
  multiline?: boolean;
}

export interface SceneBuildInput {
  /** Slot ki values — `{ image: "as_123", caption: "Namaste" }`. */
  slots: Record<string, unknown>;
  fps: number;
  /**
   * Project ka frame naap.
   *
   * WARNING: Ye isliye chahiye ki kuch scene apne items ko frame ke hisaab se
   * jagah dete hain (CTA ki patti, logo). Bina iske wahan pixel likhne padte,
   * aur wo 1080x1920 ke alawa har naap par galat baith jaate - `widthPercent`
   * wale comment me yahi baat likhi hai: magic pixels se bachna hai.
   */
  width: number;
  height: number;
  /** Scene kitna lamba ho (frames). Na ho to type ka default. */
  durationInFrames?: number;
  /** Scene ka id — bane hue items par `sceneId` isi se lagti hai. */
  sceneId: string;
}

export interface SceneTypeEntry {
  id: string;
  label: string;
  icon: string;
  hint: string;
  /** UI me grouping — "media" / "text" / "audio" / "special". */
  group: "media" | "text" | "audio" | "special";
  slots: readonly SlotDef[];
  defaultDurationSeconds: number;
  /**
   * Scene se items banao.
   *
   * ⚠️ Ye **pure** hai — DB, storage aur registry ke alawa kisi cheez ko nahi
   * jaanta. Isi wajah se AI ka patch aur haath ka form dono isko bula sakte
   * hain, aur dono ka nateeja bilkul ek jaisa hota hai.
   */
  build(input: SceneBuildInput): Item[];
}

/* ------------------------------------------------------------- helpers */

function slotString(slots: Record<string, unknown>, key: string): string | null {
  const value = slots[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/** Har scene type ke items par `sceneId` lagta hai — ek jagah, taaki chhoote na. */
function tag(items: Item[], sceneId: string): Item[] {
  return items.map((item) => ({ ...item, sceneId }));
}

/* ---------------------------------------------------------- built-ins */

const CAPTION_SLOT: SlotDef = {
  id: "caption",
  label: "Caption",
  kind: "text",
  required: false,
  multiline: true,
  hint: "Screen par dikhne wala text (khaali chhod sakte ho)",
};

const AUDIO_SLOT: SlotDef = {
  id: "audio",
  label: "Awaaz",
  kind: "asset:audio",
  required: false,
  hint: "Voiceover ya koi bhi audio",
};

/** Caption ka text item — kai scene types me chahiye, isliye ek hi jagah. */
function captionItem(input: SceneBuildInput, duration: number): Item[] {
  const caption = slotString(input.slots, "caption");
  if (!caption) return [];

  const item = createItem("text", {
    fps: input.fps,
    trackId: "",
    name: caption.slice(0, 40),
    startFrame: 0,
    durationInFrames: duration,
  });
  return [{ ...item, text: { ...(item.text as NonNullable<Item["text"]>), content: caption } }];
}

export const BUILTIN_SCENE_TYPES: readonly SceneTypeEntry[] = [
  {
    id: "image",
    label: "Image",
    icon: "Image",
    hint: "Ek tasveer, chahe to caption ke saath",
    group: "media",
    slots: [
      { id: "image", label: "Tasveer", kind: "asset:image", required: true },
      CAPTION_SLOT,
    ],
    defaultDurationSeconds: 4,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(4, input.fps);
      const image = slotString(input.slots, "image");
      const items: Item[] = [];

      if (image) {
        items.push(
          createItem("image", {
            fps: input.fps,
            trackId: "",
            name: "Image",
            assetId: image,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }
      items.push(...captionItem(input, duration));
      return tag(items, input.sceneId);
    },
  },

  {
    id: "image_audio",
    label: "Image + awaaz",
    icon: "Image",
    hint: "Tasveer ke saath voiceover — reel ka sabse aam scene",
    group: "media",
    slots: [
      { id: "image", label: "Tasveer", kind: "asset:image", required: true },
      AUDIO_SLOT,
      CAPTION_SLOT,
    ],
    defaultDurationSeconds: 5,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(5, input.fps);
      const items: Item[] = [];

      const image = slotString(input.slots, "image");
      if (image) {
        items.push(
          createItem("image", {
            fps: input.fps,
            trackId: "",
            name: "Image",
            assetId: image,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      const audio = slotString(input.slots, "audio");
      if (audio) {
        items.push(
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: audio,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      items.push(...captionItem(input, duration));
      return tag(items, input.sceneId);
    },
  },

  /*
   * Text + awaaz, bina tasveer ke (26.6).
   *
   * ⚠️ Ye scene type wizard ki wajah se aaya, aur wo wajah ek chup-chaap hone
   * wale nuksaan ki thi. Wizard me aadmi tasveer "chhod" sakta hai. Us haalat me
   * `image_audio` nahi ban sakta (uska image slot required hai), aur seedha
   * `text` par girne par **uski banayi hui awaaz gayab ho jaati** — `text` me
   * audio ka slot hai hi nahi. Kuch toota hua nahi dikhta: scene banta hai, text
   * dikhta hai, bas awaaz chali jaati hai.
   *
   * Aur `audio` ("sirf awaaz") par girna ulta nuksaan karta — wahan caption ka
   * slot nahi hai, yaani screen se text gayab.
   *
   * Isliye ye beech ki jagah: text dikhta hai, awaaz chalti hai, tasveer ki
   * zaroorat nahi.
   */
  {
    id: "text_audio",
    label: "Text + awaaz",
    icon: "Mic",
    hint: "Bina tasveer ke — screen par text, peeche voiceover",
    group: "text",
    slots: [
      { id: "text", label: "Text", kind: "text", required: true, multiline: true },
      AUDIO_SLOT,
    ],
    defaultDurationSeconds: 4,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(4, input.fps);
      const items: Item[] = [];

      const content = slotString(input.slots, "text");
      if (content) {
        const item = createItem("text", {
          fps: input.fps,
          trackId: "",
          name: content.slice(0, 40),
          startFrame: 0,
          durationInFrames: duration,
        });
        items.push({
          ...item,
          text: { ...(item.text as NonNullable<Item["text"]>), content },
        });
      }

      const audio = slotString(input.slots, "audio");
      if (audio) {
        items.push(
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: audio,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      return tag(items, input.sceneId);
    },
  },

  {
    id: "video",
    label: "Video",
    icon: "Video",
    hint: "Ek video clip",
    group: "media",
    /*
     * WARNING: `AUDIO_SLOT` yahan wizard ki wajah se aaya. Wizard me aadmi kisi
     * bhi scene par tasveer ki jagah video daal sakta hai. Bina is slot ke us
     * scene ka type `video` banta aur uski BANAYI HUI AWAAZ chup-chaap gayab ho
     * jaati - scene banta, video chalti, bas voiceover chala jaata. Wahi galti
     * pehle `text` ke saath ho chuki thi (dekho `text_audio`).
     */
    slots: [
      { id: "video", label: "Video", kind: "asset:video", required: true },
      AUDIO_SLOT,
      CAPTION_SLOT,
    ],
    defaultDurationSeconds: 6,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(6, input.fps);
      const items: Item[] = [];
      const video = slotString(input.slots, "video");
      const audio = slotString(input.slots, "audio");

      if (video) {
        const clip = createItem("video", {
          fps: input.fps,
          trackId: "",
          name: "Video",
          assetId: video,
          startFrame: 0,
          durationInFrames: duration,
        });
        /*
         * WARNING: Voiceover ho to video ki APNI awaaz band. Ye chala kar dekhne
         * par mila aur pehle sunai nahi diya tha: dono awaazein poore volume par
         * ek saath chalti thi. Phone ke speaker par uska nateeja ye hota hai ki
         * voiceover sunai hi nahi deta — aadmi ko lagta hai ki uski banayi hui
         * awaaz lagi hi nahi, jabki wo chal rahi hoti hai, bas video ke shor ke
         * neeche dabi hui.
         *
         * Aur us halat me aadmi kar bhi kuch nahi sakta: video ka volume kahin
         * poochha nahi jaata, aur "awaaz lag gayi" screen par likha aata hai.
         *
         * Yahan chup karna sahi default hai, kam volume nahi: voiceover wali reel
         * me footage ki apni awaaz (hawa, bheed, camera ki khadak) kuch jodti
         * nahi. Jise chahiye wo editor me ek switch se wapas la sakta hai.
         */
        items.push(audio ? { ...clip, audio: { ...clip.audio, muted: true } } : clip);
      }
      if (audio) {
        items.push(
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: audio,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      items.push(...captionItem(input, duration));
      return tag(items, input.sceneId);
    },
  },

  {
    id: "screen_recording",
    label: "Screen recording",
    icon: "MonitorPlay",
    hint: "App ka screen — phone frame ke saath (18.5)",
    group: "media",
    slots: [
      { id: "video", label: "Recording", kind: "asset:video", required: true },
      /*
       * WARNING: Chauthi baar wahi galti. `text`, `video` aur `cta` — teeno me ye
       * slot baad me is liye jodna pada ki uske bina wizard ki banayi hui awaaz
       * CHUP-CHAAP gir jaati thi. Screen recording par to wo aur bhi zaroori hai:
       * app ka screen dikhana hai aur uske upar bolna hai — wahi is scene ka poora
       * matlab hai.
       */
      AUDIO_SLOT,
      CAPTION_SLOT,
      /*
       * Phone frame **default ON** (18.5).
       *
       * `"raw"` bharne par frame nahi lagta. Default on isliye hai ki is scene
       * ka poora matlab hi "app dikhana" hai, aur bina frame ke recording ek
       * chipka hua rectangle lagti hai. Jise raw chahiye wo ek shabd likh kar
       * hata sakta hai — par default wahi hona chahiye jo 90% baar chahiye.
       */
      {
        id: "frame",
        label: "Phone frame",
        kind: "text",
        required: false,
        hint: '"raw" likho to frame nahi lagega',
      },
    ],
    defaultDurationSeconds: 8,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(8, input.fps);
      const items: Item[] = [];
      const video = slotString(input.slots, "video");

      if (video) {
        const item = createItem("video", {
          fps: input.fps,
          trackId: "",
          name: "Screen recording",
          assetId: video,
          startFrame: 0,
          durationInFrames: duration,
        });
        /*
         * Screen recording aksar 16:9 hoti hai aur reel 9:16 — isliye default
         * `contain` + blurred background. `cover` par app ka aadha screen kat
         * jaata hai, jo is scene ka poora matlab hi khatam kar deta hai.
         */
        const raw = slotString(input.slots, "frame") === "raw";

        items.push({
          ...item,
          /*
           * Frame ke andar `cover` sahi hai (screen poori bhare), aur bina frame
           * ke `contain` — kyunki tab recording ko poora dikhna hota hai aur
           * uske kinare kat nahi sakte.
           */
          fit: raw
            ? { mode: "contain", background: { kind: "blurred-asset", value: null } }
            : { mode: "cover", background: { kind: "blurred-asset", value: null } },
          mockup: raw
            ? null
            : {
                deviceId: DEFAULT_DEVICE_ID,
                colorId: "graphite",
                // Naye mockup par koi tap nahi (18.11) — nishaan user khud jodta hai.
                taps: [],
                widthPercent: 58,
                shadow: true,
                glare: false,
                tiltX: 0,
                tiltY: 0,
                screenFit: "cover" as const,
              },
        });
      }
      /*
       * Voiceover — video ki apni awaaz band karke. Wahi wajah jo `video` scene
       * me likhi hai: dono ek saath chalein to voiceover suna hi nahi jaata.
       */
      const narration = slotString(input.slots, "audio");
      if (narration) {
        const last = items[items.length - 1];
        if (last?.type === "video") {
          items[items.length - 1] = { ...last, audio: { ...last.audio, muted: true } };
        }
        items.push(
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: narration,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      items.push(...captionItem(input, duration));
      return tag(items, input.sceneId);
    },
  },

  {
    id: "text",
    label: "Text",
    icon: "Type",
    hint: "Sirf text — hook, statement, ya sawaal",
    group: "text",
    slots: [
      {
        id: "text",
        label: "Text",
        kind: "text",
        required: true,
        multiline: true,
      },
    ],
    defaultDurationSeconds: 3,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      const content = slotString(input.slots, "text");
      if (!content) return [];

      const item = createItem("text", {
        fps: input.fps,
        trackId: "",
        name: content.slice(0, 40),
        startFrame: 0,
        durationInFrames: duration,
      });
      return tag(
        [{ ...item, text: { ...(item.text as NonNullable<Item["text"]>), content } }],
        input.sceneId,
      );
    },
  },

  {
    id: "cta",
    label: "CTA",
    icon: "Square",
    hint: "Aakhri call-to-action — logo, ek line, aur ek button",
    group: "text",
    slots: [
      { id: "text", label: "CTA text", kind: "text", required: true, multiline: true },
      {
        id: "logo",
        label: "Logo",
        kind: "asset:image",
        required: false,
        hint: "Brand ka logo — sabse upar. Khaali chhod sakte ho.",
      },
      /*
       * Button par kya likha ho.
       *
       * WARNING: Iska default khaali NAHI hai. CTA ka poora kaam ek hi hai —
       * aadmi ko batana ki ab karna kya hai — aur wo baat aksar us lambi line me
       * dabi reh jaati hai jo AI likhta hai ("Apka Saathi - aapka digital
       * document manager. Abhi download karein."). Ek chhota, saaf button us
       * baat ko poori line se alag kar deta hai. Khaali default rakhne par
       * button kabhi bhara hi nahi jaata, aur CTA wapas ek paragraph ban jaata.
       */
      {
        id: "button",
        label: "Button ka text",
        kind: "text",
        required: false,
        hint: 'Khaali chhodo to "Abhi download karein" lagta hai',
      },
      /*
       * WARNING: Ye slot teesri baar wahi galti pakadne ke baad aaya. Wizard me
       * aadmi CTA par awaaz banata hai, screen par "awaaz lag gayi" bhi likha
       * aata hai — aur apply ke waqt wo CHUP-CHAAP GIR jaati hai, kyunki is type
       * me audio ka slot hi nahi tha. Reel banti hai, CTA dikhta hai, bas aakhri
       * line boli nahi jaati. Pehle `text` ke saath hua tha (`text_audio` bana),
       * phir `video` ke saath, ab yahan.
       */
      AUDIO_SLOT,
    ],
    defaultDurationSeconds: 3,
    /**
     * CTA ka layout — **teen cheezein, oopar se neeche** (26.21).
     *
     * WARNING: Yahan ek bhi `shape` item nahi hai, aur ye is poore build ka sabse
     * zaroori faisla hai. Is system me z-order **track** se aata hai, aur track
     * item ke TYPE se milta hai (`trackForItem`) — aur wo track tab banta hai jab
     * us type ka pehla item aata hai. Yaani shape text ke upar aayega ya neeche,
     * ye is baat par nirbhar karta hai ki poore doc me pehle text aaya tha ya
     * shape. Ek CTA ke liye wo jawab poori reel ke banne ke tarike par tika hota
     * hai — aur wahi wo bug tha jisme naarangi dabba text ko dhak leta tha.
     *
     * Button isliye ek `shape` + uske upar `text` nahi hai. Wo ek hi text item
     * hai jiska apna `background` hai. Uska pallaa hamesha uske apne text ke
     * peeche rehta hai, kyunki wo alag item hai hi nahi — ye baat kisi track ke
     * kram par tiki hui nahi hai, aur toot bhi nahi sakti.
     */
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      const content = slotString(input.slots, "text");
      if (!content) return [];

      const items: Item[] = [];

      /*
       * Logo — sabse upar aur bada.
       *
       * WARNING: Pehle ye 0.17 scale par tha aur frame ke beech ke paas baithta
       * tha. Screen par wo ek chhoti si chipki hui cheez lagti thi — brand nahi,
       * ek nishaan. CTA wo ek frame hai jise aadmi screenshot leta hai; wahan
       * logo ko jagah chahiye.
       */
      const logoId = slotString(input.slots, "logo");
      if (logoId) {
        const logo = createItem("image", {
          fps: input.fps,
          trackId: "",
          name: "Logo",
          assetId: logoId,
          startFrame: 0,
          durationInFrames: duration,
        });
        items.push({
          ...logo,
          transform: { ...logo.transform, y: -Math.round(input.height * 0.2), scale: 0.34 },
        });
      }

      /*
       * Asli line. Logo ho to wo thodi neeche khisakti hai — warna dono ek doosre
       * ke gale me baith jaate hain.
       */
      const headBase = createItem("text", {
        fps: input.fps,
        trackId: "",
        name: content.slice(0, 40),
        startFrame: 0,
        durationInFrames: duration,
      });
      const headSpec = headBase.text as NonNullable<Item["text"]>;
      items.push({
        ...headBase,
        transform: {
          ...headBase.transform,
          y: logoId ? Math.round(input.height * 0.01) : -Math.round(input.height * 0.04),
        },
        text: {
          ...headSpec,
          content,
          /*
           * WARNING: 72 (default) par CTA ki line teen line me toot kar poora
           * frame gher leti hai, aur logo ke saath wo bheed jaisa dikhta hai.
           * 56 par wo do line me baithti hai aur phone par bhi saaf padhi jaati
           * hai — CTA ki line waise bhi lambi nahi honi chahiye.
           */
          fontSize: 56,
          lineHeight: 1.3,
          maxWidthPercent: 78,
        },
      });

      /*
       * Button. Ye ek text item hai jiska apna background hai — dekho upar wala
       * note ki wo shape kyun nahi hai.
       */
      const label = slotString(input.slots, "button") || "Abhi download karein";
      const buttonBase = createItem("text", {
        fps: input.fps,
        trackId: "",
        name: "CTA button",
        startFrame: 0,
        durationInFrames: duration,
      });
      const buttonSpec = buttonBase.text as NonNullable<Item["text"]>;
      items.push({
        ...buttonBase,
        transform: { ...buttonBase.transform, y: Math.round(input.height * 0.17) },
        text: {
          ...buttonSpec,
          content: label,
          /*
           * Button body font me hai, display (serif) me nahi — aur ye jaan-boojhkar
           * hai. Button ek cheez hai jise dabaya jaata hai; serif me wo padhne
           * wali line lagta hai, button nahi.
           */
          fontFamily: "brand.font.body",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: 0.5,
          lineHeight: 1,
          maxWidthPercent: 86,
          // Gehre rang par gehra text nahi — brand.textOnAccent isi ke liye hai.
          color: "brand.textOnAccent",
          background: { color: "brand.primary", paddingX: 56, paddingY: 28, radius: 60 },
        },
      });

      const ctaAudio = slotString(input.slots, "audio");
      if (ctaAudio) {
        items.push(
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: ctaAudio,
            startFrame: 0,
            durationInFrames: duration,
          }),
        );
      }

      return tag(items, input.sceneId);
    },
  },

  {
    id: "audio",
    label: "Sirf awaaz",
    icon: "Mic",
    hint: "Voiceover jo peeche chalti rahe",
    group: "audio",
    slots: [{ ...AUDIO_SLOT, required: true }],
    defaultDurationSeconds: 10,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(10, input.fps);
      const audio = slotString(input.slots, "audio");
      if (!audio) return [];

      return tag(
        [
          createItem("audio", {
            fps: input.fps,
            trackId: "",
            name: "Awaaz",
            assetId: audio,
            startFrame: 0,
            durationInFrames: duration,
          }),
        ],
        input.sceneId,
      );
    },
  },

  {
    id: "music",
    label: "Music",
    icon: "Music",
    hint: "Background music — volume apne aap kam",
    group: "audio",
    slots: [{ id: "audio", label: "Music", kind: "asset:audio", required: true }],
    defaultDurationSeconds: 15,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(15, input.fps);
      const audio = slotString(input.slots, "audio");
      if (!audio) return [];

      const item = createItem("audio", {
        fps: input.fps,
        trackId: "",
        name: "Music",
        assetId: audio,
        startFrame: 0,
        durationInFrames: duration,
      });
      /*
       * Music ka volume default 0.25 — poore volume par wo voiceover ko dabaa
       * deta hai, aur naya user samajh hi nahi paata ki awaaz kyun nahi sun
       * rahi. Ducking (voice aane par apne aap kam) Phase 15 me hai.
       */
      return tag(
        [{ ...item, audio: { ...item.audio, volume: 0.25 } }],
        input.sceneId,
      );
    },
  },

  {
    id: "overlay",
    label: "Overlay",
    icon: "Layers",
    hint: "Upar chipakne wali tasveer — logo, sticker",
    group: "special",
    slots: [
      { id: "image", label: "Tasveer", kind: "asset:image", required: true },
    ],
    defaultDurationSeconds: 3,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      const image = slotString(input.slots, "image");
      if (!image) return [];

      const item = createItem("image", {
        fps: input.fps,
        trackId: "",
        name: "Overlay",
        assetId: image,
        startFrame: 0,
        durationInFrames: duration,
      });
      // Overlay poora frame nahi ghairta — wo upar chipakne wali cheez hai.
      return tag(
        [{ ...item, fit: { mode: "contain", background: { kind: "color", value: "#00000000" } }, transform: { ...item.transform, scale: 0.3 } }],
        input.sceneId,
      );
    },
  },

  {
    id: "shape",
    label: "Shape",
    icon: "Square",
    hint: "Rang ka band ya gola — text ke peeche ya divider ki tarah",
    group: "special",
    slots: [],
    defaultDurationSeconds: 3,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      return tag(
        [
          createItem("shape", {
            fps: input.fps,
            trackId: "",
            name: "Shape",
            startFrame: 0,
            durationInFrames: duration,
          }),
        ],
        input.sceneId,
      );
    },
  },

  {
    id: "subtitle",
    label: "Subtitle",
    icon: "Captions",
    hint: "Neeche wali line — poori auto-captions Phase 19/23 me",
    group: "text",
    slots: [
      { id: "text", label: "Subtitle", kind: "text", required: true, multiline: true },
    ],
    defaultDurationSeconds: 3,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      const content = slotString(input.slots, "text");
      if (!content) return [];

      const item = createItem("text", {
        fps: input.fps,
        trackId: "",
        name: content.slice(0, 40),
        startFrame: 0,
        durationInFrames: duration,
      });
      return tag(
        [
          {
            ...item,
            text: {
              ...(item.text as NonNullable<Item["text"]>),
              content,
              // Subtitle neeche baithti hai aur chhoti hoti hai — yahi uska
              // matlab hai. Iske bina wo ek aur "text scene" ban jaata.
              verticalAlign: "bottom",
              fontSize: 44,
              maxWidthPercent: 85,
            },
          },
        ],
        input.sceneId,
      );
    },
  },
];

/*
 * ⚠️ `character` aur `lipsync` **jaan-boojhkar nahi hain**.
 *
 * Checklist 12.1 me unke naam hain, par unke peeche ka poora system Phase 22
 * (TTS + characters) aur Phase 24 (lip-sync) me hai. Aaj unki khaali entry
 * daal dena matlab UI me do aise card dikhana jinhe chunte hi kuch nahi hota —
 * wahi "fake feature" jisse README ka rule 5 bachne ko kehta hai. Un phases me
 * ye do entries yahan judegi, aur tab UI me apne aap aa jaayengi.
 */

export const SCENE_TYPES: Registry<SceneTypeEntry> = createRegistry<SceneTypeEntry>("SCENE_TYPES");

export function registerSceneType(entry: SceneTypeEntry): void {
  SCENE_TYPES.register(entry);
}

export function listSceneTypes(): readonly SceneTypeEntry[] {
  return SCENE_TYPES.list();
}

export function getSceneType(id: string): SceneTypeEntry | undefined {
  return SCENE_TYPES.get(id);
}

export function requireSceneType(id: string): SceneTypeEntry {
  return SCENE_TYPES.require(id);
}

/** Slot ki value bharni zaroori hai par bhari nahi — form isse batata hai. */
export function missingRequiredSlots(
  typeId: string,
  slots: Record<string, unknown>,
): SlotDef[] {
  const entry = getSceneType(typeId);
  if (!entry) return [];
  return entry.slots.filter((slot) => {
    if (!slot.required) return false;
    const value = slots[slot.id];
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  });
}

/** Slot kis asset kind ko maangta hai — media picker isse filter karta hai. */
export function assetKindForSlot(slot: SlotDef): string | null {
  if (slot.kind === "asset:image") return "image";
  if (slot.kind === "asset:video") return "video";
  if (slot.kind === "asset:audio") return "audio";
  if (slot.kind === "asset:any") return null;
  return null;
}

export const SceneSlotsSchema = z.record(z.unknown());
