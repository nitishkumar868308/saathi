"use client";

import { applyWizard, autoFill, type WizardDraft } from "@reel/core";
import { ReelComposition } from "@reel/remotion";
import { Player } from "@remotion/player";
import { useMemo } from "react";

import { useAssetMap } from "@/lib/assetMap";
import { useFonts } from "@/lib/fonts";
import { useEditorStore } from "@/lib/store";

/**
 * Step 4 — **Dekho** (26.10).
 *
 * ⚠️ Ye reel **sach me chal kar** dikhti hai, koi tasveeron ki list nahi. Wajah
 * seedhi hai: is wizard ka poora vaada hi ye hai ki aadmi ko editor sikhna na
 * pade. Aakhir me use "8 scene ban jaayenge" likh kar bhej dena us vaade ko
 * aakhri kadam par tod deta — timing, awaaz, aur harkat wo teen cheezein hain
 * jo likh kar kabhi samajh nahi aati.
 *
 * ⚠️ **Yahan doc me kuch likha nahi jaata.** `applyWizard` ek naya doc lauta ta
 * hai (pure function), aur wo sirf is Player ko diya jaata hai. Project ka apna
 * doc waisa ka waisa rehta hai jab tak aadmi "Editor me daalo" na dabaye.
 *
 * ⚠️ Aur ye editor wale `PreviewPlayer` se alag hai, jaan-boojhkar. Wo store ke
 * playhead, zoom tool aur playback se juda hua hai — usse yahan chalane ka matlab
 * hota ki wizard ka preview chalate hi editor ka playhead hilne lage, jabki
 * aadmi ne project me abhi kuch kiya bhi nahi.
 */
export function StepPreview({ draft }: { draft: WizardDraft }) {
  const doc = useEditorStore((state) => state.doc);

  /*
   * `autoFill` yahan bhi — aadmi seedha is step par aa sakta hai bina kuch chune.
   * Bina iske preview me transition hote hi nahi aur reel ka katna jhatke jaisa
   * dikhta, jabki asli reel me wo aisa nahi hoga.
   */
  const built = useMemo(() => {
    try {
      return applyWizard({ doc, draft: autoFill(draft) });
    } catch (error) {
      return { doc: null, applied: 0, skipped: [], error } as const;
    }
  }, [doc, draft]);

  const previewDoc = "doc" in built ? built.doc : null;

  const { assets, missing } = useAssetMap(previewDoc ?? doc);
  const { fonts } = useFonts(previewDoc ?? doc);
  const inputProps = useMemo(
    () => ({ doc: previewDoc ?? doc, assets, fonts }),
    [previewDoc, doc, assets, fonts],
  );

  if (!previewDoc || built.applied === 0) {
    return (
      <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
        Abhi dikhane layak kuch nahi bana. Har scene me kam se kam text hona chahiye — peeche
        jaakar dekh lo.
      </p>
    );
  }

  const { width, height, fps, durationInFrames } = previewDoc.project;

  return (
    <div className="space-y-2">
      <div className="mx-auto w-[240px] overflow-hidden rounded border border-ink-600 bg-black">
        <Player
          component={ReelComposition}
          inputProps={inputProps}
          durationInFrames={Math.max(1, durationInFrames)}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%" }}
          controls
          loop
        />
      </div>

      <p className="text-center text-[11px] text-chalk-500">
        {built.applied} scene · {Math.round(durationInFrames / fps)} second
      </p>

      {/*
        ⚠️ Jo asset nahi mili wo yahan likhi jaati hai, chhupayi nahi jaati. Bina
        iske preview me us jagah khaali/gulaabi card dikhta hai aur aadmi ko lagta
        hai ki wizard ne kuch toda — jabki asal me wo file storage me hai hi nahi.
      */}
      {missing.length > 0 ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
          {missing.length} asset nahi mili — us scene ki jagah khaali card dikhega. Peeche jaakar
          wo tasveer ya awaaz dobara daal do.
        </p>
      ) : null}

      {built.skipped.length > 0 ? (
        <div className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          {built.skipped.length} scene nahi ban paaya:
          <ul className="mt-0.5 list-disc pl-4">
            {built.skipped.map((entry) => (
              <li key={entry.index}>{entry.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
