"use client";

import { itemsNeedingVoice, voiceFrames, type PendingVoice } from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

import { useEditorStore } from "@/lib/store";
import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Batch generate — ek baar me un sab ki awaaz (22.12).
 *
 * ⚠️ **Calls ek-ek karke jaate hain, ek saath nahi.** Ek saath bhejna tez lagta
 * hai par teen jagah bura hai: provider rate-limit par 429 dene lagta hai, cache
 * ka faayda khatam ho jaata hai (do same text ek saath jaayein to dono nayi
 * banti hain), aur fail hone par ye batana namumkin ho jaata hai ki **kaunsi**
 * fail hui. Ek-ek karke chalane se har scene ka apna saaf nateeja milta hai.
 *
 * ⚠️ Ek fail hone par baaki **rukti nahi**. Beech ke ek scene ki wajah se aage
 * ke saat scene chhod dena sabse chidhane wali baat hoti — user ko phir se sab
 * chalana padta. Fail hui items ginn kar aakhir me batayi jaati hain.
 */

interface Result {
  banayi: number;
  cache: number;
  fail: number;
  pehliGalti: string | null;
}

export function VoiceBatch() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const pending = itemsNeedingVoice(doc);
  const fps = doc.project.fps;

  async function runOne(entry: PendingVoice): Promise<"nayi" | "cache"> {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: entry.text,
        categoryId: entry.categoryId,
        ...(entry.providerId ? { providerId: entry.providerId } : {}),
        rate: entry.rate,
        pitch: entry.pitch,
      }),
    });
    const json = (await response.json()) as {
      asset?: { id: string; durationMs?: number | null };
      cached?: boolean;
      voiceId?: string;
      providerId?: string;
      error?: string;
      reason?: string;
    };
    if (!response.ok || !json.asset) {
      throw new Error(json.reason || json.error || `HTTP ${response.status}`);
    // Nayi asset bani — list taaza karo (nahi to Export "asset nahi mila" bolega).
    forgetAssetMeta();
    }

    const item = doc.items.find((entry2) => entry2.id === entry.itemId);
    const source = item?.audio.source;
    if (source) {
      applyOp(
        "setItemAudio",
        {
          itemIds: [entry.itemId],
          field: "source",
          value: {
            ...source,
            generatedAssetId: json.asset.id,
            generatedFromText: entry.text,
            providerId: json.providerId ?? entry.providerId,
            voiceId: json.voiceId ?? "",
          },
        },
        { label: "Batch voice" },
      );
    }

    /*
     * Lambai yahan **apne aap laga di jaati hai**, aur ye single-generate se
     * alag hai (wahan button dabana padta hai). Wajah: batch ka matlab hi
     * "sab theek kar do" hai — dus scene ke liye dus baar sync dabana usi kaam
     * ko dobara karna hoga. Aur ye sab ek hi undo entry me nahi, par har scene
     * ka apna op hai, isliye Ctrl+Z scene-dar-scene wapas le jaata hai.
     */
    const ms = json.asset.durationMs;
    if (typeof ms === "number" && ms > 0) {
      applyOp(
        "syncDurationToVoice",
        { itemId: entry.itemId, durationInFrames: voiceFrames(ms / 1000, fps) },
        { label: "Batch lambai" },
      );
    }

    return json.cached ? "cache" : "nayi";
  }

  async function run(): Promise<void> {
    setBusy(true);
    setDone(0);
    setResult(null);
    const out: Result = { banayi: 0, cache: 0, fail: 0, pehliGalti: null };

    for (const entry of pending) {
      try {
        const how = await runOne(entry);
        if (how === "cache") out.cache += 1;
        else out.banayi += 1;
      } catch (cause: unknown) {
        out.fail += 1;
        if (!out.pehliGalti) {
          out.pehliGalti = cause instanceof Error ? cause.message : String(cause);
        }
      }
      setDone((value) => value + 1);
    }

    setResult(out);
    setBusy(false);
  }

  return (
    <section className="border-t border-ink-600">
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        Sab ki awaaz
      </h3>

      <div className="space-y-1.5 px-3 pb-2">
        {pending.length === 0 ? (
          <p className="text-[11px] text-chalk-500">
            Abhi kisi scene ki awaaz banni baaki nahi hai.
          </p>
        ) : (
          <p className="text-[11px] text-chalk-400">
            <strong>{pending.length}</strong> jagah awaaz banni baaki hai — jinki bani hi nahi,
            aur jinka text baad me badal gaya.
          </p>
        )}

        <button
          type="button"
          disabled={busy || pending.length === 0}
          onClick={() => void run()}
          title={
            pending.length === 0
              ? "Kuch baaki nahi hai"
              : `${pending.length} awaaz ek-ek karke banegi`
          }
          className={clsx(
            "flex w-full items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
            !busy && pending.length > 0
              ? "border-terracotta bg-terracotta/15 text-chalk-200 hover:bg-terracotta/25"
              : "cursor-not-allowed border-ink-600 text-chalk-500",
          )}
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
          {busy ? `Ban rahi hain… ${done}/${pending.length}` : `Sab ${pending.length} banao`}
        </button>

        {result ? (
          <div className="space-y-0.5 text-[10px] leading-snug">
            {/*
             * Nayi aur cache alag-alag ginte hain — kyunki sirf "nayi" wali ka
             * paisa lagta hai, aur user ko wo number dikhna chahiye.
             */}
            <p className="text-sage">
              {result.banayi} nayi bani · {result.cache} cache se mili (koi kharcha nahi)
            </p>
            {result.fail > 0 ? (
              <p className="flex items-start gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1 text-amber">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {result.fail} nahi ban paayi — pehli galti: {result.pehliGalti}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
