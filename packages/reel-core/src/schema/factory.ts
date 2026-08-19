import {
  DEFAULT_CONTAIN_BACKGROUND,
  DEFAULT_FIT_MODE,
} from "../config/fit";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_FPS,
  DEFAULT_PROJECT_DURATION_SECONDS,
  DEFAULT_SIZE_PRESET_ID,
  resolveSize,
} from "../config/presets";
import { createId } from "../id";
import {
  requireItemType,
  requireTrackType,
} from "../registry/index";
import { DEFAULT_INITIAL_TRACK_TYPES } from "../registry/trackTypes";
import { durationFromSeconds } from "../time";
import {
  parseDoc,
  SCHEMA_VERSION,
  type Doc,
  type Item,
  type Track,
} from "./project";

/**
 * Naye doc / item / track banane ki ekmatra jagah.
 *
 * Defaults **registry** se aate hain, yahan hardcode nahi. Isliye naya item type
 * banane par usko "create" karna apne aap kaam karne lagta hai — is file me kuch
 * badalna nahi padta.
 *
 * ⚠️ Pehle yahan top-level par `registerBuiltins()` bulaya jaata tha. Wo Phase 12
 * me tootа: `SCENE_TYPES` ke `build()` ko `createItem` chahiye, isliye
 * `registry/index` -> `sceneTypes` -> `schema/factory` -> `registry/index` ka
 * chakkar ban gaya, aur factory ka call registry ke aadhe bane hue module par
 * chal padta ("Cannot access 'registered' before initialization").
 *
 * Ab wo call sirf `registry/index.ts` ke ant me hai — jo waise bhi sahi jagah
 * hai, kyunki registry ko bharne ka kaam registry ka hai, factory ka nahi. Ye
 * file `requireItemType` bulate hi registry ko import kar leti hai, isliye
 * registration tab tak ho chuka hota hai.
 */

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ek-level nahi, poora nested merge — par arrays replace hote hain.
 * (Arrays merge karne se `animations: []` dena kabhi kaam hi nahi karta.)
 */
function deepMerge<T extends PlainObject>(base: T, patch: PlainObject | undefined): T {
  if (!patch) return base;
  const out: PlainObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Nested bhi partial — `createItem("text", { text: { content: "Namaste" } })`
 * likhne par baaki text defaults registry se bane rehte hain. Flat `Partial`
 * hota to poora TextSpec dena padta, aur har call site defaults ko dobara
 * likhta — jo exactly wo hardcoding hai jisse bachna hai.
 */
type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type CreateItemInput = DeepPartial<Omit<Item, "type">> & {
  /** Default duration seconds se frames banane ke liye. */
  fps?: number;
};

/**
 * Registry se naya item.
 *
 * `trackId` yahan optional hai — `addItem` op use track se jodta hai. Doc-level
 * schema toota reference pakad leta hai, isliye adhoora item chupke se nahi bachta.
 */
export function createItem(typeId: string, partial: CreateItemInput = {}): Item {
  const entry = requireItemType(typeId);
  const fps = partial.fps ?? DEFAULT_FPS;

  const base: Item = {
    id: createId("it"),
    trackId: "",
    type: entry.id,
    sceneId: null,
    name: entry.label,

    startFrame: 0,
    durationInFrames: durationFromSeconds(entry.defaultDurationSeconds, fps),

    trimStartFrame: 0,
    playbackRate: 1,

    assetId: null,

    transform: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      anchor: [0.5, 0.5],
      crop: null,
    },
    fit: {
      mode: DEFAULT_FIT_MODE,
      background: { kind: DEFAULT_CONTAIN_BACKGROUND, value: null },
    },

    animations: [],
    keyframes: {},
    effects: [],
    mask: null,
    blendMode: "normal" as const,
    audio: { volume: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },

    transitionIn: { type: "none", durationInFrames: 0 },
    transitionOut: { type: "none", durationInFrames: 0 },

    text: null,
    shape: null,

    hidden: false,
    locked: false,
  };

  const { fps: _ignored, ...overrides } = partial;
  // Order matter karta hai: base -> registry defaults -> caller ka patch.
  const withDefaults = deepMerge(base as unknown as PlainObject, entry.defaults);
  const merged = deepMerge(withDefaults, overrides as PlainObject);
  return merged as unknown as Item;
}

export function createTrack(typeId: string, partial: Partial<Track> = {}): Track {
  const entry = requireTrackType(typeId);
  const base: Track = {
    id: createId("tr"),
    type: entry.id,
    name: entry.label,
    order: entry.defaultOrder,
    muted: false,
    hidden: false,
    locked: false,
  };
  return deepMerge(
    deepMerge(base as unknown as PlainObject, entry.defaults),
    partial as PlainObject,
  ) as unknown as Track;
}

export interface CreateEmptyProjectInput {
  name?: string;
  /** Default `reel` (1080x1920) — README Section 3B. */
  presetId?: string;
  /** Sirf `custom` preset ke liye. */
  width?: number;
  height?: number;
  fps?: number;
  durationInSeconds?: number;
  durationInFrames?: number;
  background?: string;
  /** Kaun se tracks ke saath shuru ho. Fixed 7 tracks nahi — ye list badal sakti hai. */
  initialTrackTypes?: readonly string[];
}

export function createEmptyProject(input: CreateEmptyProjectInput = {}): Doc {
  const fps = input.fps ?? DEFAULT_FPS;
  const presetId = input.presetId ?? DEFAULT_SIZE_PRESET_ID;
  const { width, height } = resolveSize({
    presetId,
    width: input.width,
    height: input.height,
  });

  const durationInFrames =
    input.durationInFrames ??
    durationFromSeconds(input.durationInSeconds ?? DEFAULT_PROJECT_DURATION_SECONDS, fps);

  const trackTypes = input.initialTrackTypes ?? DEFAULT_INITIAL_TRACK_TYPES;
  const tracks = trackTypes.map((typeId, index) => createTrack(typeId, { order: index }));

  const doc: Doc = {
    version: SCHEMA_VERSION,
    project: {
      id: createId("p"),
      name: input.name ?? "Naya project",
      sizePresetId: presetId,
      width,
      height,
      fps,
      durationInFrames,
      background: input.background ?? DEFAULT_BACKGROUND,
    },
    tracks,
    items: [],
    scenes: [],
    brand: { presetId: null },
    meta: { createdBy: "manual", sourceStory: null },
  };

  // Factory ka output hamesha valid ho — warna galat doc dhire-dhire aage
  // sarakta hai aur render ke waqt phatta hai.
  return parseDoc(doc);
}
