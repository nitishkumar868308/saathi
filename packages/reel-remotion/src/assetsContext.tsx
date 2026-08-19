import React, { createContext, useContext, useMemo } from "react";

import { assetSrc, type AssetMap } from "./assets";

/**
 * Asset map ka context (24.6).
 *
 * ⚠️ Ye bilkul usi wajah se hai jis wajah se `BrandProvider` hai: ek cheez jo
 * **har** item par lag sakti hai, par jiska data har item component tak prop se
 * nahi pahunchta. Image mask kisi bhi item par lag sakta hai — video, image,
 * text, shape — aur `<Transformed>` un sab ke beech me baitha hai, par usse
 * `assets` kabhi nahi milta tha.
 *
 * Har item component me ek naya prop jodna doosra raasta tha. Wo ek din kisi
 * ek jagah chhoot jaata, aur wahan mask chup-chaap na lagta — aur wo galti
 * dekh kar samajh hi nahi aati (item bilkul theek dikhta hai, bas mask nahi
 * hota).
 */

const AssetContext = createContext<AssetMap>({});

export const AssetProvider: React.FC<{
  assets: AssetMap;
  children: React.ReactNode;
}> = ({ assets, children }) => (
  <AssetContext.Provider value={assets}>{children}</AssetContext.Provider>
);

/** `assetId` se URL. `null` = asset nahi mili (ya id hi nahi thi). */
export function useAssetSrc(assetId: string | null): string | null {
  const assets = useContext(AssetContext);
  return useMemo(() => assetSrc(assets, assetId), [assets, assetId]);
}
