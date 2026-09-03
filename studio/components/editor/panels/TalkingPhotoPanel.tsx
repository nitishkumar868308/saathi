"use client";

import {
  ANIMATION_PRESETS,
  DEFAULT_EMOTION,
  EFFECT_PRESETS,
  EMOTIONS,
  VOICE_CATEGORIES,
  buildVisemeTrack,
  plainAnimation,
  plainEffect,
  visemesFromText,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Check, Loader2, Mic } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { getAssetUrl } from "@/lib/assetUrls";
import { detectFace, type DetectedFace } from "@/lib/face/detect";
import { buildTalkingScene } from "@/lib/face/buildTalkingScene";
import { audioEnvelope } from "@/lib/face/envelope";
import { useEditorStore } from "@/lib/store";
import { generateVoice, VoiceError } from "@/lib/voiceGen";

/**
 * Bolti Tasveer — ek tasveer, ek text, aur ek chhota clip jisme wo bolti hai.
 *
 * ⚠️ Panel **chaar ginne hue kadam** me hai, ek dher me nahi. Wajah ye hai ki is
 * kaam me chaar bilkul alag cheezein chunni padti hain (tasveer, shabd, awaaz,
 * shakal), aur unhe ek saath saamne rakh dene par aadmi ko ye pata hi nahi chalta
 * ki shuru kahan se kare. Ginti dekh kar wo apne aap pehle par haath rakhta hai.
 *
 * ⚠️ Jo kadam abhi nahi ho sakta wo **halka dikhta hai, chhupta nahi**. Chhupi
 * hui cheez ko dhoondha nahi ja sakta — aadmi ko ye dikhna chahiye ki aage kya
 * aane wala hai, tabhi wo pehla kadam poora karne ki wajah samajhta hai.
 *
 * ⚠️ Har chunav ka **default pehle se bhara hua** hai, taaki koi kuch na chune to
 * bhi "Bana do" chale. Khaali dabbe dikha kar har cheez chunne par majboor karna
 * wahi galti hai jisse wizard bachta hai (`autoFill`).
 *
 * ⚠️ Har list **registry par map** hai — haath se likhi hui nahi. Nayi emotion ya
 * nayi harkat jodne par wo apne aap yahan dikhne lagti hai, aur ye file chhui bhi
 * nahi jaati.
 */

/** Awaaz ke bina bhi clip banta hai — par kam se kam itna lamba. */
const MIN_SECONDS = 2;

type FaceState =
  | { kind: "idle" }
  | { kind: "looking" }
  | { kind: "found"; detected: DetectedFace }
  | { kind: "none" }
  | { kind: "error"; message: string };

function Step({
  number,
  title,
  hint,
  done,
  disabled,
  children,
}: {
  number: number;
  title: string;
  hint: string;
  done?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("space-y-1.5 px-3 py-2.5", disabled && "opacity-45")}>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]",
            done ? "bg-emerald-500/25 text-emerald-300" : "bg-ink-700 text-chalk-500",
          )}
        >
          {done ? <Check size={9} /> : number}
        </span>
        <span className="text-[11px] text-chalk-100">{title}</span>
      </div>
      <p className="pl-6 text-[10px] leading-snug text-chalk-500">{hint}</p>
      <div className="space-y-1.5 pl-6">{children}</div>
    </section>
  );
}

/** Registry par map hone wala chunav — sab jagah ek jaisa dikhe. */
function Choice({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onPick(id: string): void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-chalk-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onPick(event.target.value)}
        className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-800 px-1.5 py-1 text-[11px] text-chalk-100"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TalkingPhotoPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  /* ---------------------------------------------------------- 1. tasveer */
  const [assetId, setAssetId] = useState<string | null>(null);
  const [face, setFace] = useState<FaceState>({ kind: "idle" });

  /* ------------------------------------------------------------- 2. text */
  const [text, setText] = useState("");

  /* ------------------------------------------------------------ 3. awaaz */
  const [voiceCategoryId, setVoiceCategoryId] = useState(VOICE_CATEGORIES[0]?.id ?? "");
  const [emotionId, setEmotionId] = useState(DEFAULT_EMOTION);

  /* ----------------------------------------------------------- 4. shakal */
  const [animationId, setAnimationId] = useState(ANIMATION_PRESETS[0]?.id ?? "");
  const [effectId, setEffectId] = useState("");
  const [showText, setShowText] = useState(true);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /*
   * Tasveer chunte hi chehra dhoondho.
   *
   * ⚠️ Ye asset ke `meta` me jama **nahi** hota, jabki wo behtar hota. Uske liye
   * assets wale PATCH route me ek naya khaana jodna padta, aur is poore kaam ka
   * niyam hai ki jo chal raha hai use chhua na jaaye. Model pehli baar ke baad
   * browser me cached rehta hai, isliye dobara dhoondhna ek-do second ka kaam hai.
   */
  useEffect(() => {
    if (!assetId) {
      setFace({ kind: "idle" });
      return;
    }

    let alive = true;
    setFace({ kind: "looking" });

    void (async () => {
      try {
        const detected = await detectFace(assetId);
        if (!alive) return;
        setFace(detected ? { kind: "found", detected } : { kind: "none" });
      } catch (cause) {
        if (!alive) return;
        setFace({ kind: "error", message: cause instanceof Error ? cause.message : String(cause) });
      }
    })();

    return () => {
      alive = false;
    };
  }, [assetId]);

  const build = useCallback(async () => {
    if (face.kind !== "found" || !assetId || !text.trim()) return;

    setBusy("Awaaz ban rahi hai…");
    setError(null);
    setWarning(null);
    setDone(null);

    try {
      /* ------------------------------------------------------- 1. awaaz */
      const voice = await generateVoice({ text: text.trim(), categoryId: voiceCategoryId });

      /* ---------------------------------------------------- 2. envelope */
      setBusy("Awaaz naapi ja rahi hai…");
      const voiceUrl = await getAssetUrl(voice.assetId);
      const envelope = await audioEnvelope(voiceUrl);

      /*
       * ⚠️ Envelope na mile to kaam rukta nahi — track poori lambai ko bolna maan
       * kar ban jaata hai. Par ye baat **dikhti hai**, chup-chaap nahi hoti: us
       * halat me muh saans wale sannate me bhi chalta rehta hai, aur agar wo
       * chup-chaap ho to aadmi ko sirf itna dikhta hai ki "lip sync kharab hai"
       * — bina ye jaane ki wajah kya thi aur wo theek ho bhi sakti hai.
       */
      if (!envelope) {
        setWarning(
          "Awaaz naapi nahi ja saki, isliye muh poori lambai me chalta rahega — " +
            "saans wale hisson me bhi. Dobara 'Bana do' dabane par aksar theek ho jaata hai.",
        );
      }
      const durationSeconds = Math.max(
        MIN_SECONDS,
        envelope?.durationSeconds ?? voice.seconds ?? MIN_SECONDS,
      );

      const track = buildVisemeTrack({
        steps: visemesFromText(text.trim()),
        envelope: envelope?.values ?? [],
        durationSeconds,
      });

      /* -------------------------------------------------------- 3. doc */
      setBusy("Scene ban raha hai…");
      const next = buildTalkingScene({
        doc,
        imageAssetId: assetId,
        voiceAssetId: voice.assetId,
        face: face.detected.face,
        sourceSize: face.detected.size,
        track,
        emotionId,
        durationSeconds,
        animationId,
        effectId,
        showText,
        text,
      });

      /*
       * ⚠️ Poora scene **ek hi** `applyOp` me. Alag-alag ops karne par Ctrl+Z ek
       * baar me sirf ek tukda hatata hai, aur aadmi ko aadha bana hua scene wapas
       * karne ke liye chhe-saat baar dabana padta — wahi wajah jo wizard ki hai.
       */
      applyOp("replaceDoc", { doc: next }, { label: "Bolti tasveer" });
      setDone("Ban gayi. Ctrl+Z se poora wapas ho sakta hai.");
    } catch (cause) {
      const message =
        cause instanceof VoiceError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : String(cause);
      setError(message);
    } finally {
      setBusy(null);
    }
  }, [face, assetId, text, voiceCategoryId, emotionId, animationId, effectId, showText, doc, applyOp]);

  const hasFace = face.kind === "found";
  const hasText = text.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0 border-b border-ink-600 px-3 py-2">
        <p className="text-[11px] text-chalk-300">Bolti Tasveer</p>
        <p className="mt-0.5 text-[10px] leading-snug text-chalk-500">
          Ek tasveer daalo, likho kya bolna hai — chehre ka muh us awaaz ke saath chalega.
        </p>
      </div>

      <div className="divide-y divide-ink-800">
        <Step
          number={1}
          title="Tasveer chuno"
          hint="Saamne dekhta hua ek chehra. Bina chehre wali tasveer bol nahi sakti."
          done={hasFace}
        >
          <AssetPickerButton
            kind="image"
            assetId={assetId}
            onPick={(id) => setAssetId(id)}
            allowUpload
            uploadTags={["talking-photo"]}
          />

          {face.kind === "looking" ? (
            <p className="flex items-center gap-1.5 text-[10px] text-chalk-500">
              <Loader2 size={10} className="animate-spin" /> Chehra dhoondha ja raha hai…
            </p>
          ) : null}
          {face.kind === "found" ? (
            <p className="text-[10px] text-emerald-300">
              Chehra mil gaya — {face.detected.size.width}×{face.detected.size.height}
            </p>
          ) : null}
          {/*
            ⚠️ Chehra na milne par saaf mana, andaaza lagakar kuch bana dena nahi.
            Bina chehre ke mesh ek hilta hua dhabba ban jaata hai, aur uski wajah
            kisi ko samajh nahi aati.
          */}
          {face.kind === "none" ? (
            <p className="flex items-start gap-1.5 text-[10px] leading-snug text-amber">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              Is tasveer me chehra nahi mila. Saamne se li hui, saaf roshni wali tasveer chuno —
              bahut side se ya bahut door se li hui tasveer par ye kaam nahi karta.
            </p>
          ) : null}
          {face.kind === "error" ? (
            <p className="text-[10px] leading-snug text-red-300">{face.message}</p>
          ) : null}
        </Step>

        <Step
          number={2}
          title="Kya bolna hai"
          hint="Jo likhoge wahi bola jaayega — aur muh ke shape bhi isi se bante hain."
          done={hasText}
          disabled={!hasFace}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={!hasFace}
            rows={4}
            placeholder="Namaste! Aaj main aapko ek zaroori baat bataunga…"
            className="w-full resize-y rounded border border-ink-600 bg-ink-800 px-2 py-1.5 text-[11px] text-chalk-100 placeholder:text-chalk-600"
          />
        </Step>

        <Step
          number={3}
          title="Kaise bolna hai"
          hint="Awaaz kis tarah ki ho, aur chehre par kaisa bhaav rahe."
          done={hasText}
          disabled={!hasText}
        >
          <Choice
            label="Awaaz"
            value={voiceCategoryId}
            options={VOICE_CATEGORIES}
            onPick={setVoiceCategoryId}
            disabled={!hasText}
          />
          <Choice
            label="Bhaav"
            value={emotionId}
            options={EMOTIONS}
            onPick={setEmotionId}
            disabled={!hasText}
          />
        </Step>

        <Step
          number={4}
          title="Kaisa dikhna hai"
          hint="Harkat aur rang — dono chhod bhi sakte ho, default pehle se laga hai."
          disabled={!hasText}
        >
          <Choice
            label="Harkat"
            value={animationId}
            options={ANIMATION_PRESETS.map((preset) => ({
              id: preset.id,
              label: plainAnimation(preset.id)?.label ?? preset.id,
            }))}
            onPick={setAnimationId}
            disabled={!hasText}
          />
          <Choice
            label="Rang"
            value={effectId}
            options={[
              { id: "", label: "Koi nahi" },
              ...EFFECT_PRESETS.map((preset) => ({
                id: preset.id,
                label: plainEffect(preset.id)?.label ?? preset.id,
              })),
            ]}
            onPick={setEffectId}
            disabled={!hasText}
          />
          <label className="flex items-center gap-2 text-[10px] text-chalk-400">
            <input
              type="checkbox"
              checked={showText}
              disabled={!hasText}
              onChange={(event) => setShowText(event.target.checked)}
            />
            Text screen par bhi dikhe
          </label>
        </Step>
      </div>

      <div className="space-y-1.5 border-t border-ink-600 px-3 py-2.5">
        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[10px] leading-snug text-red-300">
            {error}
          </p>
        ) : null}
        {warning ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[10px] leading-snug text-amber">
            {warning}
          </p>
        ) : null}
        {done ? (
          <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[10px] text-emerald-300">
            {done}
          </p>
        ) : null}

        <Button
          className="w-full justify-center py-1.5 text-[11px]"
          icon={busy ? <Loader2 size={11} className="animate-spin" /> : <Mic size={11} />}
          disabled={!hasFace || !hasText || busy !== null}
          onClick={() => void build()}
        >
          {busy ?? "Bana do"}
        </Button>
      </div>
    </div>
  );
}
