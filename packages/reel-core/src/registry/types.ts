import type { ZodTypeAny } from "zod";

/**
 * Registry ka shape — poore product ka "dynamic-first" wala vaada yahin se aata hai.
 *
 * Har item type / track type / transition / effect ek **entry** hai. Entry me
 * uska schema, defaults, aur UI controls ka descriptor rehta hai. Properties
 * panel, timeline, sidebar aur renderer — sab entry padhkar chalte hain.
 *
 * Isliye naya feature = ek file + ek registry entry. Poore codebase me
 * `if (type === "image")` wali switch-chain dhoondhne ki zaroorat nahi padti.
 */

/** UI control ke kism — Phase 9 ka generated panel inhi se banega. */
export type ControlKind =
  | "slider"
  | "number"
  | "text"
  | "textarea"
  | "color"
  | "select"
  | "segmented"
  | "toggle"
  | "vector2"
  | "asset"
  | "font"
  | "align";

export interface ControlOption {
  value: string | number | boolean;
  label: string;
}

/**
 * Ek control ka **declarative descriptor**.
 *
 * `path` property ka wahi string path hai jo keyframes bhi use karte hain
 * (`"transform.scale"`), isliye panel aur keyframe lane apne aap ek doosre se
 * jud jaate hain — per-property code kahin nahi likhna padta.
 */
export interface ControlDescriptor {
  path: string;
  control: ControlKind;
  label: string;
  /** Panel me section ka naam — ek hi group ke controls saath dikhte hain. */
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly ControlOption[];
  /** Control tabhi dikhe jab dusri property ki value ye ho (declarative, code nahi). */
  when?: { path: string; equals: unknown };
  /** Is property par keyframe lagaya ja sakta hai? */
  keyframable?: boolean;
  help?: string;
}

/** Registry entry ka base shape — har registry isi ko extend karti hai. */
export interface RegistryEntry {
  id: string;
  label: string;
  /** lucide-react icon ka naam. Core me React nahi hai, isliye sirf string. */
  icon: string;
  /** UI grouping ke liye mota category (media / text / graphic / audio…). */
  kind: string;
  /** Type-specific fields ka zod schema — validation isse chalti hai. */
  schema: ZodTypeAny;
  /** Naya banate waqt ki default values. */
  defaults: Record<string, unknown>;
  controls: readonly ControlDescriptor[];
  /** Jin property paths par keyframe lag sakta hai. */
  keyframable: readonly string[];
}

export interface Registry<T extends { id: string }> {
  readonly name: string;
  register(entry: T): void;
  /** Maujooda entry ko badalta hai — sirf jaan-boojhkar override karne ke liye. */
  replace(entry: T): void;
  get(id: string): T | undefined;
  /** get() ka sakht version — na mile to saaf error, undefined nahi. */
  require(id: string): T;
  has(id: string): boolean;
  list(): readonly T[];
  ids(): readonly string[];
  /** Sirf tests ke liye. */
  clear(): void;
}

export function createRegistry<T extends { id: string }>(name: string): Registry<T> {
  const entries = new Map<string, T>();

  return {
    name,
    register(entry) {
      if (entries.has(entry.id)) {
        throw new Error(
          `${name}: "${entry.id}" pehle se registered hai. Badalna hai to replace() use karo.`,
        );
      }
      entries.set(entry.id, entry);
    },
    replace(entry) {
      entries.set(entry.id, entry);
    },
    get(id) {
      return entries.get(id);
    },
    require(id) {
      const entry = entries.get(id);
      if (!entry) {
        throw new Error(
          `${name}: "${id}" nahi mila. Registered: ${[...entries.keys()].join(", ") || "(khaali)"}`,
        );
      }
      return entry;
    },
    has(id) {
      return entries.has(id);
    },
    list() {
      return [...entries.values()];
    },
    ids() {
      return [...entries.keys()];
    },
    clear() {
      entries.clear();
    },
  };
}

/** Registry ke saare entries ke controls ek saath — panel isse render hota hai. */
export function collectControls(entry: RegistryEntry): readonly ControlDescriptor[] {
  return entry.controls;
}

/** Controls ko unke group ke hisaab se baant do (panel ke sections banane ke liye). */
export function groupControls(
  controls: readonly ControlDescriptor[],
): { group: string; controls: ControlDescriptor[] }[] {
  const groups: { group: string; controls: ControlDescriptor[] }[] = [];
  for (const control of controls) {
    const name = control.group ?? "General";
    let bucket = groups.find((g) => g.group === name);
    if (!bucket) {
      bucket = { group: name, controls: [] };
      groups.push(bucket);
    }
    bucket.controls.push(control);
  }
  return groups;
}
