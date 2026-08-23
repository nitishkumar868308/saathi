"use client";

import {
  sceneAdvice,
  sceneSeconds,
  voiceStale,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Info, Loader2, Mic, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useAssetDurations } from "@/lib/assetMeta";
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

/**
 * Awaaz ki raftaar ke chunav — **naam ke saath, number ke saath nahi**.
 *
 * WARNING: Ye `playbackRate` hai, TTS se dobara maangna nahi. Farak asli hai:
 * yahan 1.15 ka matlab theek 1.15 guna hai aur scene ki lambai bhi usi hisaab se
 * ghat jaati hai. Provider se "thoda tez bolo" maangne par nateeja kabhi 1.5x
 * hota hai kabhi 1.05x — us andaaze par scene ki lambai bandhi nahi ja sakti.
 *
 * WARNING: Sabse tez 1.3x par ruk-ta hai. Usse aage shabd aapas me chipak jaate
 * hain; wo slider par ek number ki tarah dikhta hai par sunne me toota hua lagta
 * hai. Jo hadd nateeja kharab karti ho, use dena hi nahi chahiye.
 */
const VOICE_RATES = [
  { rate: 0.85, label: "Dheemi", when: "Bhaari baat — sunne wale ko rukna chahiye" },
  { rate: 1, label: "Normal", when: "Jaisi bani thi" },
  { rate: 1.15, label: "Tez", when: "Reel ki aam raftaar — 30s me zyada baat" },
  { rate: 1.3, label: "Bahut tez", when: "Sirf list ya ginti wali line par" },
] as const;

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
  /*
   * WARNING: Yahan se awaaz ki LAMBAI bhi aati hai, sirf id nahi. Scene ki lambai
   * usi se banti hai; bina uske scene AI ke andaaze par chalta hai aur awaaz ya
   * to beech me kat jaati hai ya uske baad chup baithi rehti hai. TTS to lambai
   * jawab me hi de deta hai — upload aur library wali awaaz ke liye ye list se
   * poochhni padti hai.
   */
  const meta = useAssetDurations(30);
  const secondsOf = (assetId: string | null): number | null => {
    const frames = meta.sourceFrames(assetId);
    return frames === null ? null : frames / 30;
  };

  const uploader = useUploader({
    tags: ["wizard"],
    onFinished: ({ assetId }) =>
      onChange(scene.index, {
        voiceAssetId: assetId,
        voiceForText: scene.text,
        voiceSeconds: secondsOf(assetId),
      }),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = voiceStale(scene);
  /*
   * `voiceStale` wali baat upar apni jagah alag se likhi hai (wo is step ki sabse
   * zaroori line hai), isliye yahan usse hata diya jaata hai — ek hi baat do
   * jagah likhi ho to dono ki keemat aadhi ho jaati hai.
   */
  const advice = sceneAdvice(scene, at).filter((entry) => !entry.text.startsWith("Awaaz banne"));
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
        asset?: { id: string; durationMs?: number | null };
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
      onChange(scene.index, {
        voiceAssetId: json.asset.id,
        voiceForText: scene.text,
        // Lambai wahi jo abhi bani — scene ki lambai isi par bandhi hai.
        voiceSeconds: json.asset.durationMs ? json.asset.durationMs / 1000 : null,
      });
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
              onChange(scene.index, {
                voiceAssetId: assetId,
                voiceForText: scene.text,
                voiceSeconds: secondsOf(assetId),
              })
            }
          />
        </div>

        {scene.voiceAssetId ? (
          <button
            type="button"
            onClick={() =>
              onChange(scene.index, { voiceAssetId: null, voiceForText: null, voiceSeconds: null })
            }
            className="rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
          >
            Hata do
          </button>
        ) : (
          <span className="text-[10px] text-chalk-500">ya chhod do</span>
        )}
      </div>

      {/*
        Raftaar — sirf tab jab awaaz ho.

        ⚠️ Iske saath hi scene ki nayi lambai bhi likhi jaati hai, aur wo do
        number ek saath dikhna zaroori hai. Raftaar akela ek andaaza hai; "1.15x
        · scene 3.7s" ek nateeja hai. Jo cheez turant nateeja dikhati hai, usse
        aadmi khelta hai aur seekh jaata hai — jo nahi dikhati, use wo chhoota hi
        nahi.
      */}
      {scene.voiceAssetId ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-1.5">
          <span className="text-[10px] text-chalk-500">Raftaar:</span>
          {VOICE_RATES.map((entry) => (
            <button
              key={entry.rate}
              type="button"
              title={entry.when}
              onClick={() => onChange(scene.index, { voiceRate: entry.rate })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                Math.abs(scene.voiceRate - entry.rate) < 0.01
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {entry.label}
            </button>
          ))}
          <span className="min-w-0 flex-1 text-right font-mono text-[10px] text-chalk-500">
            {scene.voiceSeconds
              ? `${scene.voiceRate.toFixed(2)}x · scene ${sceneSeconds(scene).toFixed(1)}s`
              : "lambai pata nahi"}
          </span>
        </div>
      ) : null}

      {/*
        ⚠️ Salaah yahin dikhti hai, us scene ke saath — ek jama ki hui list me
        nahi. List me "scene 4 par awaaz bahut tez hai" padh kar aadmi ko pehle
        scene 4 dhoondhna padta hai, aur wo aksar dhoondhta hi nahi.
      */}
      {advice.length > 0 ? (
        <div className="mt-1 space-y-0.5">
          {advice.map((entry) => (
            <p
              key={entry.text}
              className={clsx(
                "flex items-start gap-1 text-[10px] leading-snug",
                entry.level === "warn" ? "text-amber" : "text-chalk-500",
              )}
            >
              {entry.level === "warn" ? (
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              ) : (
                <Info size={10} className="mt-0.5 shrink-0" />
              )}
              {entry.text}
            </p>
          ))}
        </div>
      ) : null}
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
