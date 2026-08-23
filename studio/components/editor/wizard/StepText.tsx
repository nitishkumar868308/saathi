"use client";

import {
  getSceneType,
  sceneAdvice,
  sceneSeconds,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Eye, EyeOff, Info, RotateCcw, Trash2 } from "lucide-react";

/**
 * Step 1 — **Shabd** (26.5).
 *
 * ⚠️ Ye step pehla hai, aur wo tarteeb ek bug rokti hai. TTS ka cache text ke
 * hash par hai: awaaz ban jaane ke baad text badla to bani hui awaaz **purane
 * shabdon ki** reh jaati hai. Wo galti kahin dikhti nahi — reel banti hai,
 * chalti hai, export bhi ho jaati hai; bas awaaz kuch aur bolti hai aur caption
 * kuch aur. Shabd pehle rakhne se wo halat ban hi nahi sakti.
 *
 * (Aadmi phir bhi peeche aakar badal sakta hai — us par step 3 me laal nishaan
 * lagta hai, dekho `voiceStale`.)
 */
/**
 * Text ka size — poori reel ke liye ek.
 *
 * WARNING: Naam number nahi hai. "1.15" kisi ko kuch nahi batata; "Bada" batata
 * hai. Aur ye chunav yahin hai, Shabd wale step me — kyunki text yahi likha ja
 * raha hai, aur uska size wahi dekh kar tay hota hai.
 */
const TEXT_PLACES = [
  { id: "top", label: "Upar" },
  { id: "center", label: "Beech" },
  { id: "bottom", label: "Neeche" },
] as const;

/**
 * Text ke rang — **ginti ke, poori palette nahi**.
 *
 * WARNING: Yahan color picker jaan-boojhkar nahi hai. Poori palette dene par log
 * wo rang chun lete hain jo kaale par padhe hi nahi jaate (gehra neela, laal) ya
 * jo brand se bilkul alag khade dikhte hain. Ye chaar rang brand ke hi hain aur
 * chaaron gehre background par saaf padhe jaate hain.
 *
 * WARNING: Pehla chunav `null` hai, koi hex nahi — aur wo farak asli hai. `null`
 * rehne par item me `brand.text` likha rehta hai, yaani brand badalte hi reel ka
 * text uske saath badal jaata hai. Hex likh dene par wo naata toot jaata hai aur
 * reel hamesha ke liye usi rang me jam jaati hai.
 */
const TEXT_COLORS = [
  { value: null, label: "Brand", swatch: "#FFF9F0", when: "Brand badle to reel bhi badle" },
  { value: "#FFFFFF", label: "Safed", swatch: "#FFFFFF", when: "Sabse saaf — gehri tasveer par" },
  { value: "#E0A458", label: "Sunehra", swatch: "#E0A458", when: "Zor dene wali line par" },
  { value: "#1A1714", label: "Kaala", swatch: "#1A1714", when: "Halki, chamakdaar tasveer par" },
] as const;

const TEXT_SIZES = [
  { scale: 0.8, label: "Chhota", when: "Lambi line, ya jab tasveer hi asli baat ho" },
  { scale: 1, label: "Normal", when: "Aam reel ke liye" },
  { scale: 1.25, label: "Bada", when: "Chhoti punchy line — phone par door se bhi padhi jaaye" },
] as const;

export function StepText({
  draft,
  onChange,
  onTextScale,
  onTextColor,
  onReplaceExisting,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
  onTextScale(scale: number): void;
  onTextColor(color: string | null): void;
  onReplaceExisting(value: boolean): void;
}) {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const removed = draft.scenes.filter((scene) => scene.removed);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <span className="text-[10px] text-chalk-500">Text ka size:</span>
        {TEXT_SIZES.map((entry) => (
          <button
            key={entry.label}
            type="button"
            title={entry.when}
            onClick={() => onTextScale(entry.scale)}
            className={clsx(
              "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              Math.abs(draft.textScale - entry.scale) < 0.01
                ? "border-terracotta bg-terracotta/10 text-chalk-100"
                : "border-ink-600 text-chalk-400 hover:border-chalk-500",
            )}
          >
            {entry.label}
            {entry.scale === 1 ? (
              <span className="ml-1 rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
                Sifaarish
              </span>
            ) : null}
          </button>
        ))}
        <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
          Poori reel ke liye ek hi — har scene ka alag size reel ko judi hui dikha deta hai.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <span className="text-[10px] text-chalk-500">Text ka rang:</span>
        {TEXT_COLORS.map((entry) => (
          <button
            key={entry.label}
            type="button"
            title={entry.when}
            onClick={() => onTextColor(entry.value)}
            className={clsx(
              "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              draft.textColor === entry.value
                ? "border-terracotta bg-terracotta/10 text-chalk-100"
                : "border-ink-600 text-chalk-400 hover:border-chalk-500",
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-ink-500"
              style={{ background: entry.swatch }}
            />
            {entry.label}
          </button>
        ))}
        <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
          CTA ka button apne rang me hi rahega — terracotta par ye rang padhe nahi jaate.
        </span>
      </div>

      {/*
        ⚠️ Ye chunav pehle step par hai, aakhir me nahi — aur wo jaan-boojhkar
        hai. "Sab mita do" jaisa faisla shuru me lena chahiye, jab aadmi ne abhi
        kuch banaya nahi. Aakhir me poochhne par wo "Editor me daalo" ke bagal me
        baithta hai, jahan aadmi jaldi me hota hai aur bina padhe daba deta hai.
      */}
      <label
        className={clsx(
          "flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5",
          draft.replaceExisting ? "border-amber/50 bg-amber/10" : "border-ink-600 bg-ink-900",
        )}
      >
        <input
          type="checkbox"
          checked={draft.replaceExisting}
          onChange={(event) => onReplaceExisting(event.target.checked)}
          className="mt-0.5 accent-terracotta"
        />
        <span className="min-w-0 text-[11px] leading-snug text-chalk-400">
          <span className="text-chalk-100">Purane scene hata do</span> — project me jo pehle se
          hai wo mit jaayega aur sirf ye nayi reel bachegi.
          {draft.replaceExisting ? null : (
            <span className="block text-chalk-500">
              Abhi ye naye scene purane ke aage jud rahe hain.
            </span>
          )}
        </span>
      </label>

      {draft.summary ? (
        <p className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-chalk-400">
          {draft.summary}
        </p>
      ) : null}

      {live.map((scene, at) => (
        <div key={scene.index} className="rounded border border-ink-600 bg-ink-900 p-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">
              Scene {at + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-chalk-500">
              {getSceneType(scene.type)?.label ?? scene.type} · {sceneSeconds(scene).toFixed(1)}s
              {scene.voiceAssetId ? " (awaaz jitna)" : ""}
            </span>
            <button
              type="button"
              onClick={() => onChange(scene.index, { removed: true })}
              title="Ye scene hata do"
              className="shrink-0 rounded p-1 text-chalk-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={11} />
            </button>
          </div>

          <textarea
            value={scene.text}
            onChange={(event) => onChange(scene.index, { text: event.target.value })}
            rows={2}
            placeholder="Is scene par kya likha/bola jaayega"
            className="w-full resize-y rounded border border-ink-600 bg-ink-950 px-2 py-1.5 text-xs text-chalk-100 outline-none focus:border-terracotta"
          />

          {/*
            Text kahan baithe — per scene, kyunki ye tasveer par nirbhar hai.
            Chehra beech me ho to beech wala text usi par chadh jaata hai.
          */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-chalk-500">Text:</span>
            {TEXT_PLACES.map((place) => (
              <button
                key={place.id}
                type="button"
                disabled={scene.hideText}
                onClick={() => onChange(scene.index, { textPosition: place.id })}
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-30",
                  scene.textPosition === place.id
                    ? "border-terracotta bg-terracotta/10 text-chalk-100"
                    : "border-ink-600 text-chalk-400 hover:border-chalk-500",
                )}
              >
                {place.label}
              </button>
            ))}

            {/*
              ⚠️ "Text mat dikhao" ka matlab "text mita do" NAHI hai — likha hua
              text yahin rehta hai, aur usi se awaaz banti hai. Do alag kaam hain:
              screen par kya dikhe, aur kaan me kya jaaye. Ise mitane wale button
              ke saath rakhne par log kahani ka wo hissa hi kho dete jise wo sirf
              chhupana chahte the.
            */}
            <button
              type="button"
              onClick={() => onChange(scene.index, { hideText: !scene.hideText })}
              title={
                scene.hideText
                  ? "Screen par text wapas dikhao"
                  : "Screen par text mat dikhao — bola phir bhi jaayega"
              }
              className={clsx(
                "ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                scene.hideText
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {scene.hideText ? <EyeOff size={9} /> : <Eye size={9} />}
              {scene.hideText ? "Chhupa hua" : "Dikhega"}
            </button>
          </div>

          {/*
            ⚠️ CTA ka button — sirf CTA wale scene par.

            Ye alag khaana isliye hai ki CTA ka poora kaam ek hi hai: batana ki ab
            karna kya hai. Wo baat aksar AI ki likhi lambi line me dab jaati hai
            ("Apka Saathi - aapka digital document manager. Abhi download
            karein."). Button us baat ko line se alag kar deta hai.

            Khaali chhodne par "Abhi download karein" lagta hai — default khaali
            rakhne par button kabhi bharaa hi nahi jaata aur CTA wapas ek paragraph
            ban jaata hai.
          */}
          {scene.type === "cta" ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="shrink-0 text-[10px] text-chalk-500">Button:</span>
              <input
                value={scene.slots.button ?? ""}
                onChange={(event) =>
                  onChange(scene.index, {
                    slots: { ...scene.slots, button: event.target.value },
                  })
                }
                placeholder="Abhi download karein"
                className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-950 px-2 py-1 text-[11px] text-chalk-100 outline-none focus:border-terracotta"
              />
            </div>
          ) : null}

          {/*
            Chhupane ka chunav tabhi kaam karta hai jab scene me tasveer ho —
            warna scene me kuch bachta hi nahi. Ye baat yahin likhi hai, us jagah
            jahan chunav kiya jaata hai, na ki baad me ek chetavni me.
          */}
          {scene.hideText && !scene.visualAssetId ? (
            <p className="mt-1 text-[10px] leading-snug text-chalk-500">
              Is scene par abhi tasveer nahi hai — is liye text phir bhi dikhega. Agle step me
              tasveer daalo, tab ye chunav lag jaayega.
            </p>
          ) : null}

          {sceneAdvice(scene, at).map((entry) => (
            <p
              key={entry.text}
              className={clsx(
                "mt-1 flex items-start gap-1 text-[10px] leading-snug",
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
      ))}

      {live.length === 0 ? (
        <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          Saare scene hata diye. Kam se kam ek chahiye — neeche se koi wapas le aao.
        </p>
      ) : null}

      {/*
        ⚠️ Hataye hue scene chhupte nahi, ek line me neeche pade rehte hain.
        Poori tarah gayab kar dene par galti se hata dena wapas nahi laaya ja
        sakta, aur aadmi ko poora wizard dobara chalana padta — sirf ek galat
        click ki wajah se.
      */}
      {removed.length > 0 ? (
        <div className="rounded border border-dashed border-ink-600 p-2">
          <p className="mb-1 text-[10px] text-chalk-500">Hataye hue ({removed.length})</p>
          {removed.map((scene) => (
            <div key={scene.index} className="flex items-center gap-2 py-0.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500 line-through">
                {scene.text || getSceneType(scene.type)?.label || scene.type}
              </span>
              <button
                type="button"
                onClick={() => onChange(scene.index, { removed: false })}
                className="flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-300 transition-colors hover:border-chalk-500"
              >
                <RotateCcw size={9} />
                wapas
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
