"use client";

import { History, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

import { ProjectPanel } from "@/components/editor/panels/ProjectPanel";
import { VersionsPanel } from "@/components/editor/panels/VersionsPanel";

/**
 * Left sidebar ke tabs — **registry se** (checklist 4.11).
 *
 * ⚠️ Yahan sirf wo panel hain jo aaj sach me kaam karte hain. "Media", "Text",
 * "Effects" ke khaali tabs daal dena aasan hota, par wo README ka rule 5 todta
 * hai: jo button kuch nahi karta wo toota hua button hai. Har aage ka phase
 * apna panel yahan ek entry ki tarah jodega.
 */

export interface PanelEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

export const LEFT_PANELS: readonly PanelEntry[] = [
  {
    id: "project",
    label: "Project",
    icon: SlidersHorizontal,
    component: ProjectPanel,
  },
  {
    id: "versions",
    label: "Versions",
    icon: History,
    component: VersionsPanel,
  },
];

export function findPanel(id: string): PanelEntry {
  return LEFT_PANELS.find((panel) => panel.id === id) ?? (LEFT_PANELS[0] as PanelEntry);
}
