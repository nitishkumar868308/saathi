import { itemEndFrame, type Doc, type Item } from "../schema/project";

/**
 * Selection helpers.
 *
 * Selection **doc ke andar nahi** rehti (Section E ka faisla) — warna undo
 * playhead aur selection ko bhi hila deta, aur ek din tum text likhna band karke
 * "Ctrl+Z ne mera selection kyun badla" dhoondh rahe hote. Ye alag UI state hai,
 * isliye yahan sab pure functions hain jo nayi selection lauta te hain.
 */

export interface Selection {
  itemIds: readonly string[];
  /** Track headers ka apna selection (rename, mute, delete track ke liye). */
  trackIds: readonly string[];
}

export const EMPTY_SELECTION: Selection = { itemIds: [], trackIds: [] };

export function createSelection(itemIds: readonly string[] = []): Selection {
  return { itemIds: [...itemIds], trackIds: [] };
}

export function isSelected(selection: Selection, itemId: string): boolean {
  return selection.itemIds.includes(itemId);
}

export function selectSingle(itemId: string): Selection {
  return { itemIds: [itemId], trackIds: [] };
}

export function addToSelection(selection: Selection, itemId: string): Selection {
  if (isSelected(selection, itemId)) return selection;
  return { ...selection, itemIds: [...selection.itemIds, itemId] };
}

export function removeFromSelection(selection: Selection, itemId: string): Selection {
  if (!isSelected(selection, itemId)) return selection;
  return { ...selection, itemIds: selection.itemIds.filter((id) => id !== itemId) };
}

/** Ctrl/Cmd+click ka behaviour. */
export function toggleSelection(selection: Selection, itemId: string): Selection {
  return isSelected(selection, itemId)
    ? removeFromSelection(selection, itemId)
    : addToSelection(selection, itemId);
}

export function clearSelection(): Selection {
  return EMPTY_SELECTION;
}

/**
 * Timeline ka apna order: pehle track ka order, phir startFrame.
 * Shift+click ka "beech ka sab" isi order par chalta hai.
 */
export function timelineOrder(doc: Doc): readonly Item[] {
  const trackOrder = new Map(doc.tracks.map((track) => [track.id, track.order]));
  return [...doc.items].sort((a, b) => {
    const trackDiff = (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0);
    if (trackDiff !== 0) return trackDiff;
    if (a.startFrame !== b.startFrame) return a.startFrame - b.startFrame;
    return a.id.localeCompare(b.id);
  });
}

/** Shift+click — do items ke beech ka sab kuch. */
export function selectRange(doc: Doc, fromItemId: string, toItemId: string): Selection {
  const ordered = timelineOrder(doc);
  const from = ordered.findIndex((item) => item.id === fromItemId);
  const to = ordered.findIndex((item) => item.id === toItemId);
  if (from === -1 || to === -1) return EMPTY_SELECTION;

  const [start, end] = from <= to ? [from, to] : [to, from];
  return createSelection(ordered.slice(start, end + 1).map((item) => item.id));
}

export function selectByTrack(doc: Doc, trackId: string): Selection {
  return createSelection(
    doc.items.filter((item) => item.trackId === trackId).map((item) => item.id),
  );
}

export function selectAll(doc: Doc): Selection {
  return createSelection(doc.items.map((item) => item.id));
}

/** Playhead ke neeche jo bhi items hain (frame us item ke andar padta ho). */
export function selectAtFrame(doc: Doc, frame: number): Selection {
  return createSelection(
    doc.items
      .filter((item) => frame >= item.startFrame && frame < itemEndFrame(item))
      .map((item) => item.id),
  );
}

/** Selection me jo items hain, timeline order me. */
export function selectedItems(doc: Doc, selection: Selection): readonly Item[] {
  const ids = new Set(selection.itemIds);
  return timelineOrder(doc).filter((item) => ids.has(item.id));
}

/** Selection ka time span — "selected par zoom karo" jaise commands ke liye. */
export function selectionSpan(
  doc: Doc,
  selection: Selection,
): { startFrame: number; endFrame: number } | null {
  const items = selectedItems(doc, selection);
  if (items.length === 0) return null;
  return {
    startFrame: Math.min(...items.map((item) => item.startFrame)),
    endFrame: Math.max(...items.map(itemEndFrame)),
  };
}

/** Doc badalne par gayab ho chuke ids hata do (delete/undo ke baad zaroori). */
export function pruneSelection(doc: Doc, selection: Selection): Selection {
  const itemIds = new Set(doc.items.map((item) => item.id));
  const trackIds = new Set(doc.tracks.map((track) => track.id));
  return {
    itemIds: selection.itemIds.filter((id) => itemIds.has(id)),
    trackIds: selection.trackIds.filter((id) => trackIds.has(id)),
  };
}
