import type { ExpiryStatus } from "@/utils/expiry";
import type { Colors } from "./colors";

/**
 * Expiry ka rang — safe / soon / expired.
 *
 * ⚠️ Ye pehle ek plain `const` map tha jo module load par `colors` se bhar
 * jaata tha. Us shakl me dark theme is map tak pahunchti hi nahi: har card ka
 * status badge light theme ke rang leke baitha rehta.
 *
 * Ab ye ek function hai jo abhi ke rang leta hai. Screens ise `useColors()` ke
 * saath bulati hain.
 */
export function statusStyleFor(
  c: Colors,
): Record<ExpiryStatus, { fg: string; bg: string; label: string }> {
  return {
    safe: { fg: c.sage, bg: "rgba(124,138,107,0.15)", label: "Safe" },
    soon: { fg: c.terracotta, bg: "rgba(194,90,55,0.12)", label: "Soon" },
    // Khatre ka laal dono theme me ek hi — halka karne par wo khatra jaisa
    // lagna hi band ho jaata hai.
    expired: { fg: "#B23B3B", bg: "rgba(178,59,59,0.12)", label: "Expired" },
  };
}

export function neutralStyleFor(c: Colors) {
  return { fg: c.inkSoft, bg: "rgba(107,95,84,0.10)", label: "—" };
}

const docIconMap: Record<string, string> = {
  car: "car-sport",
  license: "card",
  passport: "airplane",
  fastag: "speedometer",
  warranty: "shield-checkmark",
  health: "medkit",
  other: "document-text",
};

/** Document type ke liye Ionicons naam (fallback: document-text). */
export function iconForType(type: string): string {
  return docIconMap[type] ?? "document-text";
}

export const typeLabel: Record<string, string> = {
  car: "Insurance / Vehicle",
  license: "Driving License",
  passport: "Passport",
  fastag: "FASTag",
  warranty: "Warranty",
  health: "Health / Life",
  other: "Document",
};

export function labelForType(type: string): string {
  return typeLabel[type] ?? "Document";
}
