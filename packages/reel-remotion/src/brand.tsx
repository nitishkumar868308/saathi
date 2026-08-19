import { DEFAULT_BRAND_TOKENS, brandTokensFor, resolveToken, type BrandTokens } from "@reel/core";
import React, { createContext, useContext, useMemo } from "react";

/**
 * Brand tokens ka context (17.10).
 *
 * ⚠️ Ye ek asli kami ke baad joda gaya. Pehle har item component seedha
 * `resolveToken(value)` bulata tha — bina tokens diye, yaani hamesha
 * **default** brand ke saath. Uska matlab ye tha ki project ka brand preset
 * badalne par preview aur MP4 dono me kuch nahi badalta tha. Poora token system
 * likha hua tha aur render use padhta hi nahi tha.
 *
 * Context isliye (prop drilling nahi): rang paanch alag components me lagta hai
 * (text, shape, fit background, effects, watermark) aur unme se kuch `doc` tak
 * pahunchte hi nahi. Har ek me ek naya prop jodne par ek din koi ek chhoot jaata
 * — aur wo ek jagah default brand par atki reh jaati, jo dekh kar samajh nahi
 * aata.
 */

const BrandContext = createContext<BrandTokens>(DEFAULT_BRAND_TOKENS);

export const BrandProvider: React.FC<{
  brand: { presetId: string | null; tokens?: BrandTokens };
  children: React.ReactNode;
}> = ({ brand, children }) => {
  // `useMemo` isliye ki tokens ka object har render par naya banta to har item
  // dobara render hota — 300 frames par wo saaf dikhta hai.
  const tokens = useMemo(() => brandTokensFor(brand), [brand]);
  return <BrandContext.Provider value={tokens}>{children}</BrandContext.Provider>;
};

/**
 * Token resolve karne wala hook.
 *
 * Har wo jagah jahan pehle `resolveToken(value)` tha, ab `useToken()(value)`
 * hai. Naam chhota isliye rakha ki call sites padhne me halke rahein.
 */
export function useToken(): (value: string) => string {
  const tokens = useContext(BrandContext);
  return useMemo(() => (value: string) => resolveToken(value, tokens), [tokens]);
}

/** Sirf tokens chahiye (jaise gradient banane ke liye do rang). */
export function useBrandTokens(): BrandTokens {
  return useContext(BrandContext);
}
