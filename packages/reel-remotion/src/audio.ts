import { duckEnvelope, hasSolo, itemGainAt, type Doc, type Item, type Track } from "@reel/core";

/**
 * Audio volume — poora hisaab **core me** hai (15.1 / 15.3 / 15.6).
 *
 * ⚠️ Pehle yahan apna chhota sa fade ka ganit likha tha. Phase 15 me wo hataya
 * gaya, aur wajah seedhi hai: ab volume par keyframes, equal-power fades,
 * solo, ducking aur master volume — paanch cheezein lagti hain. Wo ganit do
 * jagah rakhne par ek din editor me music -18 dB par duck hota aur MP4 me -20
 * par, aur wo farak sirf kaan se pakda jaata — wo bhi tab jab video kisi ko
 * bhej di ho.
 *
 * Ab dono taraf `itemGainAt()` chalta hai. Yahan sirf itna kaam bacha hai ki
 * Remotion ko us function ka frame-wise roop de diya jaaye.
 *
 * Fade ke bina bhi function hi lautate hain jab ducking chal rahi ho — kyunki
 * ducking ka gain frame par badalta hai, chahe clip par koi fade na ho.
 */
export function itemVolume(
  doc: Doc,
  item: Item,
  track: Track,
): number | ((frame: number) => number) {
  const soloActive = hasSolo(doc);
  const ducked =
    doc.project.audio.ducking.enabled && doc.project.audio.ducking.duckedTrackIds.includes(track.id);

  const hasVolumeKeyframes = (item.keyframes["audio.volume"]?.length ?? 0) > 0;
  const hasFade = item.audio.fadeInFrames > 0 || item.audio.fadeOutFrames > 0;

  if (!ducked && !hasFade && !hasVolumeKeyframes) {
    // Sthir gain par Remotion ek hi baar hisaab karta hai — har frame par
    // function bulane se bachna sasta hai aur waveform bhi saaf rehta hai.
    return itemGainAt({ doc, item, track, localFrame: 0, soloActive });
  }

  // Envelope ek hi baar banta hai, har frame par nahi — warna 10s ke project me
  // ye 300 baar poori item list par chalta.
  const envelope = ducked ? duckEnvelope(doc) : undefined;

  return (frame: number): number =>
    itemGainAt({ doc, item, track, localFrame: frame, envelope, soloActive });
}
