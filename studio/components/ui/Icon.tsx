"use client";

import {
  Circle,
  Captions,
  FileQuestion,
  Image,
  Layers,
  LayoutGrid,
  Mic,
  MonitorPlay,
  Music,
  SlidersHorizontal,
  Square,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";

/**
 * Registry ke icon **naam** se asli icon.
 *
 * `@reel/core` me React nahi aa sakta (wo worker me bhi chalta hai), isliye
 * registry entries me icon sirf ek string hai. Jodne ka kaam yahan hota hai.
 *
 * ⚠️ `import * as Lucide from "lucide-react"` karke naam se uthana aasan tha,
 * par usse poori icon library bundle me aa jaati hai (1000+ icons). Yahan wahi
 * hain jo sach me use hote hain, aur naya icon jodna ek line hai.
 */
const ICONS: Record<string, LucideIcon> = {
  Captions,
  Image,
  Layers,
  LayoutGrid,
  Mic,
  MonitorPlay,
  Music,
  SlidersHorizontal,
  Square,
  Type,
  Video,
};

export function iconFor(name: string): LucideIcon {
  // Anjaan naam par ek saaf "pata nahi" icon — khaali jagah chhodne se layout
  // hilta hai aur galti dikhti bhi nahi.
  return ICONS[name] ?? FileQuestion;
}

export function Icon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const Component = ICONS[name] ?? Circle;
  return <Component size={size} className={className} />;
}
