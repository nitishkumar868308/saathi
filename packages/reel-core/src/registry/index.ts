import type { Doc } from "../schema/project";
import { ASSET_KINDS, BUILTIN_ASSET_KINDS } from "./assetKinds";
import { BUILTIN_EXPORT_PRESETS, type ExportPresetEntry } from "./exportPresets";
import { ANIMATIONS, BUILTIN_ANIMATIONS } from "./animations";
import { BUILTIN_EFFECTS, EFFECTS } from "./effects";
import { BUILTIN_ITEM_TYPES, type ItemTypeEntry } from "./itemTypes";
import { BUILTIN_SCENE_TYPES, SCENE_TYPES } from "./sceneTypes";
import { BUILTIN_TRANSITIONS, TRANSITIONS } from "./transitions";
import { BUILTIN_TRACK_TYPES, type TrackTypeEntry } from "./trackTypes";
import { createRegistry, type Registry, type RegistryEntry } from "./types";

/**
 * Saari registries ek jagah.
 *
 * Aadha product yahin se chalta hai: timeline, properties panel, sidebar,
 * renderer aur validation — sab in lists ko padhte hain. Isliye naya feature
 * jodna matlab ek file + ek entry, poore codebase me edit nahi.
 *
 * Bhari hui: ITEM_TYPES, TRACK_TYPES, EXPORT_PRESETS, ASSET_KINDS, ANIMATIONS,
 * TRANSITIONS.
 * Abhi khaali (entries apne-apne phase me aayengi):
 * VALIDATION_RULES (20). Khaali registry rakhna zaroori hai taaki UI aaj hi list
 * par map kar sake aur baad me koi rewiring na karni pade.
 */

// ---------------------------------------------------------------- item types

export const ITEM_TYPES: Registry<ItemTypeEntry> = createRegistry<ItemTypeEntry>("ITEM_TYPES");

export function registerItemType(entry: ItemTypeEntry): void {
  ITEM_TYPES.register(entry);
}

export function getItemType(id: string): ItemTypeEntry | undefined {
  return ITEM_TYPES.get(id);
}

export function requireItemType(id: string): ItemTypeEntry {
  return ITEM_TYPES.require(id);
}

export function listItemTypes(): readonly ItemTypeEntry[] {
  return ITEM_TYPES.list();
}

// --------------------------------------------------------------- track types

export const TRACK_TYPES: Registry<TrackTypeEntry> =
  createRegistry<TrackTypeEntry>("TRACK_TYPES");

export function registerTrackType(entry: TrackTypeEntry): void {
  TRACK_TYPES.register(entry);
}

export function getTrackType(id: string): TrackTypeEntry | undefined {
  return TRACK_TYPES.get(id);
}

export function requireTrackType(id: string): TrackTypeEntry {
  return TRACK_TYPES.require(id);
}

export function listTrackTypes(): readonly TrackTypeEntry[] {
  return TRACK_TYPES.list();
}

/** Ye item is track par gir sakta hai? Drag-drop aur AI dono yahi poochhte hain. */
export function trackAccepts(trackTypeId: string, itemTypeId: string): boolean {
  const trackType = TRACK_TYPES.get(trackTypeId);
  if (!trackType) return false;
  if (trackType.accepts.length === 0) return true;
  return trackType.accepts.includes(itemTypeId);
}

// ------------------------------------------------- abhi khaali (aage ke phases)

/**
 * Export presets — Section 3A ka quality bar. Entries `exportPresets.ts` me hain
 * (Phase 3 me hi bhar di gayin, kyunki renderer ko CRF kahin se lena tha).
 */
export const EXPORT_PRESETS: Registry<ExportPresetEntry> =
  createRegistry<ExportPresetEntry>("EXPORT_PRESETS");

export function requireExportPreset(id: string): ExportPresetEntry {
  return EXPORT_PRESETS.require(id);
}

/**
 * Phase 20 — quality validation. **Rule list hai, if-else spaghetti nahi**
 * (Dynamic rule 11): nayi check = yahan ek entry.
 */
export type ValidationSeverity = "info" | "warning" | "critical";

export interface ValidationIssue {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  /** Kis cheez par lagi — item id, track id, ya null (poore doc par). */
  targetId: string | null;
}

export interface ValidationRuleEntry {
  id: string;
  label: string;
  severity: ValidationSeverity;
  check(doc: Doc): ValidationIssue[];
}
export const VALIDATION_RULES: Registry<ValidationRuleEntry> =
  createRegistry<ValidationRuleEntry>("VALIDATION_RULES");

// ------------------------------------------------------------------ bootstrap

let registered = false;

/**
 * Built-in entries register karo.
 *
 * Import ke side-effect par bharosa nahi kiya — module order badalne par wo
 * chupchaap toot jaata hai aur "registry khaali hai" wale bug sabse mehnge
 * hote hain. Isliye ek saaf, idempotent function.
 */
export function registerBuiltins(): void {
  if (registered) return;
  registered = true;
  for (const entry of BUILTIN_ITEM_TYPES) ITEM_TYPES.register(entry);
  for (const entry of BUILTIN_TRACK_TYPES) TRACK_TYPES.register(entry);
  for (const entry of BUILTIN_EXPORT_PRESETS) EXPORT_PRESETS.register(entry);
  for (const entry of BUILTIN_ASSET_KINDS) ASSET_KINDS.register(entry);
  for (const entry of BUILTIN_ANIMATIONS) ANIMATIONS.register(entry);
  for (const entry of BUILTIN_TRANSITIONS) TRANSITIONS.register(entry);
  for (const entry of BUILTIN_EFFECTS) EFFECTS.register(entry);
  for (const entry of BUILTIN_SCENE_TYPES) SCENE_TYPES.register(entry);
}

/** Sirf tests ke liye — sab saaf karke dobara register. */
export function resetRegistries(): void {
  ITEM_TYPES.clear();
  TRACK_TYPES.clear();
  TRANSITIONS.clear();
  EFFECTS.clear();
  ANIMATIONS.clear();
  SCENE_TYPES.clear();
  EXPORT_PRESETS.clear();
  ASSET_KINDS.clear();
  VALIDATION_RULES.clear();
  registered = false;
  registerBuiltins();
}

registerBuiltins();

export * from "./animations";
export * from "./effects";
export * from "./assetKinds";
export * from "./exportPresets";
export * from "./sceneTypes";
export * from "./transitions";
export type { ItemTypeEntry } from "./itemTypes";
export type { TrackTypeEntry } from "./trackTypes";
export * from "./types";
