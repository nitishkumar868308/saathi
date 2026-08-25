"use client";

import {
  AI_LANGUAGES,
  AI_TONES,
  AiError,
  sceneTypesForPrompt,
  type AiLanguage,
  type AiScript,
  type AiTone,
  type AiUsage,
} from "@reel/core";
import { Loader2, PenLine, Sparkles } from "lucide-react";
import { useState } from "react";

import { WizardModal } from "@/components/editor/wizard/WizardModal";
import { useAiProvider } from "@/lib/ai/provider";
import { useEditorStore } from "@/lib/store";

/**
 * AI panel (21.10 / 21.11 / 21.13).
 *
 * ⚠️ **AI ka output seedha doc me nahi jaata.** Wo wizard me khulta hai, jahan
 * user har scene ka text, tasveer aur awaaz dekh kar tay karta hai — aur ant me
 * sab ek `replaceDoc` op se lagta hai, jispar Ctrl+Z chalta hai.
 *
 * Ye bharosa ka sawaal hai: ek baar AI ne bina poochhe kisi ka kaam badal diya,
 * to wo dobara AI ke paas nahi aata.
 *
 * ⚠️ Purani scene-by-scene accept/reject list **hata di gayi** (26.12). Wizard
 * khud ek poora review hai; uske pehle ek aur review rakhne ka matlab tha do
 * baar wahi cheez dekhna — aur doosri baar koi dhyan se nahi dekhta. Scene
 * hataane ka button wizard ke pehle step me hi hai.
 */
export function AiPanel() {
  const doc = useEditorStore((state) => state.doc);
  const ai = useAiProvider();

  const [story, setStory] = useState("");
  const [language, setLanguage] = useState<AiLanguage>("hinglish");
  const [tone, setTone] = useState<AiTone>("dostana");
  const [seconds, setSeconds] = useState(30);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; raw: string | null } | null>(null);
  const [script, setScript] = useState<AiScript | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    setDone(null);
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

      /*
       * Script seedha wizard me. Yahan koi prastaav-list nahi banti — wizard hi
       * wo jagah hai jahan user har scene dekhta hai, aur wahin uske paas wo do
       * cheezein bhi hain jo AI de hi nahi sakta: apni tasveer aur apni awaaz.
       */
      setScript(result.data);
      setUsage(result.usage);
      setWizardOpen(true);
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

        {/*
          Khaali prompt par AI ko **bulaya hi nahi jaata** (26.27).

          ⚠️ Pehle ye button khaali prompt par bas dabta nahi tha. Wo galat nahi
          tha, par wo ek aisa darwaza band karta tha jo khula rehna chahiye: bahut
          baar aadmi ko AI chahiye hi nahi hoti — use do scene khud likhne hote
          hain, apni tasveer ke saath. Uske liye pehle ek jhooti prompt likhni
          padti thi, AI ki script aane ka intezaar karna padta tha, aur phir usko
          mita kar apna text likhna padta tha. Yaani ek poori call ka paisa aur
          waqt sirf wizard kholne ke liye.

          ⚠️ Button ka naam bhi badalta hai. Ek hi naam rakh kar do alag kaam
          karwana wahi cheez hai jisse aadmi ko bharosa nahi rehta ki dabane par
          paisa lagega ya nahi — aur yahan wahi sabse zaroori baat hai.
        */}
        <button
          type="button"
          /*
           * ⚠️ Sirf `busy` par band. Ek click ke baad jab tak jawab na aaye,
           * dobara dabana ek aur poori call hai — aur uska nateeja bhi wahi
           * hota hai jo pehli ka. Ye hifazat yahan hai, `generate()` ke andar
           * nahi: dabne se pehle rokna hi asli rokna hai.
           */
          disabled={busy}
          onClick={() => {
            if (story.trim().length === 0) {
              setScript(null);
              setUsage(null);
              setError(null);
              setWizardOpen(true);
              return;
            }
            void generate();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded bg-terracotta px-2 py-1.5 text-chalk-100 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : story.trim().length === 0 ? (
            <PenLine size={12} />
          ) : (
            <Sparkles size={12} />
          )}
          {busy
            ? "soch raha hai…"
            : story.trim().length === 0
              ? "Khud scene banao (AI nahi chalega)"
              : "Scenes banao"}
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

      {/*
        AI ka kharcha saaf dikhta hai — chhupane par ye kabhi pata nahi chalta ki
        ek reel banane me kitna gaya, aur "AI mehnga hai" ek ehsaas bana rehta
        hai jiska koi number nahi hota.
      */}
      {usage ? (
        <p className="border-t border-ink-800 pt-2 font-mono text-[10px] text-chalk-500">
          {usage.calls} call
          {usage.outputTokens !== null ? ` · ${usage.outputTokens} tok` : ""} ·{" "}
          {(usage.ms / 1000).toFixed(1)}s
        </p>
      ) : null}

      {done ? (
        <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-300">
          {done} Ctrl+Z se poora wapas ho sakta hai.
        </p>
      ) : null}

      {/*
        ⚠️ Shart `wizardOpen` par hai, `script` par nahi (26.27). Pehle wizard
        tabhi ban'ta tha jab script aa chuki ho — theek tha, jab tak wizard me
        jaane ka ek hi raasta AI tha. Ab do hain, aur khaali wala (`script ===
        null`) is shart me kabhi ghus hi nahi paata tha.

        ⚠️ Jo baat pehle bhi sach thi aur ab bhi hai: AI chalte waqt wizard khula
        nahi rakha jaata. Ek khaali dabbe ke saamne "intezaar karo" dikhane se
        aadmi ko ye pata hi nahi chalta ki kuch ho bhi raha hai ya nahi — isliye
        `generate()` khatam hone par hi `setWizardOpen(true)` hota hai.
      */}
      {wizardOpen ? (
        <WizardModal
          open={wizardOpen}
          script={script}
          onClose={() => setWizardOpen(false)}
          onDone={(applied) => {
            setWizardOpen(false);
            setScript(null);
            setDone(`${applied} scene ban gaye.`);
          }}
        />
      ) : null}

      {/*
        Script bani hui hai par wizard band kar diya — dobara kholne ka raasta
        rehna chahiye, warna wo poori AI call bekaar chali jaati.
      */}
      {script && !wizardOpen ? (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="w-full rounded border border-ink-600 px-2 py-1.5 text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100"
        >
          Wizard dobara kholo
        </button>
      ) : null}

    </div>
  );
}
