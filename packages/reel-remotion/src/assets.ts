import { staticFile } from "remotion";

/**
 * Asset resolution — doc me `assetId` hota hai, URL kabhi nahi.
 *
 * ⚠️ Ye Phase 1 ka locked faisla hai aur iski wajah asli hai: signed URL 5-15
 * minute me expire ho jaate hain. Agar URL doc me save ho jaaye to project kal
 * kholne par saari media toot jaati hai — aur galti bilkul samajh nahi aati.
 * Isliye URL render ke waqt banta hai aur `inputProps.assets` me alag se aata hai.
 *
 * Map ki value do me se ek hoti hai:
 *  - poora `http(s)://…` URL (R2 driver ka presigned URL), ya
 *  - Remotion ke public dir ke andar ka filename (local driver — worker file
 *    wahan copy kar deta hai). Tab `staticFile()` use hota hai.
 */
export type AssetMap = Record<string, string>;

const ABSOLUTE = /^(https?:|blob:|data:)/i;

export function assetSrc(assets: AssetMap, assetId: string | null): string | null {
  if (!assetId) return null;
  const value = assets[assetId];
  if (!value) return null;
  return ABSOLUTE.test(value) ? value : staticFile(value);
}
