"use client";

import {
  applyCaptionScript,
  buildCues,
  CAPTION_SCRIPTS,
  getItemType,
  type CaptionScript,
  type Item,
  type TranscriptWord,
} from "@reel/core";
import clsx from "clsx";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useEditorStore } from "@/lib/store";

/**
 * Auto captions (23.3 / 23.4 / 23.8 / 23.10).
 *
 * ⚠️ Yahan **do alag raaste** hain aur unhe alag dikhana zaroori hai:
 *
 *  - Awaaz humne TTS se banayi hai → text pehle se pata hai, sirf timing
 *    nikalni hai. Iske liye kuch install karne ki zaroorat **nahi** (23.5).
 *  - Awaaz upload/record ki hui hai → whisper chahiye.
 *
 * Isliye button tabhi dikhta hai jab wo sach me kuch kar sakta ho. Jab whisper
 * nahi hai aur text bhi nahi, tab button ki jagah saaf likha hota hai ki kya
 * karna hai — kyunki aisa button jo dabane par kuch na kare, sabse bura hota
 * hai (README: NO FAKE FEATURES).
 */

interface Status {
  available: boolean;
  detail: string;
  models: readonly string[];
  defaultModel: string;
  install: string;
}

const LANGUAGES = [
  { id: "auto", label: "Auto" },
  { id: "hi", label: "Hindi" },
  { id: "en", label: "English" },
] as const;

export function AutoCaptionsSection({ subtitleItem }: { subtitleItem: Item }) {
  const doc = useEditorStore((state) => state.doc);
  const projectId = useEditorStore((state) => state.projectId);
  const applyOp = useEditorStore((state) => state.applyOp);

  const [status, setStatus] = useState<Status | null>(null);
  const [sourceItemId, setSourceItemId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("auto");
  const [script, setScript] = useState<CaptionScript>("auto");
  const [model, setModel] = useState<string>("small");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/transcribe")
      .then((response) => response.json() as Promise<Status>)
      .then((data) => {
        if (!alive) return;
        setStatus(data);
        setModel(data.defaultModel);
      })
      .catch(() => {
        /*
         * Route hi na chale (dev server band, env adhoora) — tab bhi kuch tootna
         * nahi chahiye. `available: false` matlab wahi jo sach hai: abhi nahi
         * ho sakta.
         */
        if (alive) {
          setStatus({
            available: false,
            detail: "status nahi mila",
            models: ["small"],
            defaultModel: "small",
            install: "pip install faster-whisper",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  // Jinme awaaz hoti hai — video aur audio dono.
  const audioItems = doc.items.filter((item) => getItemType(item.type)?.hasAudio && item.assetId);
  const chosen = audioItems.find((item) => item.id === sourceItemId) ?? audioItems[0] ?? null;

  /** TTS se bani awaaz? Tab text pehle se hai aur whisper ki zaroorat nahi (23.5). */
  const knownText = chosen?.audio.source?.text?.trim() ?? "";
  const canRun = knownText.length > 0 || (status?.available ?? false);

  async function run(): Promise<void> {
    if (!chosen?.assetId || !projectId) return;

    /*
     * ⚠️ 23.8 — purani cues par likhne se pehle poochho. Auto-captions ka poora
     * matlab hi ye hai ki uske baad user haath se sudhare; wo mehnat chup-chaap
     * mita dena sabse badi galti hoti, aur undo bhi tab tak yaad nahi rehta.
     */
    const existing = subtitleItem.subtitle?.cues ?? [];
    if (existing.length > 0) {
      const okay = window.confirm(
        `${existing.length} cue pehle se hain. Nayi captions unhe poori tarah badal dengi. Aage badhein?`,
      );
      if (!okay) return;
    }

    setBusy(true);
    setMessage("Job queue me daali ja rahi hai…");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetId: chosen.assetId,
          language,
          model,
          ...(knownText ? { text: knownText } : {}),
        }),
      });
      const data = (await response.json()) as {
        job?: { id: string };
        error?: string;
        install?: string;
      };
      if (!response.ok || !data.job) {
        setMessage(data.error ?? "Job nahi ban paayi.");
        return;
      }

      const words = await waitForJob(data.job.id, (progress) =>
        setMessage(`Chal rahi hai… ${progress}%`),
      );
      if (!words) {
        setMessage("Job poori nahi hui — Renders panel me wajah dikhegi.");
        return;
      }

      const fps = doc.project.fps;
      const cues = buildCues(words, {
        fps,
        offsetSeconds: subtitleItem.startFrame / fps,
        makeId: (index) => `cue_${Date.now().toString(36)}_${index}`,
      }).map((cue) => ({
        ...cue,
        text: applyCaptionScript(cue.text, script),
        words: cue.words.map((word) => ({
          ...word,
          text: applyCaptionScript(word.text, script),
        })),
      }));

      applyOp("setCues", { itemId: subtitleItem.id, cues }, { label: "Auto captions" });
      setMessage(`${cues.length} cue ban gayi (${words.length} shabd).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-1.5 border-t border-ink-800 pt-2">
      <h3 className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chalk-500">
        <Sparkles size={10} />
        Auto captions
      </h3>

      {audioItems.length === 0 ? (
        <p className="text-chalk-500">
          Timeline me koi awaaz wali item nahi hai. Pehle audio ya video daalo.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-chalk-500">
            <span className="w-14 shrink-0">Awaaz</span>
            <select
              value={chosen?.id ?? ""}
              onChange={(event) => setSourceItemId(event.target.value)}
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
            >
              {audioItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {knownText ? (
            /*
             * Ye sirf ek "achhi khabar" nahi hai — user ko ye jaanna chahiye ki
             * timing naapi nahi gayi, banayi gayi hai. Warna wo ise whisper
             * jaisi pakki maan kar karaoke laga deta hai.
             */
            <p className="rounded border border-ink-600 bg-ink-800/60 px-1.5 py-1 text-chalk-500">
              Is awaaz ka text pehle se hai (TTS) — whisper ki zaroorat nahi.
              Timing chuppi ke naksha se nikalegi, naapi nahi jaayegi.
            </p>
          ) : null}

          <label className="flex items-center gap-2 text-chalk-500">
            <span className="w-14 shrink-0">Bhasha</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
            >
              {LANGUAGES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 text-chalk-500">
            <span className="w-14 shrink-0">Likhawat</span>
            <div className="flex flex-1 gap-1">
              {CAPTION_SCRIPTS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  title={entry.hint}
                  onClick={() => setScript(entry.id)}
                  className={clsx(
                    "flex-1 rounded border px-1 py-0.5 transition-colors",
                    script === entry.id
                      ? "border-terracotta bg-terracotta/15 text-chalk-200"
                      : "border-ink-600 hover:bg-ink-700",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          {!knownText && status?.available ? (
            <label className="flex items-center gap-2 text-chalk-500">
              <span className="w-14 shrink-0">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-chalk-200 outline-none focus:border-terracotta"
              >
                {status.models.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {canRun ? (
            <button
              type="button"
              disabled={busy || !chosen?.assetId}
              onClick={() => void run()}
              className="flex w-full items-center justify-center gap-1 rounded border border-terracotta bg-terracotta/15 py-1 text-chalk-200 transition-colors hover:bg-terracotta/25 disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              Captions banao
            </button>
          ) : (
            /*
             * ⚠️ Yahan button jaan-boojhkar **nahi** hai. Disabled button bhi
             * dikha sakte the, par wo bhi jhooth ke paas hi hai: user usse
             * dabane ki koshish karta rehta hai aur samajh nahi paata ki kyun
             * kuch nahi ho raha. Seedha likha hai ki kya karna hai.
             */
            <p className="rounded border border-ink-600 bg-ink-800/60 px-1.5 py-1 text-chalk-500">
              <span className="text-chalk-300">Auto captions band hain</span> — setup chahiye.
              <br />
              Chalao: <code className="rounded bg-ink-900 px-1">{status?.install ?? "pip install faster-whisper"}</code>
              <br />
              Uske baad ye button apne aap aa jaayega.
            </p>
          )}

          {message ? <p className="text-chalk-400">{message}</p> : null}
        </>
      )}
    </section>
  );
}

/**
 * Job poori hone ka intezaar (23.10).
 *
 * ⚠️ Polling hi sahi hai yahan: UI kabhi block nahi hoti, aur user beech me
 * kuch bhi kar sakta hai. Route ko rok kar rakhna (jab tak transcription poori
 * na ho) matlab poora editor jam jaana — 30 second ki awaaz par whisper aadha
 * minute le leta hai.
 */
async function waitForJob(
  jobId: string,
  onProgress: (progress: number) => void,
): Promise<TranscriptWord[] | null> {
  // ~5 minute — usse lambi transcription ka matlab hai ki kahin kuch atka hai.
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await new Promise((wait) => setTimeout(wait, 1000));

    const response = await fetch(`/api/transcribe?jobId=${jobId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      job: {
        status: string;
        progress: number;
        result: { words?: TranscriptWord[] };
      };
    };

    onProgress(data.job.progress);
    if (data.job.status === "completed") return data.job.result.words ?? [];
    if (data.job.status === "failed" || data.job.status === "cancelled") return null;
  }
  return null;
}
