"use client";

import { aspectRatioLabel } from "@reel/core";

import { PreviewPlayer } from "@/components/editor/preview/PreviewPlayer";
import { TransportBar } from "@/components/editor/preview/TransportBar";
import { useAssetMap } from "@/lib/assetMap";
import { useEditorStore } from "@/lib/store";

/**
 * Beech ka canvas — asli player + transport.
 *
 * Yahan sirf jodne ka kaam hai. Player khud `PreviewPlayer` me hai (wahi
 * `ReelComposition` jo final MP4 banati hai), transport `TransportBar` me, aur
 * asset ke URL `useAssetMap` me — teeno alag isliye hain ki inme se har ek ki
 * apni wajah se badalne ki aadat hai.
 *
 * Frame ka naap kabhi yahan likha nahi jaata; sab kuch `doc.project` se aata hai.
 */
export function PreviewStage() {
  const doc = useEditorStore((state) => state.doc);
  const { assets, missing, loading } = useAssetMap(doc);

  const { width, height, fps } = doc.project;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-ink-950">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-ink-600 bg-ink-900 px-3 font-mono text-[11px] text-chalk-500">
        <span>
          {width}×{height} · {aspectRatioLabel(width, height)} · {fps}fps
        </span>
        {loading ? <span className="text-chalk-500">media load ho rahi hai…</span> : null}
        {missing.length > 0 ? (
          /*
           * Missing asset ka card frame ke andar bhi aata hai (`<MissingAsset>`),
           * par wo tabhi dikhta hai jab playhead usi item par ho. Ye line hamesha
           * dikhti hai — warna 40 second wali reel me toota hua asset dhoondhne
           * ke liye poori reel scrub karni padti (checklist 6.11).
           */
          <span className="text-red-300">
            {missing.length} asset nahi mila — frame me gulaabi card us item par hai
          </span>
        ) : null}
      </div>

      <PreviewPlayer assets={assets} />
      <TransportBar />
    </section>
  );
}
