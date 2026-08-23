"use client";

import { voiceStale, type WizardDraft, type WizardScene } from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Loader2, Mic, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useUploader } from "@/lib/upload/uploader";
import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * Step 3 — **Awaaz** (26.9).
 *
 * ⚠️ Awaaz ka chunav (kaunsi aawaz) **poori reel ke liye ek baar** hai, har scene
 * par alag nahi. Ye jaan-boojhkar hai: ek hi reel me har scene ka bolne wala
 * badalta rahe to wo reel tooti hui lagti hai. Aur aath scene par aath baar wahi
 * dropdown bharna wo kaam hai jise aadmi teesre scene par chhod deta hai.
 *
 * ⚠️ Har scene ke liye call **ek-ek karke** jaati hai, ek saath nahi — bilkul
 * `VoiceBatch` ki tarah, aur usi wajah se: provider rate-limit par 429 dene
 * lagta hai, cache ka faayda khatam ho jaata hai (do same text ek saath jaayein
 * to dono nayi banti hain), aur fail hone par ye batana namumkin ho jaata hai ki
 * kaunsi fail hui.
 */

interface Category {
  id: string;
  label: string;
  hint?: string;
}

function VoiceRow({
  scene,
  at,
  categoryId,
  ttsUsable,
  onChange,
}: {
  scene: WizardScene;
  at: number;
  categoryId: string | null;
  /** Koi provider chalne layak hai? Nahi to "Awaaz banao" dabna hi nahi chahiye. */
  ttsUsable: boolean;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const uploader = useUploader({
    tags: ["wizard"],
    onFinished: ({ assetId }) =>
      onChange(scene.index, { voiceAssetId: assetId, voiceForText: scene.text }),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = voiceStale(scene);
  const task = uploader.tasks[uploader.tasks.length - 1];
  const uploading = task && task.phase !== "done" && task.phase !== "duplicate" && task.phase !== "error";

  async function generate(): Promise<void> {
    if (!scene.text.trim() || !categoryId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scene.text, categoryId }),
      });
      const json = (await response.json()) as {
        asset?: { id: string };
        error?: string;
        reason?: string;
      };
      if (!response.ok || !json.asset) {
        throw new Error(json.reason || json.error || `HTTP ${response.status}`);
      }
      /*
       * ⚠️ `voiceForText` yahin likha jaata hai — us text ke saath jisse awaaz
       * SACH ME bani. Baad me kahin se copy karne par wo do jagah alag ho sakte
       * hain, aur tab "awaaz purani hai" wala nishaan jhootha ho jaata.
       */
      // Nayi asset bani — list taaza karo, warna Export "asset nahi mila" bolega.
      forgetAssetMeta();
      onChange(scene.index, { voiceAssetId: json.asset.id, voiceForText: scene.text });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={clsx(
        "rounded border bg-ink-900 p-2",
        stale ? "border-amber/50" : "border-ink-600",
      )}
    >
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">
          Scene {at + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-300">
          {scene.text || "(koi text nahi)"}
        </span>
        {scene.voiceAssetId && !stale ? (
          <span className="shrink-0 text-[10px] text-emerald-400">awaaz lag gayi</span>
        ) : null}
      </div>

      {/*
        ⚠️ Ye chetavni is poore step ki sabse zaroori line hai. Text badalne ke
        baad bani hui awaaz purane shabdon ki reh jaati hai, aur us galti ka
        koi nishaan kahin nahi hota: reel banti hai, chalti hai, export bhi ho
        jaati hai — bas awaaz kuch aur bolti hai aur screen par kuch aur likha
        hota hai. Wo tab pata chalta hai jab reel bhej di ja chuki hoti hai.
      */}
      {stale ? (
        <p className="mb-1 flex items-start gap-1 text-[10px] leading-snug text-amber">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          Ye awaaz purane shabdon ki hai — text badal chuka hai. Dobara banao, warna reel me
          awaaz aur likha hua alag-alag honge.
        </p>
      ) : null}

      {error ? <p className="mb-1 text-[10px] text-red-300">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void generate()}
          /*
           * ⚠️ Koi provider na chale to ye button **dabta hi nahi**. Pehle dabta
           * tha aur har baar 503 deta tha — aur aadmi ko lagta tha ki galti uski
           * hai. Ek button jo dabane par kabhi kaam na kare, toote hue button
           * jaisa hi hai (README rule 5); upar likhi chetavni hi kaafi hai.
           */
          disabled={busy || !ttsUsable || !scene.text.trim() || !categoryId}
          title={
            !ttsUsable
              ? "Koi TTS provider chalne layak nahi hai — apni awaaz upload karo"
              : !scene.text.trim()
                ? "Pehle is scene ka text likho"
                : !categoryId
                  ? "Upar se ek awaaz chuno"
                  : "Is text ko bolwa kar awaaz bana do"
          }
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={9} className="animate-spin" /> : <Mic size={9} />}
          {stale ? "Dobara banao" : "Awaaz banao"}
        </button>

        <input
          ref={input}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploader.addFiles([file]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-chalk-500"
        >
          {uploading ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
          Apni awaaz
        </button>

        <div className="min-w-0 max-w-[150px] flex-1">
          <AssetPickerButton
            kind="audio"
            assetId={scene.voiceAssetId}
            onPick={(assetId) =>
              onChange(scene.index, { voiceAssetId: assetId, voiceForText: scene.text })
            }
          />
        </div>

        {scene.voiceAssetId ? (
          <button
            type="button"
            onClick={() => onChange(scene.index, { voiceAssetId: null, voiceForText: null })}
            className="rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
          >
            Hata do
          </button>
        ) : (
          <span className="text-[10px] text-chalk-500">ya chhod do</span>
        )}
      </div>
    </div>
  );
}

export function StepVoice({
  draft,
  onChange,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const live = draft.scenes.filter((scene) => !scene.removed);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [ttsOff, setTtsOff] = useState<string | null>(null);
  const ttsUsable = ttsOff === null;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/tts");
        const data = (await response.json()) as {
          categories?: Category[];
          providers?: { id: string; kind: string; available: boolean; detail: string }[];
          reason?: string;
        };
        if (!alive) return;
        setCategories(data.categories ?? []);
        setCategoryId((previous) => previous ?? data.categories?.[0]?.id ?? null);

        /*
         * ⚠️ Field ka naam `available` hai, `ok` nahi — aur ye galti maine ki
         * thi. `entry.ok` hamesha `undefined` aata tha, isliye ye jaanch hamesha
         * "koi provider nahi chalta" kehti thi. Nateeja sabse bura wala tha: TTS
         * bilkul theek chal raha tha (Gemini ki key maujood hai) par wizard use
         * band bata kar button hi disable kar deta tha.
         *
         * ⚠️ Aur `manual` wale provider ko ginna nahi hai. Wo hamesha "available"
         * hota hai kyunki usme chalta hi kuch nahi — wo to "apni file upload
         * karo" ka hi doosra naam hai. Use ginne par ye jaanch kabhi fail hi
         * nahi hoti, aur tab wo hoti hi bekaar.
         */
        const generators = (data.providers ?? []).filter((entry) => entry.kind !== "manual");
        const usable = generators.filter((entry) => entry.available);
        if (generators.length > 0 && usable.length === 0) {
          setTtsOff(
            `Koi TTS provider chalne layak nahi hai — apni awaaz upload kar sakte ho. ` +
              (generators[0]?.detail ?? ""),
          );
        }
      } catch {
        if (alive) setTtsOff("TTS ki haalat pata nahi chali — apni awaaz upload kar sakte ho.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Sab ki awaaz ek saath — par **ek-ek karke**.
   *
   * ⚠️ Ek fail hone par baaki rukti nahi. Beech ke ek scene ki wajah se aage ke
   * saat chhod dena sabse chidhane wali baat hoti — aadmi ko phir se sab chalana
   * padta.
   */
  async function runAll(): Promise<void> {
    if (!categoryId) return;
    setRunning(true);
    for (const scene of live) {
      if (!scene.text.trim()) continue;
      if (scene.voiceAssetId && !voiceStale(scene)) continue;
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scene.text, categoryId }),
        });
        const json = (await response.json()) as { asset?: { id: string } };
        if (response.ok && json.asset) {
          forgetAssetMeta();
          onChange(scene.index, { voiceAssetId: json.asset.id, voiceForText: scene.text });
        }
      } catch {
        // Ek ka fail hona baaki ko nahi rokta — nishaan us qatar par dikhta hai.
      }
    }
    setRunning(false);
  }

  const pending = live.filter((scene) => scene.text.trim() && (!scene.voiceAssetId || voiceStale(scene)));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <span className="text-[10px] text-chalk-500">Awaaz:</span>
        <select
          value={categoryId ?? ""}
          onChange={(event) => setCategoryId(event.target.value || null)}
          className="rounded border border-ink-600 bg-ink-950 px-1.5 py-1 text-[11px] text-chalk-100 outline-none focus:border-terracotta"
        >
          {categories.length === 0 ? <option value="">(koi nahi)</option> : null}
          {categories.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
          Poori reel ke liye ek hi — har scene par alag bolne wala reel ko tooti hui dikha deta hai.
        </span>

        {pending.length > 0 && ttsUsable ? (
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={running || !categoryId || !ttsUsable}
            className="flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100 disabled:opacity-40"
          >
            {running ? <Loader2 size={9} className="animate-spin" /> : <Mic size={9} />}
            Sab ki awaaz banao ({pending.length})
          </button>
        ) : null}
      </div>

      {ttsOff ? (
        <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          {ttsOff}
        </p>
      ) : null}

      {live.map((scene, at) => (
        <VoiceRow
          key={scene.index}
          scene={scene}
          at={at}
          categoryId={categoryId}
          ttsUsable={ttsUsable}
          onChange={onChange}
        />
      ))}
    </>
  );
}
