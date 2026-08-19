"use client";

import { getItemType, type Item } from "@reel/core";
import { Loader2, Music, Scissors } from "lucide-react";
import { useState } from "react";

import { useEditorStore } from "@/lib/store";

/**
 * Beat par snap + chuppi auto-trim (24.7).
 *
 * ⚠️ Beat pehle **dikhte** hain, phir lagte hain. Ek button jo seedha saare cut
 * khiska de, bahut chalaak lagta hai aur bilkul bhi bharose ka nahi: energy se
 * nikale hue beat dheemi, bina drum wali dhun par galat hote hain, aur tab user
 * ka poora timeline chup-chaap hil chuka hota hai. Isliye pehle "kitne beat
 * mile, BPM kya laga" dikhta hai — aur snap uske baad ka alag faisla hai.
 *
 * ⚠️ Dono kaam normal op se hote hain, yaani Ctrl+Z se poore wapas aate hain.
 */
export function RhythmSection({ items }: { items: readonly Item[] }) {
  const applyOp = useEditorStore((store) => store.applyOp);
  const selection = useEditorStore((store) => store.selection);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    beats: number[];
    bpm: number | null;
    trim: { startSeconds: number; endSeconds: number } | null;
  } | null>(null);

  const target = items.length === 1 ? (items[0] as Item) : null;
  if (!target || !getItemType(target.type)?.hasAudio || !target.assetId) return null;

  async function analyze(): Promise<void> {
    if (!target?.assetId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/audio/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: target.assetId }),
      });
      const data = (await response.json()) as {
        beats?: number[];
        bpm?: number | null;
        trim?: { startSeconds: number; endSeconds: number } | null;
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Naap nahi ho paayi.");
        return;
      }
      setAnalysis({
        beats: data.beats ?? [],
        bpm: data.bpm ?? null,
        trim: data.trim ?? null,
      });
      setMessage(
        `${data.beats?.length ?? 0} beat mile${data.bpm ? `, lagbhag ${data.bpm} BPM` : ""}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t border-ink-800 px-3 py-2">
      <h3 className="flex items-center gap-1 pb-1 text-[10px] uppercase tracking-wide text-chalk-500">
        <Music size={10} />
        Taal se
      </h3>

      <button
        type="button"
        disabled={busy}
        onClick={() => void analyze()}
        className="flex w-full items-center justify-center gap-1 rounded border border-ink-600 py-1 text-[11px] text-chalk-300 transition-colors hover:bg-ink-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Music size={11} />}
        Beat aur chuppi naapo
      </button>

      {analysis ? (
        <div className="mt-1.5 space-y-1">
          <button
            type="button"
            disabled={analysis.beats.length === 0 || selection.itemIds.length === 0}
            onClick={() => {
              applyOp(
                "snapItemsToBeats",
                { itemIds: selection.itemIds, beatTimes: analysis.beats },
                { label: "Beat par snap" },
              );
              setMessage(`${selection.itemIds.length} clip beat par lagayi gayi.`);
            }}
            className="flex w-full items-center justify-center gap-1 rounded border border-terracotta bg-terracotta/15 py-1 text-[11px] text-chalk-200 transition-colors hover:bg-terracotta/25 disabled:opacity-40"
          >
            <Music size={11} />
            Chuni hui clip beat par lagao
          </button>

          {/*
           * ⚠️ Sirf paas wale beat par snap hota hai (0.25s ke andar). Door ka
           * cut chhoot jaata hai — warna user ka soch-samajh kar lagaya hua cut
           * chup-chaap kahin aur chala jaata.
           */}
          <p className="text-[11px] text-chalk-500">
            Sirf 0.25s ke andar wale beat par khiskegi — door wali clip waise hi rahegi.
          </p>

          {analysis.trim ? (
            <button
              type="button"
              onClick={() => {
                const trim = analysis.trim;
                if (!trim) return;
                applyOp(
                  "trimItemToSourceRange",
                  {
                    itemId: target.id,
                    startSeconds: trim.startSeconds,
                    endSeconds: trim.endSeconds,
                  },
                  { label: "Chuppi kaati" },
                );
                setMessage(
                  `Shuru ki ${trim.startSeconds.toFixed(2)}s chuppi kati; ${trim.endSeconds.toFixed(2)}s par khatam.`,
                );
              }}
              className="flex w-full items-center justify-center gap-1 rounded border border-ink-600 py-1 text-[11px] text-chalk-300 transition-colors hover:bg-ink-700"
            >
              <Scissors size={11} />
              Shuru/ant ki chuppi kaato
            </button>
          ) : (
            <p className="text-[11px] text-chalk-500">
              Shuru aur ant me kaatne layak chuppi nahi mili.
            </p>
          )}
        </div>
      ) : null}

      {message ? <p className="pt-1 text-[11px] text-chalk-400">{message}</p> : null}
    </section>
  );
}
