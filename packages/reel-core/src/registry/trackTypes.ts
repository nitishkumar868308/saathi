import { z } from "zod";

import type { RegistryEntry } from "./types";

/**
 * TRACK_TYPES — track ke **kism**, ginti nahi.
 *
 * Yahan saat entries hain par iska matlab "saat tracks" bilkul nahi. User jitne
 * chaahe tracks bana sakta hai, kisi bhi type ke, kisi bhi order me. Fixed 7-track
 * timeline hardcode karna is poore design ke khilaf hai (Dynamic rule 5).
 */

export interface TrackTypeEntry extends RegistryEntry {
  kind: "visual" | "audio";
  /** Ye track kaun se item types le sakta hai. Khaali = sab. */
  accepts: readonly string[];
  /** Timeline me kitna ooncha dikhe (px) — UI ka hint, magic number nahi. */
  defaultHeight: number;
  /**
   * Timeline me is track ke clips ka rang.
   *
   * ⚠️ Ye **video ka rang nahi** hai — wo brand tokens se aata hai aur render me
   * jaata hai. Ye sirf editor ki khaal hai. Phir bhi yahan rakha gaya hai (Clip
   * component me nahi) kyunki 7.6 ki maang yahi hai: naya track type jodne par
   * uska rang bhi usi ek entry me aaye, kisi doosri file me switch na badhe.
   *
   * Gehre chrome par baithne layak, isliye sab thode dabe hue hain — chamakte
   * rang par safed text padha hi nahi jaata.
   */
  color: string;
  /** Naya track banate waqt default order — chhota = upar. */
  defaultOrder: number;
}

const TrackDefaultsSchema = z.object({
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
});

const commonDefaults = { muted: false, hidden: false, locked: false };

export const BUILTIN_TRACK_TYPES: readonly TrackTypeEntry[] = [
  {
    id: "video",
    label: "Video",
    icon: "Video",
    kind: "visual",
    accepts: ["video", "image"],
    defaultHeight: 64,
    color: "#3f6f8c",
    defaultOrder: 0,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "image",
    label: "Image",
    icon: "Image",
    kind: "visual",
    accepts: ["image", "video"],
    defaultHeight: 56,
    color: "#4a7a5b",
    defaultOrder: 1,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "overlay",
    label: "Overlay",
    icon: "Layers",
    kind: "visual",
    accepts: ["shape", "image", "text", "video"],
    defaultHeight: 48,
    color: "#6b5a94",
    defaultOrder: 2,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "text",
    label: "Text",
    icon: "Type",
    kind: "visual",
    accepts: ["text"],
    defaultHeight: 44,
    color: "#b07a34",
    defaultOrder: 3,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "subtitle",
    label: "Subtitle",
    icon: "Captions",
    kind: "visual",
    accepts: ["text"],
    defaultHeight: 40,
    color: "#98603a",
    defaultOrder: 4,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "audio",
    label: "Voice / Audio",
    icon: "Mic",
    kind: "audio",
    accepts: ["audio", "video"],
    defaultHeight: 48,
    color: "#2f7a72",
    defaultOrder: 5,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
  {
    id: "music",
    label: "Music",
    icon: "Music",
    kind: "audio",
    accepts: ["audio"],
    defaultHeight: 48,
    color: "#8a4f6b",
    defaultOrder: 6,
    schema: TrackDefaultsSchema,
    defaults: commonDefaults,
    controls: [],
    keyframable: [],
  },
];

/** Naya khaali project kaun se tracks ke saath shuru ho. Saat nahi — do. */
export const DEFAULT_INITIAL_TRACK_TYPES: readonly string[] = ["video", "audio"];
