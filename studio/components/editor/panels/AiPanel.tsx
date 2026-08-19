"use client";

import {
  AI_LANGUAGES,
  AI_TONES,
  AiError,
  applyProposal,
  buildProposal,
  sceneTypesForPrompt,
  type AiLanguage,
  type AiTone,
  type AiUsage,
  type Proposal,
} from "@reel/core";
import clsx from "clsx";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { useAiProvider } from "@/lib/ai/provider";
import { useEditorStore } from "@/lib/store";

/**
 * AI panel (21.10 / 21.11 / 21.13).
 *
 * ⚠️ **AI ka output seedha doc me nahi jaata.** Pehle ek prastaav banta hai,
 * user use scene-by-scene dekhta hai, aur jo maanta hai wahi lagta hai — aur wo
 * bhi `replaceDoc` op se, jispar Ctrl+Z chalta hai.
 *
 * Ye bharosa ka sawaal hai: ek baar AI ne bina poochhe kisi ka kaam badal diya,
 * to wo dobara AI ke paas nahi aata.
 */
export function AiPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const ai = useAiProvider();

  const [story, setStory] = useState("");
  const [language, setLanguage] = useState<AiLanguage>("hinglish");
  const [tone, setTone] = useState<AiTone>("dostana");
  const [seconds, setSeconds] = useState(30);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; raw: string | null } | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState<AiUsage | null>(null);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const result = await ai.provider.generateScript({
        story,
        language,
        tone,
        durationSeconds: seconds,
        aspect: `${doc.project.width}:${doc.project.height}`,
        brand: { name: "Apka Saathi" },
        // Registry se, runtime par — naya scene type jodne par AI ko apne aap
        // pata chal jaata hai (21.5).
        sceneTypes: sceneTypesForPrompt(),
      });

      const next = buildProposal({ doc, script: result.data, mode: "append" });
      setProposal(next);
      setUsage(result.usage);
      /*
       * Sab entries **pehle se chuni hui** hoti hain — sivaay unke jinme galti
       * hai. Ulta karne par (sab reject) user ko har entry par click karna
       * padta, aur wo aksar poora prastaav chhod deta hai.
       */
      setAccepted(new Set(next.entries.filter((entry) => !entry.problem).map((entry) => entry.id)));
    } catch (cause) {
      const aiError = cause instanceof AiError ? cause : null;
      setError({
        message: cause instanceof Error ? cause.message : String(cause),
        // Raw output **chhupaya nahi jaata** (21.6) — usse prompt sudhaara ja
        // sakta hai; "AI ne galat jawab diya" se kuch nahi hota.
        raw: aiError?.raw ?? null,
      });
    } finally {
      setBusy(false);
    }
  }

  function apply(): void {
    if (!proposal) return;
    const result = applyProposal({ doc, proposal, acceptedIds: [...accepted] });
    if (result.applied === 0) {
      setError({ message: "Koi scene nahi bana — sab reject the ya unme galti thi.", raw: null });
      return;
    }
    applyOp("replaceDoc", { doc: result.doc }, { label: `AI: ${result.applied} scene` });
    setProposal(null);
    setUsage(null);
  }

  return (
    <div className="space-y-3 p-3 text-[11px]">
      {/*
       * ⚠️ AI ki haalat sabse upar, saaf shabdon me (21.13). "AI off hai" padh
       * kar user ko turant pata chalta hai ki wo kya dekh raha hai — warna wo
       * mock ke jawab ko AI ka jawab samajh leta hai.
       */}
      {ai.loading ? (
        <p className="text-chalk-500">AI ki haalat dekh rahe hain…</p>
      ) : ai.configured ? (
        <p className="flex items-center gap-1 text-chalk-500">
          <Sparkles size={11} className="text-terracotta" />
          AI chalu hai — {ai.model}
        </p>
      ) : (
        <div className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-chalk-400">
          <p className="text-chalk-300">AI band hai — `GEMINI_API_KEY` set nahi hai.</p>
          <p className="mt-1 text-chalk-500">
            Baaki poora editor waise ka waisa chalta hai. Neeche ka form aapki kahani ko lines me
            todkar scenes bana dega — wo AI nahi hai, aapki apni kahani ke tukde hain.
          </p>
        </div>
      )}

      <section className="space-y-1.5">
        <textarea
          value={story}
          rows={5}
          placeholder="Kahani likho — jaise: Rahul apne papa ko Apka Saathi dikha raha hai. Papa pension ke kaam se pareshaan hain."
          onChange={(event) => setStory(event.target.value)}
          className="w-full resize-y rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-chalk-200 outline-none focus:border-terracotta"
        />

        <div className="flex gap-1">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as AiLanguage)}
            className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
          >
            {AI_LANGUAGES.map((entry) => (
              <option key={entry} value={entry}>
                {entry === "hinglish" ? "Hinglish" : entry === "hi" ? "हिंदी" : "English"}
              </option>
            ))}
          </select>
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value as AiTone)}
            className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
          >
            {AI_TONES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            max={90}
            value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value))}
            className="w-14 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
          />
        </div>

        <button
          type="button"
          disabled={busy || story.trim().length === 0}
          onClick={() => void generate()}
          className="flex w-full items-center justify-center gap-1.5 rounded bg-terracotta px-2 py-1.5 text-chalk-100 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {busy ? "soch raha hai…" : "Scenes banao"}
        </button>
      </section>

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-red-300">
          <p>{error.message}</p>
          {error.raw ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] opacity-80">AI ka asli jawab</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] opacity-80">
                {error.raw.slice(0, 2000)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {proposal ? (
        <section className="space-y-1.5 border-t border-ink-800 pt-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">
              Prastaav ({accepted.size}/{proposal.entries.length})
            </h3>
            {usage ? (
              <span className="font-mono text-[10px] text-chalk-500">
                {usage.calls} call
                {usage.outputTokens !== null ? ` · ${usage.outputTokens} tok` : ""} ·{" "}
                {(usage.ms / 1000).toFixed(1)}s
              </span>
            ) : null}
          </div>

          {proposal.summary ? <p className="text-chalk-500">{proposal.summary}</p> : null}

          {proposal.entries.map((entry) => {
            const on = accepted.has(entry.id);
            return (
              <div
                key={entry.id}
                className={clsx(
                  "rounded border px-2 py-1",
                  entry.problem
                    ? "border-amber/40 bg-amber/10"
                    : on
                      ? "border-terracotta/50 bg-terracotta/10"
                      : "border-ink-700 opacity-50",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={Boolean(entry.problem)}
                    aria-pressed={on}
                    onClick={() =>
                      setAccepted((previous) => {
                        const next = new Set(previous);
                        if (next.has(entry.id)) next.delete(entry.id);
                        else next.add(entry.id);
                        return next;
                      })
                    }
                    className="shrink-0 rounded p-0.5 text-chalk-400 hover:bg-ink-700 disabled:opacity-30"
                  >
                    {on ? <Check size={11} /> : <X size={11} />}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-chalk-300">
                    {entry.scene.name || entry.scene.type}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-chalk-500">
                    {entry.scene.type} · {entry.scene.durationSeconds}s
                  </span>
                </div>

                {Object.entries(entry.scene.slots).map(([key, value]) => (
                  <p key={key} className="pl-5 text-[10px] text-chalk-500">
                    <span className="opacity-70">{key}:</span> {value}
                  </p>
                ))}

                {entry.problem ? (
                  <p className="pl-5 text-[10px] text-amber">{entry.problem}</p>
                ) : entry.scene.reason ? (
                  <p className="pl-5 text-[10px] text-chalk-500 opacity-70">{entry.scene.reason}</p>
                ) : null}
              </div>
            );
          })}

          <div className="flex gap-1">
            <button
              type="button"
              disabled={accepted.size === 0}
              onClick={apply}
              className="flex-1 rounded bg-terracotta px-2 py-1 text-chalk-100 hover:opacity-90 disabled:opacity-40"
            >
              {accepted.size} scene jodo
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="rounded border border-ink-600 px-2 py-1 text-chalk-400 hover:bg-ink-700"
            >
              Rehne do
            </button>
          </div>

          <p className="text-chalk-500">
            Jodne ke baad ye aam scenes hote hain — Ctrl+Z chalta hai, aur unpar har edit waise
            hi lagti hai jaise haath se banaye hue scenes par.
          </p>
        </section>
      ) : null}
    </div>
  );
}
