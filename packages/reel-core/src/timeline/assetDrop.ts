import { getAssetKind, listTrackTypes, requireTrackType, trackAccepts } from "../registry/index";
import type { Track } from "../schema/project";

/**
 * "Ye asset is track par ja sakta hai ya nahi — aur nahi to kyun?" (16.3)
 *
 * ⚠️ Ye poora faisla **ek pure function** me hai, aur wo jaan-boojhkar hai. Drop
 * ka jawab teen jagah chahiye: ghaseette waqt (lane ka rang), chhodte waqt (item
 * bane ya na bane), aur button wale raaste par (kaun sa track chuna jaaye). Teen
 * jagah teen `if` likhne par ek din lane hari dikhti hai aur drop mana kar deta
 * hai — aur us farak ko koi test nahi pakadta.
 *
 * ⚠️ **Mana karne ki wajah hamesha lautayi jaati hai**, sirf `false` nahi. "Yahan
 * nahi ja sakta" padh kar user dobara wahi koshish karta hai; "Awaaz ko video
 * track par nahi rakh sakte — Audio track par chhodo" padh kar wo sahi jagah
 * chala jaata hai. Yahi 16.3 ka asli maqsad hai.
 */

export interface AssetDropInput {
  /** `ASSET_KINDS` ka id — `image` / `video` / `audio` / `font`. */
  assetKind: string;
  /** Jis track par chhoda ja raha hai. */
  track: Pick<Track, "id" | "type" | "name" | "locked">;
}

export type AssetDropPlan =
  | { ok: true; itemType: string }
  | { ok: false; reason: string };

export function planAssetDrop(input: AssetDropInput): AssetDropPlan {
  const kind = getAssetKind(input.assetKind);
  if (!kind) {
    return { ok: false, reason: `"${input.assetKind}" kis kism ka asset hai, ye pata nahi.` };
  }

  /*
   * Font jaisi cheezein timeline par item banti hi nahi — wo text item ki
   * property hain. Registry me ye pehle se likha hua hai (`itemType: null`),
   * isliye yahan koi list nahi rakhi gayi.
   */
  if (!kind.itemType) {
    return {
      ok: false,
      reason: `${kind.label} timeline par nahi jaata — wo text ki setting me chunna hota hai.`,
    };
  }

  if (input.track.locked) {
    return { ok: false, reason: `Track "${input.track.name}" locked hai — pehle unlock karo.` };
  }

  if (!trackAccepts(input.track.type, kind.itemType)) {
    const trackType = requireTrackType(input.track.type);
    const better = suggestTrackType(kind.itemType);
    return {
      ok: false,
      reason: better
        ? `${kind.label} ko "${trackType.label}" track par nahi rakh sakte — ${better} track par chhodo.`
        : `${kind.label} ko "${trackType.label}" track par nahi rakh sakte.`,
    };
  }

  return { ok: true, itemType: kind.itemType };
}

/**
 * Is item type ke liye sabse seedha track kaun sa hai — sirf **salah** ke liye.
 *
 * ⚠️ Ye khud track nahi chunta. Kaun sa track chuna jaaye ye doc par nirbhar hai
 * (wahan wo track ho bhi sakta hai, nahi bhi), aur wo faisla `firstTrackFor()`
 * karta hai. Yahan sirf naam chahiye taaki message me likha ja sake.
 */
function suggestTrackType(itemType: string): string | null {
  const match = listTrackTypes().find((entry) => entry.accepts.includes(itemType));
  return match ? `"${match.label}"` : null;
}

/**
 * Doc me is asset ke liye pehla chalne layak track.
 *
 * Button wala raasta ("Timeline me jodo") isi se chalta hai — wahan user ne
 * track chuna hi nahi hota. Locked track chhod diye jaate hain: unpar daalna
 * turant fail hoga, aur "kuch nahi hua" wala jawab sabse bura hai.
 */
export function firstTrackFor(
  tracks: readonly Track[],
  assetKind: string,
): Track | null {
  for (const track of tracks) {
    if (planAssetDrop({ assetKind, track }).ok) return track;
  }
  return null;
}
