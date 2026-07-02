// Warm theme — landing page ke saath consistent (Dot-inspired cozy premium)
export const colors = {
  cream: "#F7F2E9",
  creamDeep: "#EFE7D6",
  surface: "#FFFCF6",
  ink: "#2E2823",
  inkSoft: "#6B5F54",
  terracotta: "#C25A37",
  terracottaDark: "#A8492B",
  amber: "#E0A458",
  sage: "#7C8A6B",
  line: "#E5DBC9",
  white: "#FFFFFF",
} as const;

export type ColorKey = keyof typeof colors;
