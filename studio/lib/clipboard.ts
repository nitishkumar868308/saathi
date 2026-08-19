"use client";

import { CLIPBOARD_KIND, type ClipboardFragment } from "@reel/core";

import { getLocalClipboard, setLocalClipboard } from "@/lib/clipEdit";

/**
 * Clips ka copy / paste (8.8).
 *
 * ⚠️ **Do jagah likhte hain, aur ye zaroori hai.** `navigator.clipboard` sirf
 * secure context (https ya localhost) me chalti hai aur permission maang sakti
 * hai; user mana kar de to system clipboard bekaar ho jaata hai. Cross-project
 * paste uske bina nahi hoga — par usi project me copy-paste tootna nahi chahiye,
 * isliye ek andar wali copy bhi rakhi jaati hai. Padhte waqt bhi pehle system,
 * phir apni.
 *
 * ⚠️ Clipboard me kuch bhi ho sakta hai (user ne kahin se text copy kiya ho), aur
 * uspar bharosa nahi kiya jaa sakta. Isliye `kind` ki jaanch hoti hai aur galat
 * data par saaf `null` lautta hai — try/catch me chupchaap crash hone dena sabse
 * bura hota, kyunki tab Ctrl+V "kuch karta hi nahi" lagta.
 */

export async function writeClips(fragment: ClipboardFragment): Promise<void> {
  const text = JSON.stringify(fragment);
  setLocalClipboard(text);
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // System clipboard mana kar gaya — andar wali copy phir bhi chalegi.
  }
}

export async function readClips(): Promise<ClipboardFragment | null> {
  let text: string | null = null;
  try {
    text = (await navigator.clipboard?.readText()) ?? null;
  } catch {
    text = null;
  }
  return parseClips(text) ?? parseClips(getLocalClipboard());
}

function parseClips(text: string | null): ClipboardFragment | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as Partial<ClipboardFragment>;
    if (data.kind !== CLIPBOARD_KIND) return null;
    if (!Array.isArray(data.items) || data.items.length === 0) return null;
    if (typeof data.fps !== "number" || data.fps <= 0) return null;
    return data as ClipboardFragment;
  } catch {
    return null;
  }
}
