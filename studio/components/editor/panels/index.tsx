"use client";

import {
  Captions,
  Sparkles,
  ShieldCheck,
  Clapperboard,
  FolderOpen,
  History,
  SlidersHorizontal,
  LayoutTemplate,
  Palette,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { TemplatePanel } from "@/components/editor/panels/TemplatePanel";
import { CaptionsPanel } from "@/components/editor/panels/CaptionsPanel";
import { ValidationPanel } from "@/components/editor/panels/ValidationPanel";
import { AiPanel } from "@/components/editor/panels/AiPanel";
import { BrandPanel } from "@/components/editor/panels/BrandPanel";
import { MasterAudioPanel } from "@/components/editor/panels/MasterAudioPanel";
import { ProjectPanel } from "@/components/editor/panels/ProjectPanel";
import { RendersPanel } from "@/components/editor/panels/RendersPanel";
import { VersionsPanel } from "@/components/editor/panels/VersionsPanel";
import { MediaPanel } from "@/components/media/MediaPanel";

/**
 * Left sidebar ke tabs — **registry se** (checklist 4.11).
 *
 * ⚠️ Yahan sirf wo panel hain jo aaj sach me kaam karte hain. "Text", "Effects"
 * jaise khaali tabs daal dena aasan hota, par wo README ka rule 5 todta hai:
 * jo button kuch nahi karta wo toota hua button hai. Har aage ka phase apna
 * panel yahan ek entry ki tarah jodega (Media Phase 5 me isi tarah aaya).
 */

export interface PanelEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

export const LEFT_PANELS: readonly PanelEntry[] = [
  {
    id: "media",
    label: "Media",
    icon: FolderOpen,
    component: MediaPanel,
  },
  {
    id: "project",
    label: "Project",
    icon: SlidersHorizontal,
    component: ProjectPanel,
  },
  {
    id: "audio",
    label: "Audio",
    icon: Volume2,
    component: MasterAudioPanel,
  },
  {
    id: "ai",
    label: "AI",
    icon: Sparkles,
    component: AiPanel,
  },
  {
    id: "templates",
    label: "Templates",
    icon: LayoutTemplate,
    component: TemplatePanel,
  },
  {
    id: "brand",
    label: "Brand",
    icon: Palette,
    component: BrandPanel,
  },
  {
    id: "captions",
    label: "Captions",
    icon: Captions,
    component: CaptionsPanel,
  },
  {
    id: "quality",
    label: "Quality",
    icon: ShieldCheck,
    component: ValidationPanel,
  },
  {
    id: "renders",
    label: "Renders",
    icon: Clapperboard,
    component: RendersPanel,
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
