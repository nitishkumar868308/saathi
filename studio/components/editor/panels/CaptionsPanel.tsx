"use client";

import {
  cueProblems,
  cuesFromParsed,
  cuesToSeconds,
  formatSubtitles,
  listCaptionStyles,
  parseSubtitles,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { Captions, Download, Plus, Scissors, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { useEditorStore } from "@/lib/store";

/**
 * Caption editor (19.2 / 19.4 / 19.5).
 *
 * ⚠️ Cue ke frames **item-local** hain, isliye har jagah `item.startFrame` jodna
 * padta hai jab doc ka frame chahiye. Ye jhanjhat lagti hai par uska badla mila
 * hua hai: subtitle item ko timeline par khiskane par saari cues apne aap saath
 * chalti hain.
 */
export function CaptionsPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const selection = useEditorStore((state) => state.selection);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);

  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const captionItems = doc.items.filter((item) => item.subtitle !== null);
  const chosen =
    captionItems.find((item) => selection.itemIds.includes(item.id)) ?? captionItems[0] ?? null;

  if (!chosen) {
    return (
      <div className="p-3 text-[11px] text-chalk-500">
        <p className="mb-2">Koi caption item nahi hai.</p>
        <p>
          Timeline me ek <span className="text-chalk-300">Captions</span> item jodo — uske baad
          yahan cue banana, SRT import karna aur style badalna sab ho jaayega.
        </p>
      </div>
    );
  }

  const item = chosen as Item;
  const subtitle = item.subtitle!;
  const fps = doc.project.fps;
  const localPlayhead = playheadFrame - item.startFrame;

  function importText(text: string): void {
    const { cues, problems } = parseSubtitles(text);
    if (cues.length === 0) {
      setMessage(
        problems[0]
          ? `Kuch nahi mila — ${problems[0]}`
          : "File me koi cue nahi mila.",
      );
      return;
    }

    let counter = 0;
    applyOp(
      "setCues",
      {
        itemId: item.id,
        cues: cuesFromParsed(cues, {
          fps,
          makeId: () => `cue_${Date.now().toString(36)}_${(counter += 1)}`,
        }),
      },
      { label: "Captions import" },
    );
    /*
     * Problems chhupaye nahi jaate. Ek file me 40 me se 38 cue aa sakte hain aur
     * 2 chhoot sakte hain — bina bataye wo do cue kabhi wapas nahi aate, aur
     * user ko pata bhi nahi chalta ki kya gayab hai.
     */
    setMessage(
      problems.length > 0
        ? `${cues.length} cue aaye, ${problems.length} line chhoot gayi: ${problems[0]}`
        : `${cues.length} cue aa gaye.`,
    );
  }

  function exportFile(format: "srt" | "vtt"): void {
    const text = formatSubtitles(
      cuesToSeconds(subtitle.cues, { fps, offsetSeconds: item.startFrame / fps }),
      format,
    );
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.project.name}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 p-3 text-[11px]">
      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chalk-500">
          <Captions size={10} />
          {item.name} · {subtitle.cues.length} cue
        </h3>

        <label className="flex items-center gap-2 text-chalk-500">
          <span className="w-14 shrink-0">Style</span>
          <select
            value={subtitle.styleId}
            onChange={(event) =>
              applyOp(
                "setCaptionStyle",
                { itemId: item.id, styleId: event.target.value },
                { label: "Caption style" },
              )
            }
            className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
          >
            {listCaptionStyles().map((style) => (
              <option key={style.id} value={style.id} title={style.hint}>
                {style.label}
              </option>
            ))}
          </select>
        </label>

        {/*
         * ⚠️ Word timing ka andaaza saaf batana zaroori hai (19.8). Andaaze ko
         * asli timing ki tarah dikhane par user use theek karne ki koshish hi
         * nahi karta, aur video me highlight hamesha thoda aage-peeche rehta hai.
         */}
        {listCaptionStyles().find((style) => style.id === subtitle.styleId)?.needsWordTiming &&
        subtitle.cues.every((cue) => cue.words.length === 0) ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1 text-amber">
            Is style ko har shabd ka waqt chahiye. Abhi wo <strong>andaaze se</strong> nikal raha
            hai (shabd ki lambai ke hisaab se) — asli timing Phase 23 ki auto-captions se aayegi.
          </p>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-1 border-t border-ink-800 pt-2">
        <button
          type="button"
          onClick={() =>
            applyOp(
              "addCue",
              {
                itemId: item.id,
                startFrame: Math.max(0, localPlayhead),
                endFrame: Math.max(1, localPlayhead) + Math.round(fps * 2),
                text: "",
              },
              { label: "Cue joda" },
            )
          }
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-chalk-400 hover:bg-ink-700"
        >
          <Plus size={11} />
          Cue
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-chalk-400 hover:bg-ink-700"
        >
          <Upload size={11} />
          SRT / VTT
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,text/plain"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            importText(await file.text());
            // Wahi file dobara chunne par bhi `change` chale.
            event.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={subtitle.cues.length === 0}
          onClick={() => exportFile("srt")}
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-chalk-400 hover:bg-ink-700 disabled:opacity-40"
        >
          <Download size={11} />
          .srt
        </button>
        <button
          type="button"
          disabled={subtitle.cues.length === 0}
          onClick={() => exportFile("vtt")}
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-chalk-400 hover:bg-ink-700 disabled:opacity-40"
        >
          <Download size={11} />
          .vtt
        </button>
      </section>

      {message ? <p className="text-chalk-400">{message}</p> : null}

      <section className="space-y-1 border-t border-ink-800 pt-2">
        {subtitle.cues.length === 0 ? (
          <p className="text-chalk-500">
            Koi cue nahi. Upar se ek jodo ya SRT/VTT file import karo.
          </p>
        ) : null}

        {subtitle.cues.map((cue) => {
          const problems = cueProblems(cue);
          const live = localPlayhead >= cue.startFrame && localPlayhead < cue.endFrame;

          return (
            <div
              key={cue.id}
              className={clsx(
                "rounded border px-1.5 py-1",
                live ? "border-terracotta bg-terracotta/10" : "border-ink-700",
              )}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Yahan jao"
                  onClick={() => setPlayhead(item.startFrame + cue.startFrame)}
                  className="shrink-0 font-mono text-[10px] text-chalk-500 hover:text-chalk-300"
                >
                  {(cue.startFrame / fps).toFixed(2)}s
                </button>
                <span className="shrink-0 text-[10px] text-chalk-500">
                  → {(cue.endFrame / fps).toFixed(2)}s
                </span>
                <span className="min-w-0 flex-1" />
                <button
                  type="button"
                  title="Playhead par todo"
                  aria-label="Cue todo"
                  disabled={localPlayhead <= cue.startFrame || localPlayhead >= cue.endFrame}
                  onClick={() =>
                    applyOp(
                      "splitCueAt",
                      { itemId: item.id, cueId: cue.id, atFrame: localPlayhead },
                      { label: "Cue toda" },
                    )
                  }
                  className="shrink-0 rounded p-0.5 text-chalk-500 hover:bg-ink-700 disabled:opacity-30"
                >
                  <Scissors size={10} />
                </button>
                <button
                  type="button"
                  title="Hatao"
                  aria-label="Cue hatao"
                  onClick={() =>
                    applyOp("deleteCue", { itemId: item.id, cueId: cue.id }, { label: "Cue hataya" })
                  }
                  className="shrink-0 rounded p-0.5 text-chalk-500 hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              <textarea
                value={cue.text}
                rows={2}
                placeholder="caption ka text"
                onChange={(event) =>
                  applyOp(
                    "setCue",
                    { itemId: item.id, cueId: cue.id, text: event.target.value },
                    { label: "Cue text", coalesceKey: `cue:${cue.id}` },
                  )
                }
                className="mt-0.5 w-full resize-y rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
              />

              {/*
               * Lambai ki salah — **rukavat nahi**. Kabhi-kabhi lambi line hi
               * sahi hoti hai; user ko rokna galat hoga, batana zaroori hai.
               */}
              {problems.map((problem) => (
                <p key={problem} className="text-[10px] text-amber">
                  {problem}
                </p>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
