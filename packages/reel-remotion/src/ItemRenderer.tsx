import { getItemType } from "@reel/core";
import type React from "react";
import { useCurrentFrame } from "remotion";

import { getItemComponent, type ItemComponentProps } from "./components";
import { MissingAsset } from "./MissingAsset";

/**
 * Item ka component **registry se** uthao.
 *
 * ⚠️ Poore renderer me `item.type` ka lookup sirf yahi ek jagah hai (Dynamic
 * rule 3). Kisi component ke andar `if (type === "image")` likhna mana hai —
 * warna naya item type jodne par pandrah files me badlav karna padta hai aur ek
 * na ek jagah hamesha chhoot jaati hai.
 */
export const ItemRenderer: React.FC<Omit<ItemComponentProps, "localFrame">> = (props) => {
  // Sequence ke andar `useCurrentFrame()` item ke apne start se ginta hai —
  // yahi wo item-local frame hai jispar keyframes tike hain (Phase 1 ka faisla).
  const localFrame = useCurrentFrame();

  const entry = getItemType(props.item.type);
  if (!entry) {
    return <MissingAsset item={props.item} />;
  }

  const Component = getItemComponent(entry.componentKey);
  if (!Component) {
    return <MissingAsset item={props.item} />;
  }

  return <Component {...props} localFrame={localFrame} />;
};
