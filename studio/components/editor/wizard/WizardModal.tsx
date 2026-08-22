"use client";

import {
  applyWizard,
  autoFill,
  draftFromScript,
  draftProgress,
  type AiScript,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StepImage } from "@/components/editor/wizard/StepImage";
import { StepPreview } from "@/components/editor/wizard/StepPreview";
import { StepText } from "@/components/editor/wizard/StepText";
import { StepVoice } from "@/components/editor/wizard/StepVoice";
import { useEditorStore } from "@/lib/store";

/**
 * Reel Wizard — kahani se chalti hui reel, ek raaste me (Phase 26).
 *
 * ⚠️ Yahan sirf **jodne** ka kaam hai. Draft ka poora hisaab `@reel/core` ke
 * `wizard/draft.ts` me hai — wahan na React hai na fetch, isliye use ek script
 * se chala kar dekha ja sakta hai (`npm run check --workspace @reel/core`). Us
 * hisaab ko yahan le aana matlab use sirf haath se jaanchna, aur wo har badlav
 * ke baad 8 scene ka wizard dobara bharna hota — jo koi nahi karta.
 *
 * ⚠️ **Doc wizard ke chalte hue chhua nahi jaata.** Sab kuch `draft` me jama
 * hota hai aur ant me ek `replaceDoc` op se lagta hai. Har step par doc likhne
 * par aadha bana kaam project me pada reh jaata, aur undo ka dher ban jaata —
 * 8 scene par 30+ entries, jinme se kisi ek par rukna doc ko aadha-naya
 * aadha-purana chhod deta.
 */

const STEPS = [
  { id: 0, label: "Shabd", hint: "AI ne jo likha wo padho aur apne shabdon me badal lo." },
  {
    id: 1,
    label: "Tasveer",
    hint: "Har scene ki tasveer daalo. Na ho to chhod do — wo scene text wala ban jaayega.",
  },
  {
    id: 2,
    label: "Awaaz",
    hint: "Kis scene par kaunsi awaaz. Likha hua text bol kar sunaya ja sakta hai.",
  },
  { id: 3, label: "Dekho", hint: "Poori reel yahin chala kar dekh lo, phir editor me daalo." },
] as const;

export function WizardModal({
  open,
  script,
  onClose,
  onDone,
}: {
  open: boolean;
  script: AiScript | null;
  onClose(): void;
  onDone(applied: number): void;
}) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Script badalne par draft naye sire se. `useEffect` ki jagah ye tarika
   * jaan-boojhkar hai: effect se karne par ek render ke liye purana draft nayi
   * script ke saath dikhta hai, aur us ek frame me scene ki ginti alag hoti
   * hai — jo aankh ko jhatka lagta hai.
   */
  const [seenScript, setSeenScript] = useState<AiScript | null>(null);
  if (script && script !== seenScript) {
    setSeenScript(script);
    setDraft(autoFill(draftFromScript(script)));
    setStep(0);
    setError(null);
  }

  if (!open || !draft) return null;

  const progress = draftProgress(draft);
  const current = STEPS[step] ?? STEPS[0];

  function update(index: number, patch: Partial<WizardScene>): void {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            scenes: previous.scenes.map((scene) =>
              scene.index === index ? { ...scene, ...patch } : scene,
            ),
          }
        : previous,
    );
  }

  function fillEverything(): void {
    setDraft((previous) => (previous ? autoFill(previous) : previous));
  }

  function apply(): void {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      /*
       * ⚠️ Yahan bhi `autoFill` — aur ye bekaar nahi hai. Aadmi seedha "Dekho"
       * par jaakar "Editor me daalo" daba sakta hai bina koi chunav kiye. Bina
       * iske un scenes par transition hi na lagta, aur reel ke katne me jhatka
       * dikhta — bina kisi wajah ke.
       */
      const result = applyWizard({ doc, draft: autoFill(draft) });
      if (result.applied === 0) {
        setError(
          result.skipped[0]?.reason ??
            "Ek bhi scene nahi bana. Har scene me kuch to hona chahiye — text, tasveer ya awaaz.",
        );
        return;
      }

      applyOp("replaceDoc", { doc: result.doc }, { label: `Wizard: ${result.applied} scene` });
      onDone(result.applied);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Band karne se pehle poochho — par sirf tab jab sach me kuch kiya ho.
   *
   * ⚠️ Har baar poochhna ulta nuksaan karta hai: aadmi ek baar galti se wizard
   * khol le aur turant band kare, to bhi ek dialog milta hai. Do-teen baar ke
   * baad wo har tasdeek bina padhe "haan" dabata hai — aur phir asli wali bhi
   * bina padhe daba deta hai.
   */
  function requestClose(): void {
    const touched = draft?.scenes.some(
      (scene) => scene.visualAssetId || scene.voiceAssetId || scene.removed,
    );
    if (touched && !window.confirm("Wizard band kar dein? Yahan kiya hua kaam chala jaayega.")) {
      return;
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Reel banao"
      onClose={requestClose}
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">
            {progress.total} scene · {progress.withImage} par tasveer · {progress.withVoice} par
            awaaz
            {progress.staleVoice > 0 ? (
              <span className="text-amber"> · {progress.staleVoice} awaaz purani</span>
            ) : null}
          </span>

          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Peeche
          </Button>

          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Aage →
            </Button>
          ) : (
            <Button variant="primary" onClick={apply} disabled={busy}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : null}
              Editor me daalo
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {/* Step ki patti — kahan ho aur kitna bacha hai, ek nazar me. */}
        <div className="flex items-center gap-1">
          {STEPS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStep(entry.id)}
              className={clsx(
                "flex-1 rounded border px-2 py-1 text-[11px] transition-colors",
                entry.id === step
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-500 hover:border-chalk-500",
              )}
            >
              {entry.id + 1}. {entry.label}
            </button>
          ))}
        </div>

        {/*
          ⚠️ Har step ke sar par ek line — ye sajawat nahi hai. Iske bina har
          step ek naya imtihaan lagta hai: aadmi ko pehle ye samajhna padta hai
          ki usse kya poochha ja raha hai, aur uske baad hi wo kuch karta hai.
        */}
        <div className="flex items-start gap-2 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-chalk-400">{current.hint}</p>
          {step === 1 || step === 2 ? (
            <button
              type="button"
              onClick={fillEverything}
              title="Jo chunav khaali hain unme sifaarish bhar do — tumhare kiye hue chunav waise hi rahenge"
              className="flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100"
            >
              <Wand2 size={10} />
              Sab apne aap set karo
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {step === 0 ? <StepText draft={draft} onChange={update} /> : null}
          {step === 1 ? <StepImage draft={draft} onChange={update} /> : null}
          {step === 2 ? <StepVoice draft={draft} onChange={update} /> : null}
          {step === 3 ? <StepPreview draft={draft} /> : null}
        </div>
      </div>
    </Modal>
  );
}
