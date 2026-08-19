"use client";

import { hasKeyframes, type Item } from "@reel/core";
import clsx from "clsx";
import { Diamond } from "lucide-react";

import { useEditorStore } from "@/lib/store";

/**
 * Stopwatch / diamond — keyframable property ke saath (13.5).
 *
 * ⚠️ Ye button **registry se** aata hai: control ke descriptor me
 * `keyframable: true` ho tabhi dikhta hai. Isliye nayi keyframable property
 * jodna sirf registry me ek flag hai — panel me kuch nahi badalta.
 *
 * Teen haalat, teen rang:
 *  - **khaali** — is property par koi keyframe nahi
 *  - **bhara** — keyframes hain par playhead unme se kisi par nahi
 *  - **amber** — playhead theek ek keyframe par hai (dabane se wo hat jaayega)
 *
 * Teesri haalat ka alag dikhna zaroori hai: bina uske user ko pata hi nahi
 * chalta ki dabane se keyframe banega ya mitega.
 */
export function KeyframeButton({
  item,
  path,
  value,
  localFrame,
}: {
  item: Item;
  path: string;
  /** Abhi ki value — naya keyframe isi se banta hai. */
  value: unknown;
  /** Item ke apne start se gina hua playhead. */
  localFrame: number;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);

  const list = item.keyframes[path] ?? [];
  const any = hasKeyframes(item, path);
  const onKeyframe = list.some((keyframe) => keyframe.frame === localFrame);

  const inRange = localFrame >= 0 && localFrame < item.durationInFrames;

  return (
    <button
      type="button"
      disabled={!inRange || item.locked}
      title={
        !inRange
          ? "Playhead is clip ke bahar hai — pehle uspar le jao"
          : onKeyframe
            ? `Frame ${localFrame} ka keyframe hatao`
            : any
              ? `Frame ${localFrame} par keyframe lagao (${list.length} pehle se hain)`
              : "Yahan se animate karo — playhead par keyframe lagega"
      }
      onClick={() => {
        if (onKeyframe) {
          applyOp(
            "deleteKeyframe",
            { itemId: item.id, path, frame: localFrame },
            { label: "Keyframe hataya" },
          );
          return;
        }
        applyOp(
          "addKeyframe",
          { itemId: item.id, path, frame: localFrame, value },
          { label: "Keyframe" },
        );
      }}
      className={clsx(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-30",
        onKeyframe
          ? "text-amber"
          : any
            ? "text-terracotta hover:text-amber"
            : "text-ink-500 hover:text-chalk-500",
      )}
    >
      <Diamond size={10} fill={onKeyframe || any ? "currentColor" : "none"} />
    </button>
  );
}
