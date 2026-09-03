"use client";

import {
  applyWizard,
  autoFill,
  draftAdvice,
  draftFromScript,
  emptyDraft,
  draftProgress,
  draftTotalSeconds,
  insertSceneAfter,
  moveScene,
  type AiScript,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Info, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StepImage } from "@/components/editor/wizard/StepImage";
import { StepPreview } from "@/components/editor/wizard/StepPreview";
import { StepText } from "@/components/editor/wizard/StepText";
import { StepVoice } from "@/components/editor/wizard/StepVoice";
import { useEditorStore, type WizardRequest } from "@/lib/store";

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
    hint: "Kis scene par kaunsi awaaz, peeche kaunsa music, aur kahan kitna tez — sab yahin.",
  },
  { id: 3, label: "Dekho", hint: "Poori reel yahin chala kar dekh lo, phir editor me daalo." },
] as const;

export function WizardModal() {
  const request = useEditorStore((state) => state.wizardRequest);
  const closeWizard = useEditorStore((state) => state.closeWizard);

  if (!request) return null;
  return <WizardBody key={request.key} request={request} onClose={closeWizard} />;
}

/**
 * Asli wizard — `key` par **remount** hota hai.
 *
 * ⚠️ Remount jaan-boojhkar hai. Pehle draft ko nayi script par `useState` ke
 * andar hi badla jaata tha ("pehle kaunsi script dekhi thi" wala tarika), aur ab
 * wizard me aane ke do alag raaste hain: nayi script se, aur bani hui reel ke
 * jama kiye hue draft se. Un dono ke liye alag-alag "pehle kya dekha tha" rakhne
 * par ek raasta doosre ka aadha bhara draft le kar khulta hai — aur aadmi ko
 * sirf itna dikhta hai ki uska chunav maana hi nahi gaya.
 *
 * ⚠️ `useEffect` yahan bhi nahi hai, aur wajah wahi purani hai: effect se
 * karne par ek render ke liye purana draft nayi farmaaish ke saath dikhta hai,
 * aur us ek frame me scene ki ginti alag hoti hai — jo aankh ko jhatka lagta hai.
 */
function WizardBody({
  request,
  onClose,
}: {
  request: WizardRequest;
  onClose(): void;
}) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  /*
   * ⚠️ Draft kabhi `null` nahi hota — remount ne us halat ko khatam kar diya.
   * Isi wajah se neeche har `setDraft` seedha naya draft banata hai, "pehle kuch
   * tha bhi ya nahi" ki jaanch ke bina.
   */
  const [draft, setDraft] = useState<WizardDraft>(() =>
    request.draft ??
    (request.script ? autoFill(draftFromScript(request.script)) : emptyDraft()),
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = draftProgress(draft);
  const current = STEPS[step] ?? STEPS[0];
  /*
   * ⚠️ Lambai wahi ginti hai jo `applyWizard` lagayega (`draftTotalSeconds`), AI
   * ka andaaza nahi. Do alag hisaab rakhne par footer "30 second" bolta aur reel
   * 36 ki banti — aur wo farak sirf export ke baad pakda jaata. Isi wajah se
   * scene ke beech ki saans bhi usi function me judti hai, yahan nahi.
   */
  const totalSeconds = draftTotalSeconds(draft);
  const advice = draftAdvice(draft);

  function update(index: number, patch: Partial<WizardScene>): void {
    setDraft((previous) => ({
      ...previous,
      scenes: previous.scenes.map((scene) =>
        scene.index === index ? { ...scene, ...patch } : scene,
      ),
    }));
  }

  /**
   * Scene ki tarteeb aur nayi qatarein.
   *
   * ⚠️ Poora hisaab `@reel/core` me hai (`moveScene`, `insertSceneAfter`), yahan
   * sirf `setDraft`. Wajah wahi hai jo poore wizard ki: hataye hue scene beech me
   * pade rehte hain, aur "padosi" ka matlab list ka agla khaana nahi hota. Wo
   * hisaab UI me likhne par sirf haath se hi jaancha ja sakta tha — yaani har
   * badlav par aath scene ka wizard dobara bharna, jo koi nahi karta.
   */
  function move(index: number, delta: -1 | 1): void {
    setDraft((previous) => moveScene(previous, index, delta));
  }

  function addScene(afterIndex: number | null): void {
    setDraft((previous) => insertSceneAfter(previous, afterIndex));
  }

  function setGap(seconds: number): void {
    setDraft((previous) => ({ ...previous, gapSeconds: seconds }));
  }

  function setMusic(assetId: string | null): void {
    setDraft((previous) => ({ ...previous, musicAssetId: assetId }));
  }

  function setMusicTrim(trim: { startSeconds: number; endSeconds: number } | null): void {
    setDraft((previous) => (previous ? { ...previous, musicTrim: trim } : previous));
  }

  function setMusicVolume(volume: number): void {
    setDraft((previous) => ({ ...previous, musicVolume: volume }));
  }

  /**
   * Poori reel ki awaaz ka chunav.
   *
   * ⚠️ Ye draft me rehta hai, Awaaz wale step ke andar nahi — aur wo ek asli bug
   * ka ilaaj hai. Step ke andar rehne par wo har baar step khulne par pehli
   * category par gir jaata tha, aur aadhi reel doosri awaaz me ban jaati thi.
   */
  function setVoiceCategory(categoryId: string): void {
    setDraft((previous) => ({ ...previous, voiceCategoryId: categoryId }));
  }

  function setTextScale(scale: number): void {
    setDraft((previous) => ({ ...previous, textScale: scale }));
  }

  function setTextColor(color: string | null): void {
    setDraft((previous) => ({ ...previous, textColor: color }));
  }

  function setReplaceExisting(value: boolean): void {
    setDraft((previous) => ({ ...previous, replaceExisting: value }));
  }

  function fillEverything(): void {
    setDraft((previous) => autoFill(previous));
  }

  function apply(): void {
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
      onClose();
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
    /*
     * ⚠️ Yahan har wo cheez ginni jaati hai jise dobara karna padega — sirf
     * asset nahi. Naya scene jodna, tarteeb badalna, lambai haath se tay karna:
     * teeno me mehnat lagti hai, aur teeno chup-chaap chale jaate the, kyunki ye
     * jaanch unhe dekhti hi nahi thi.
     */
    const touched =
      draft.musicAssetId !== null ||
      draft.scenes.some(
        (scene) =>
          scene.visualAssetId ||
          scene.visualFitAssetId ||
          scene.voiceAssetId ||
          scene.removed ||
          scene.durationOverrideSeconds !== null ||
          scene.effectPresetId !== null ||
          scene.musicAssetId !== null ||
          scene.voiceTrim !== null ||
          scene.voiceVolumePoints.length > 0 ||
          scene.musicVolumePoints.length > 0 ||
          Object.keys(scene.tweaks ?? {}).length > 0,
      );
    if (touched && !window.confirm("Wizard band kar dein? Yahan kiya hua kaam chala jaayega.")) {
      return;
    }
    onClose();
  }

  return (
    <Modal
      open
      title="Reel banao"
      onClose={requestClose}
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">
            {progress.total} scene · {Math.round(totalSeconds)}s · {progress.withImage} par tasveer
            · {progress.withVoice} par awaaz
            {progress.staleVoice > 0 ? (
              <span className="text-amber"> · {progress.staleVoice} awaaz purani</span>
            ) : null}
            {/*
              ⚠️ Mel na khaane wali ginti footer me hai, kisi step ke andar nahi —
              wo har step par dikhni chahiye. Ye wahi galti hai jo sirf sun kar
              pakdi jaati hai (awaaz beech me kat gayi, ya scene ke ant me chuppi),
              aur us waqt tak reel bhej di ja chuki hoti hai.
            */}
            {progress.mismatch > 0 ? (
              <span className="text-amber">
                {" "}
                · {progress.mismatch} par awaaz aur lambai ka mel nahi
              </span>
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

        {/*
          Bani hui reel dobara kholte waqt jo batana zaroori hai — kya gaya, aur
          ye lagega kahan.

          ⚠️ Ye error se ALAG hai aur uske upar hai. Ye galti nahi batata; ye
          wo shart batata hai jispar aage ka poora kaam khada hai (purana render
          badla nahi jaayega, gayi hui awaaz dobara banegi). Use error ke rang me
          dikhane par aadmi use "kuch toot gaya" padh kar band kar deta hai.
        */}
        {request.note ? (
          <p className="rounded border border-amber/30 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
            {request.note}
          </p>
        ) : null}

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}

        {/*
          Poori reel par jo baat hai wo yahan — har step par dikhti hai.

          ⚠️ Scene-dar-scene wali baatein yahan JAAN-BOOJHKAR nahi hain; wo apne
          scene ke saath dikhti hain. Sab kuch ek jagah jama kar dene par "scene 4
          par awaaz bahut tez hai" padh kar aadmi ko scene 4 dhoondhna padta hai,
          aur wo aksar dhoondhta hi nahi.
        */}
        {advice.map((entry) => (
          <p
            key={entry.text}
            className={clsx(
              "flex items-start gap-1.5 rounded border px-2 py-1.5 text-[11px] leading-snug",
              entry.level === "warn"
                ? "border-amber/40 bg-amber/10 text-amber"
                : "border-ink-600 bg-ink-900 text-chalk-400",
            )}
          >
            {entry.level === "warn" ? (
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            ) : (
              <Info size={12} className="mt-0.5 shrink-0" />
            )}
            {entry.text}
          </p>
        ))}

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {step === 0 ? (
            <StepText
              draft={draft}
              onChange={update}
              onVoiceMade={update}
              onTextScale={setTextScale}
              onTextColor={setTextColor}
              onReplaceExisting={setReplaceExisting}
              onGap={setGap}
              onMove={move}
              onAdd={addScene}
            />
          ) : null}
          {step === 1 ? <StepImage draft={draft} onChange={update} /> : null}
          {step === 2 ? (
            <StepVoice
              draft={draft}
              onChange={update}
              onMusic={setMusic}
              onMusicVolume={setMusicVolume}
              onMusicTrim={setMusicTrim}
              onVoiceCategory={setVoiceCategory}
            />
          ) : null}
          {/*
            ⚠️ Dekho wale step ko bhi `update` milta hai, sirf `draft` nahi. Wo
            step ab dikhane ke saath **badalne** ka bhi hai — reel me kisi cheez
            par click karke uska naap, jagah, harkat aur us scene ki awaaz/music
            wahin se theek hoti hai. Sab kuch usi draft me jaata hai jisme baaki
            step likhte hain, isliye doc yahan bhi nahi chhua jaata.
          */}
          {step === 3 ? (
            <StepPreview draft={draft} onChange={update} onMusicVolume={setMusicVolume} />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
