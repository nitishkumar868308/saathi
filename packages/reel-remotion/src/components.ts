import type { ComponentType } from "react";

import type { AssetMap } from "./assets";
import type { Doc, FontEntry, Item, Track } from "@reel/core";

/**
 * Item component registry.
 *
 * `@reel/core` ki `ITEM_TYPES` registry me sirf `componentKey` (ek string) rehti
 * hai — wahan React ka import nahi aa sakta, kyunki wo package worker aur
 * browser dono me chalta hai. Asli component yahan mapte hain.
 *
 * Isi wajah se naya item type = **ek file + ek registry entry**. `ItemRenderer`
 * me koi `if/switch` nahi badhta.
 */

export interface ItemComponentProps {
  item: Item;
  track: Track;
  doc: Doc;
  assets: AssetMap;
  /** Font registry — composition se neeche aati hai (9.10). */
  fonts?: readonly FontEntry[];
  /** Item ke apne start se gina hua frame (Sequence ke andar wala). */
  localFrame: number;
}

export type ItemComponent = ComponentType<ItemComponentProps>;

const components = new Map<string, ItemComponent>();

export function registerItemComponent(componentKey: string, component: ItemComponent): void {
  components.set(componentKey, component);
}

export function getItemComponent(componentKey: string): ItemComponent | undefined {
  return components.get(componentKey);
}

export function listItemComponentKeys(): string[] {
  return [...components.keys()];
}
