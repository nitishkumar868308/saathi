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

  {
    id: "video",
    label: "Video",
    icon: "Video",
    hint: "Ek video clip",
    group: "media",
    slots: [
      { id: "video", label: "Video", kind: "asset:video", required: true },
      CAPTION_SLOT,
    ],
    defaultDurationSeconds: 6,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(6, input.fps);
      const items: Item[] = [];
      const video = slotString(input.slots, "video");

      if (video) {
        items.push(
          createItem("video", {
            fps: input.fps,
            trackId: "",
            name: "Video",
            assetId: video,
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
    hint: "Aakhri call-to-action — text + peeche ek band",
    group: "text",
    slots: [
      { id: "text", label: "CTA text", kind: "text", required: true, multiline: true },
    ],
    defaultDurationSeconds: 3,
    build: (input) => {
      const duration = input.durationInFrames ?? durationFromSeconds(3, input.fps);
      const content = slotString(input.slots, "text");
      if (!content) return [];

      // Peeche ka band — CTA ko baaki reel se alag dikhata hai.
      const band = createItem("shape", {
        fps: input.fps,
        trackId: "",
        name: "CTA band",
        startFrame: 0,
        durationInFrames: duration,
      });
      const text = createItem("text", {
        fps: input.fps,
        trackId: "",
        name: content.slice(0, 40),
        startFrame: 0,
        durationInFrames: duration,
      });

      return tag(
        [
          band,
          { ...text, text: { ...(text.text as NonNullable<Item["text"]>), content } },
        ],
        input.sceneId,
      );
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
