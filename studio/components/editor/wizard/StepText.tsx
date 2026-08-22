"use client";

import { getSceneType, type WizardDraft, type WizardScene } from "@reel/core";
import { RotateCcw, Trash2 } from "lucide-react";

/**
 * Step 1 — **Shabd** (26.5).
 *
 * ⚠️ Ye step pehla hai, aur wo tarteeb ek bug rokti hai. TTS ka cache text ke
 * hash par hai: awaaz ban jaane ke baad text badla to bani hui awaaz **purane
 * shabdon ki** reh jaati hai. Wo galti kahin dikhti nahi — reel banti hai,
 * chalti hai, export bhi ho jaati hai; bas awaaz kuch aur bolti hai aur caption
 * kuch aur. Shabd pehle rakhne se wo halat ban hi nahi sakti.
 *
 * (Aadmi phir bhi peeche aakar badal sakta hai — us par step 3 me laal nishaan
 * lagta hai, dekho `voiceStale`.)
 */
export function StepText({
  draft,
  onChange,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const removed = draft.scenes.filter((scene) => scene.removed);

  return (
    <>
      {draft.summary ? (
        <p className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-chalk-400">
          {draft.summary}
        </p>
      ) : null}

      {live.map((scene, at) => (
        <div key={scene.index} className="rounded border border-ink-600 bg-ink-900 p-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">
              Scene {at + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-chalk-500">
              {getSceneType(scene.type)?.label ?? scene.type} · {scene.durationSeconds}s
            </span>
            <button
              type="button"
              onClick={() => onChange(scene.index, { removed: true })}
              title="Ye scene hata do"
              className="shrink-0 rounded p-1 text-chalk-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={11} />
            </button>
          </div>

          <textarea
            value={scene.text}
            onChange={(event) => onChange(scene.index, { text: event.target.value })}
            rows={2}
            placeholder="Is scene par kya likha/bola jaayega"
            className="w-full resize-y rounded border border-ink-600 bg-ink-950 px-2 py-1.5 text-xs text-chalk-100 outline-none focus:border-terracotta"
          />
        </div>
      ))}

      {live.length === 0 ? (
        <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          Saare scene hata diye. Kam se kam ek chahiye — neeche se koi wapas le aao.
        </p>
      ) : null}

      {/*
        ⚠️ Hataye hue scene chhupte nahi, ek line me neeche pade rehte hain.
        Poori tarah gayab kar dene par galti se hata dena wapas nahi laaya ja
        sakta, aur aadmi ko poora wizard dobara chalana padta — sirf ek galat
        click ki wajah se.
      */}
      {removed.length > 0 ? (
        <div className="rounded border border-dashed border-ink-600 p-2">
          <p className="mb-1 text-[10px] text-chalk-500">Hataye hue ({removed.length})</p>
          {removed.map((scene) => (
            <div key={scene.index} className="flex items-center gap-2 py-0.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500 line-through">
                {scene.text || getSceneType(scene.type)?.label || scene.type}
              </span>
              <button
                type="button"
                onClick={() => onChange(scene.index, { removed: false })}
                className="flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-300 transition-colors hover:border-chalk-500"
              >
                <RotateCcw size={9} />
                wapas
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
