import type { Item } from "@reel/core";
import type React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Asset na mile to **shor machao**.
 *
 * Khaali frame dikhana sabse bura option hai: video ban jaati hai, koi error
 * nahi aata, aur galti tab pata chalti hai jab reel post ho chuki hoti hai.
 * Isliye yahan ek bhadka hua card aata hai jise miss karna namumkin hai.
 *
 * Asli deewar iske pehle hai — worker ka `resolveAssets()` render shuru hone se
 * pehle hi phat jaata hai agar doc ka koi assetId storage me na ho. Ye sirf
 * preview aur "kabhi na ho" wale raaste ke liye hai.
 */
export const MissingAsset: React.FC<{ item: Item }> = ({ item }) => (
  <AbsoluteFill
    style={{
      backgroundColor: "#FF00A0",
      color: "#000000",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
      fontSize: 36,
      fontWeight: 700,
      padding: 40,
      gap: 12,
    }}
  >
    <div>ASSET NAHI MILA</div>
    <div style={{ fontSize: 24, fontWeight: 400 }}>
      {item.name} ({item.type})
    </div>
    <div style={{ fontSize: 20, fontWeight: 400, opacity: 0.8 }}>
      assetId: {item.assetId ?? "(khaali)"}
    </div>
  </AbsoluteFill>
);
