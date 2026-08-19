"use client";

import { useCallback, useEffect, useState } from "react";

import { LAYOUT_STORAGE_KEY, PANEL_LIMITS, type PanelName } from "@/lib/config";

/**
 * Panel ki chaudai/oonchai — localStorage me yaad rehti hai.
 *
 * ⚠️ Pehla render **hamesha** default se hota hai, localStorage se nahi. Server
 * ne jo HTML bheja usme default hai; agar client pehle render me hi yaad ki hui
 * value laga de to React hydration mismatch chillata hai. Isliye stored value ek
 * `useEffect` me aati hai — ek frame ka halka sa jhatka, par console saaf aur
 * behaviour tay.
 */

export type Layout = Record<PanelName, number>;

const DEFAULT_LAYOUT: Layout = {
  left: PANEL_LIMITS.left.initial,
  right: PANEL_LIMITS.right.initial,
  timeline: PANEL_LIMITS.timeline.initial,
};

export function clampPanel(name: PanelName, value: number): number {
  const limits = PANEL_LIMITS[name];
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

function readStored(): Partial<Layout> {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<PanelName, unknown>>;
    const out: Partial<Layout> = {};
    for (const name of Object.keys(PANEL_LIMITS) as PanelName[]) {
      const value = parsed[name];
      if (typeof value === "number" && Number.isFinite(value)) out[name] = clampPanel(name, value);
    }
    return out;
  } catch {
    // Kharab JSON par default se chalna hi theek hai — layout ke liye rona bekaar.
    return {};
  }
}

export function useLayout(): {
  layout: Layout;
  setPanel(name: PanelName, value: number): void;
  resetLayout(): void;
} {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);

  useEffect(() => {
    const stored = readStored();
    if (Object.keys(stored).length > 0) setLayout((current) => ({ ...current, ...stored }));
  }, []);

  const persist = useCallback((next: Layout) => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / quota — layout na bacha to bhi editor chalta rahe.
    }
  }, []);

  const setPanel = useCallback(
    (name: PanelName, value: number) => {
      setLayout((current) => {
        const next = { ...current, [name]: clampPanel(name, value) };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    persist(DEFAULT_LAYOUT);
  }, [persist]);

  return { layout, setPanel, resetLayout };
}
