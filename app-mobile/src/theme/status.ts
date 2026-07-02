import type { ExpiryStatus } from "@/utils/expiry";
import { colors } from "./colors";

export const statusStyle: Record<
  ExpiryStatus,
  { fg: string; bg: string; label: string }
> = {
  safe: { fg: colors.sage, bg: "rgba(124,138,107,0.15)", label: "Safe" },
  soon: { fg: colors.terracotta, bg: "rgba(194,90,55,0.12)", label: "Soon" },
  expired: { fg: "#B23B3B", bg: "rgba(178,59,59,0.12)", label: "Expired" },
};

export const neutralStyle = {
  fg: colors.inkSoft,
  bg: "rgba(107,95,84,0.10)",
  label: "—",
};

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
