"use client";

import {
  canMoveScene,
  estimateSpeechSeconds,
  getSceneType,
  sceneAdvice,
  sceneSeconds,
  usableVoiceSeconds,
  voiceStaleReason,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Megaphone,
  Mic,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { generateVoice } from "@/lib/voiceGen";

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
 *
 * ⚠️ Scene ki tarteeb (upar-neeche, jodna) bhi yahin hai, aur wo jaan-boojhkar
 * hai: kahani ka kram shabdon ka sawaal hai, tasveer ka nahi. Tasveer wale step
 * par ise rakhne par aadmi pehle aath tasveerein daalta hai aur uske baad
 * samajhta hai ki scene 3 ko scene 5 ke baad hona chahiye tha — aur tab tak
 * tasveerein us kram me chun li ja chuki hoti hain.
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
 * Text ke rang — **ginti ke, aur ek apna**.
 *
 * WARNING: Ye chaar rang brand ke hi hain aur chaaron gehre background par saaf
 * padhe jaate hain. Inke baad "apna rang" ka khaana hai — wo aadmi ke maangne par
 * joda gaya, aur uske saath ek chetavni bhi rehti hai: apna rang chunne par uska
 * padha jaana aadmi ki zimmedari hai (gehra neela kaale par gayab ho jaata hai).
 *
 * WARNING: Pehla chunav `null` hai, koi hex nahi — aur ye farak asli hai. `null`
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

/**
 * Scene ke beech ki saans.
 *
 * ⚠️ Ye khaali (kaala) waqt nahi hai — us scene ki tasveer utni der aur thehri
 * rehti hai (dekho `gapSeconds` ka comment). Default 0 hai: reels ki chaal tez
 * hoti hai, aur har scene ke baad aadha second 8 scene par 3.5 second bekaar ka
 * jod deta hai.
 */
const GAPS = [
  { seconds: 0, label: "Bilkul nahi", when: "Tez reel — ek scene khatam, doosra shuru" },
  { seconds: 0.2, label: "Zara si", when: "Aam reel — kaatna jhatka nahi lagta" },
  { seconds: 0.4, label: "Thodi", when: "Bhaari baat — sunne wale ko sochne ka waqt" },
  { seconds: 0.8, label: "Lambi", when: "Sirf jab har line par rukna zaroori ho" },
] as const;

/**
 * Ek scene ki lambai ka khaana.
 *
 * ⚠️ Iska apna text state hai, aur wo zaroori hai. Seedha `number` par bandhne
 * par "4" mita kar "12" likhna namumkin ho jaata hai: khaali khaana `NaN` deta
 * hai, jo turant `1.2` (sabse chhoti hadd) par gir jaata hai — aur aadmi ki
 * ungli ke neeche number badalta rehta hai.
 *
 * ⚠️ "Apne aap" ek alag halat hai, koi number nahi. Uspar khaana **band** rehta
 * hai aur usme wahi ginti dikhti hai jo lagegi, taaki aadmi ko pata ho ki apne
 * aap ka matlab kya hai — khaali khaana dikhane par wo har baar khud hisaab
 * lagata (aur galat lagata).
 */
function DurationField({
  scene,
  onChange,
}: {
  scene: WizardScene;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const auto = scene.durationOverrideSeconds === null;
  const shown = sceneSeconds(scene);
  const [text, setText] = useState<string | null>(null);

  function commit(raw: string): void {
    const value = Number.parseFloat(raw);
    setText(null);
    if (!Number.isFinite(value)) return;
    onChange(scene.index, { durationOverrideSeconds: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-chalk-500">Lambai:</span>

      <input
        type="number"
        step={0.5}
        min={1.2}
        max={30}
        disabled={auto}
        value={text ?? (auto ? shown.toFixed(1) : String(scene.durationOverrideSeconds))}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit((event.target as HTMLInputElement).value);
        }}
        className="w-16 rounded border border-ink-600 bg-ink-950 px-1.5 py-0.5 text-right text-[11px] text-chalk-100 outline-none focus:border-terracotta disabled:opacity-50"
      />
      <span className="text-[10px] text-chalk-500">s</span>

      {auto ? (
        <button
          type="button"
          onClick={() => onChange(scene.index, { durationOverrideSeconds: Number(shown.toFixed(1)) })}
          title="Lambai khud tay karo — reel lambi ho rahi ho to yahi kaam aata hai"
          className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-terracotta hover:text-chalk-100"
        >
          Haath se tay karo
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onChange(scene.index, { durationOverrideSeconds: null })}
          title="Wapas apne aap par — awaaz jitni lambi, wahi scene ki lambai"
          className="flex items-center gap-1 rounded border border-terracotta bg-terracotta/10 px-1.5 py-0.5 text-[10px] text-chalk-100"
        >
          <RotateCcw size={9} />
          apne aap par wapas
        </button>
      )}

      <span className="min-w-0 flex-1 truncate text-right text-[10px] text-chalk-500">
        {/*
          ⚠️ "Awaaz jitni" tabhi likha jaata hai jab awaaz sach me is text ki ho.
          Purane shabdon wali file par ye line jhooth bolti thi: lambai us purani
          awaaz ki dikhti thi aur likha hota tha ki wo abhi wali awaaz jitni hai.
        */}
        {auto
          ? usableVoiceSeconds(scene) !== null
            ? "apne aap — awaaz jitni"
            : scene.voiceAssetId
              ? "apne aap — abhi andaaze se (awaaz purani hai)"
              : "apne aap — likhe hue ke andaaze se"
          : "tumhara chuna hua"}
      </span>
    </div>
  );
}

/**
 * Text badalne ke baad awaaz ko **yahin** theek karne ka raasta (26.25).
 *
 * ⚠️ Ye patti is poore step ka sabse zaroori hissa hai, aur wo ek asli shikayat
 * se aayi: "awaaz banane ke baad text badalta hoon to kuch hota hi nahi." Baat
 * sach thi. Text badal jaata tha, par uska koi nateeja is step par dikhta hi nahi
 * tha — upar "Awaaz 5.2s ki hai (naapi hui)" waise ka waisa likha rehta tha
 * (jabki wo 5.2s ab kisi aur text ka tha), scene ki lambai bhi wahin jami rehti
 * thi, aur awaaz dobara banane ka koi button yahan tha hi nahi. Theek karne ke
 * liye do step aage jaakar us qatar ko dhoondhna padta tha — aur aadmi aksar
 * dhoondhta hi nahi.
 *
 * Ab teen cheezein ek saath hoti hain: naapi hui lambai **girti hai** (upar wala
 * `usableVoiceSeconds`), scene naye shabdon ke andaaze par aa jaata hai, aur
 * dobara banane ka button theek us line ke neeche hota hai jise abhi badla gaya.
 *
 * ⚠️ Awaaz ka chunav (`draft.voiceCategoryId`) na ho to button dikhta hi nahi —
 * uski jagah raasta likha hota hai. Bina chunav ke wo call 400 deti, aur ek button
 * jo dabane par kabhi kaam na kare, toote hue button jaisa hi hai (README rule 5).
 */
function StaleVoiceFix({
  scene,
  categoryId,
  onVoiceMade,
}: {
  scene: WizardScene;
  categoryId: string | null;
  onVoiceMade(index: number, patch: Partial<WizardScene>): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remake(): Promise<void> {
    if (!categoryId || !scene.text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const made = await generateVoice({ text: scene.text, categoryId });
      onVoiceMade(scene.index, {
        voiceAssetId: made.assetId,
        voiceForText: scene.text,
        voiceCategoryId: categoryId,
        voiceSeconds: made.seconds,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 space-y-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1">
      <p className="flex items-start gap-1 text-[10px] leading-snug text-amber">
        <AlertTriangle size={10} className="mt-0.5 shrink-0" />
        Is scene ki awaaz purane shabdon ki hai. Jab tak dobara nahi banti, reel me awaaz kuch
        aur bolegi aur screen par kuch aur likha hoga — aur scene ki lambai bhi abhi andaaze par
        chal rahi hai.
      </p>

      {categoryId ? (
        <button
          type="button"
          onClick={() => void remake()}
          disabled={busy || !scene.text.trim()}
          className="flex items-center gap-1 rounded border border-amber/50 px-1.5 py-0.5 text-[10px] text-amber transition-colors hover:bg-amber/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={9} className="animate-spin" /> : <Mic size={9} />}
          {busy ? "Ban rahi hai…" : "Awaaz dobara banao"}
        </button>
      ) : (
        <p className="text-[10px] text-amber/80">
          Awaaz wale step par jaakar ek awaaz chuno — uske baad ye yahin se dobara ban jaayegi.
        </p>
      )}

      {error ? <p className="text-[10px] leading-snug text-red-300">{error}</p> : null}
    </div>
  );
}

export function StepText({
  draft,
  onChange,
  onVoiceMade,
  onTextScale,
  onTextColor,
  onReplaceExisting,
  onGap,
  onMove,
  onAdd,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
  /**
   * Awaaz yahin se dobara ban jaaye to uska nateeja draft me likhne ke liye.
   *
   * ⚠️ Ye `onChange` se alag naam par isliye hai ki call site par saaf dikhe ki
   * ye ek **asset ban jaane** ka nateeja hai, kisi input ka nahi. Kaam dono ka
   * ek hi hai, par padhne wale ke liye wo farak hi sab kuch hai.
   */
  onVoiceMade(index: number, patch: Partial<WizardScene>): void;
  onTextScale(scale: number): void;
  onTextColor(color: string | null): void;
  onReplaceExisting(value: boolean): void;
  onGap(seconds: number): void;
  onMove(index: number, delta: -1 | 1): void;
  /** `null` = sabse aakhir me jodo. */
  onAdd(afterIndex: number | null): void;
}) {
  const live = draft.scenes.filter((scene) => !scene.removed);
  const removed = draft.scenes.filter((scene) => scene.removed);

  /*
   * "Sab par text chhupa do" ek button hai, ek naya field nahi.
   *
   * ⚠️ Draft me `hideAllText` rakhna aasan lagta tha aur galat hota: phir do
   * jagah sach hota (poore draft ka aur har scene ka), aur ek scene par text wapas
   * dikhate hi wo dono ek doosre se ulat jaate. Yahan button sirf har scene ka
   * apna chunav badal deta hai — sach ek hi jagah rehta hai.
   */
  const allHidden = live.length > 0 && live.every((scene) => scene.hideText);

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

        {/*
          ⚠️ "Sab par chhupa do" yahin hai, text ke chunav ke saath — har scene par
          ek-ek karke chhupana wo kaam hai jise aadmi teesre scene par chhod deta
          hai, aur aadhi reel par text laga reh jaata hai.
        */}
        <button
          type="button"
          onClick={() => {
            for (const scene of live) onChange(scene.index, { hideText: !allHidden });
          }}
          title={
            allHidden
              ? "Sab scene par text wapas dikhao"
              : "Kisi bhi scene par text mat dikhao — bola phir bhi jaayega"
          }
          className={clsx(
            "ml-auto flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
            allHidden
              ? "border-terracotta bg-terracotta/10 text-chalk-100"
              : "border-ink-600 text-chalk-400 hover:border-chalk-500",
          )}
        >
          {allHidden ? <Eye size={9} /> : <EyeOff size={9} />}
          {allHidden ? "Sab par text wapas" : "Sab par text chhupa do"}
        </button>
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

        {/*
          Apna rang — aadmi ke maangne par.

          ⚠️ `<input type="color">` ka `onChange` **kheenchte waqt** har hilne par
          chalta hai. Isse seedha draft me likhne par ek hi ghaseetne me 40-50
          badlav jate hain, aur uske saath poora preview dobara banta hai. Isliye
          yahan `onBlur` par likha jaata hai — jab picker band hota hai.
        */}
        <label
          className={clsx(
            "flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
            draft.textColor && !TEXT_COLORS.some((entry) => entry.value === draft.textColor)
              ? "border-terracotta bg-terracotta/10 text-chalk-100"
              : "border-ink-600 text-chalk-400 hover:border-chalk-500",
          )}
          title="Apna rang chuno — dhyan rakho ki wo tasveer par padha jaaye"
        >
          <input
            type="color"
            value={draft.textColor ?? "#FFFFFF"}
            onBlur={(event) => onTextColor(event.target.value.toUpperCase())}
            className="h-3 w-3 cursor-pointer border-0 bg-transparent p-0"
          />
          Apna rang
        </label>

        <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
          CTA ka button apne rang me hi rahega — terracotta par ye rang padhe nahi jaate.
        </span>
      </div>

      {/*
        Scene ke beech ki saans — poori reel ke liye ek.

        ⚠️ Ye per-scene nahi hai, aur wo jaan-boojhkar hai: alag-alag gap reel ki
        chaal ko ladkhadaata hua bana dete hain, aur us kharabi ki wajah dekhne
        wale ko kabhi samajh nahi aati.
      */}
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <span className="text-[10px] text-chalk-500">Scene ke beech saans:</span>
        {GAPS.map((entry) => (
          <button
            key={entry.label}
            type="button"
            title={entry.when}
            onClick={() => onGap(entry.seconds)}
            className={clsx(
              "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              Math.abs(draft.gapSeconds - entry.seconds) < 0.01
                ? "border-terracotta bg-terracotta/10 text-chalk-100"
                : "border-ink-600 text-chalk-400 hover:border-chalk-500",
            )}
          >
            {entry.label}
            {entry.seconds === 0 ? (
              <span className="ml-1 rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
                Sifaarish
              </span>
            ) : null}
          </button>
        ))}
        <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
          Yahan khaali (kaala) waqt nahi aata — tasveer utni der aur thehri rehti hai.
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

      {live.map((scene, at) => {
        /*
         * ⚠️ `usableVoiceSeconds` — `voiceSeconds` nahi. Farak wahi hai jispar is
         * step ki poori shikayat khadi thi: text badalne ke baad purani file ki
         * naapi hui lambai dikhate rehna matlab screen par ek pakka number rakhna
         * jo ab kisi aur text ka hai.
         */
        const voice = usableVoiceSeconds(scene);
        const guess = estimateSpeechSeconds(scene.text, scene.voiceRate);
        const staleReason = voiceStaleReason(scene, draft);

        return (
          <div key={scene.index} className="rounded border border-ink-600 bg-ink-900 p-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">
                Scene {at + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-chalk-500">
                {getSceneType(scene.type)?.label ?? scene.type} · {sceneSeconds(scene).toFixed(1)}s
                {scene.durationOverrideSeconds !== null
                  ? " (haath se)"
                  : scene.voiceAssetId
                    ? " (awaaz jitna)"
                    : ""}
              </span>

              {/*
                ⚠️ Upar-neeche ke button yahan hain, drag-and-drop nahi. Drag phone
                par (aur is chhote dabbe me) theek se chalta hi nahi, aur uska koi
                nishaan nahi hota ki wo ho sakta hai. Do teer hamesha dikhte hain
                aur unka matlab poochhna nahi padta.
              */}
              <button
                type="button"
                disabled={!canMoveScene(draft, scene.index, -1)}
                onClick={() => onMove(scene.index, -1)}
                title="Ek kadam upar"
                className="shrink-0 rounded p-1 text-chalk-500 transition-colors hover:bg-ink-700 hover:text-chalk-100 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                disabled={!canMoveScene(draft, scene.index, 1)}
                onClick={() => onMove(scene.index, 1)}
                title="Ek kadam neeche"
                className="shrink-0 rounded p-1 text-chalk-500 transition-colors hover:bg-ink-700 hover:text-chalk-100 disabled:opacity-25 disabled:hover:bg-transparent"
              >
                <ArrowDown size={11} />
              </button>
              <button
                type="button"
                onClick={() => onAdd(scene.index)}
                title="Iske theek neeche naya scene jodo"
                className="shrink-0 rounded p-1 text-chalk-500 transition-colors hover:bg-ink-700 hover:text-chalk-100"
              >
                <Plus size={11} />
              </button>
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
              Bolne me kitna waqt lagega — **likhte hi** (26.24).

              ⚠️ Awaaz ban chuki ho to naapi hui lambai dikhti hai, andaaza nahi.
              Dono ek jaise dikhane par (dono "~" ke saath) aadmi ko pata hi nahi
              chalta ki kaunsa number pakka hai — aur wo pakka number hi scene ki
              lambai tay karta hai.
            */}
            {scene.text.trim() ? (
              <p className="mt-1 text-[10px] text-chalk-500">
                {voice !== null
                  ? `Awaaz ${voice.toFixed(1)}s ki hai (naapi hui)`
                  : `Bolne me ~${guess.toFixed(1)}s lagenge (andaaza)`}
                {" · "}
                {scene.text.trim().split(/\s+/).filter(Boolean).length} shabd
              </p>
            ) : null}

            <div className="mt-1 border-t border-ink-700 pt-1.5">
              <DurationField scene={scene} onChange={onChange} />
            </div>

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
              CTA ka chunav — **haath se banaye scene ke liye** (26.27).

              ⚠️ Ye button is liye aaya ki bina AI ke wizard kholne par har scene
              `text` ka banta hai, aur use CTA banane ka koi raasta hi nahi tha.
              Yaani jo aadmi khud reel banata tha, uski reel ka aakhri frame —
              wahi jispar "ab karna kya hai" likha hota hai — kabhi ban hi nahi
              paata tha. Wo hissa AI wali reel me tha aur haath wali me nahi, bina
              kisi wajah ke.

              ⚠️ Yahan poora scene-type ka picker **nahi** hai, aur ye soch kar
              hai. Baaki har type apne aap tay ho jaata hai — tasveer lagao to
              image wala, awaaz lagao to audio wala (`effectiveType`). CTA hi ek
              aisi cheez hai jise koi anumaan nahi laga sakta: wo aadmi ka iraada
              hai, uski file ka nateeja nahi. Bees types ki list dikhana un
              unnees ko bhi haath se chunwana hai jo pehle se sahi bant'te hain.
            */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChange(scene.index, { type: scene.type === "cta" ? "text" : "cta" })
                }
                title={
                  scene.type === "cta"
                    ? "Wapas aam scene bana do"
                    : "Ise reel ka aakhri call-to-action banao — logo, ek line, aur ek button"
                }
                className={clsx(
                  "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                  scene.type === "cta"
                    ? "border-terracotta text-terracotta"
                    : "border-ink-600 text-chalk-400 hover:border-chalk-500",
                )}
              >
                <Megaphone size={9} />
                {scene.type === "cta" ? "CTA scene hai" : "CTA banao"}
              </button>
              {scene.type === "cta" ? (
                <span className="text-[10px] text-chalk-500">
                  Logo project ke brand se apne aap lagta hai.
                </span>
              ) : null}
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
              Awaaz purani ho gayi — theek karne ka raasta yahin, us line ke neeche
              jise abhi badla gaya hai.
            */}
            {staleReason !== null ? (
              <StaleVoiceFix
                scene={scene}
                categoryId={draft.voiceCategoryId}
                onVoiceMade={onVoiceMade}
              />
            ) : null}

            {/*
              ⚠️ Stale wali chetavni yahan se hata di jaati hai — wo upar apni
              poori patti me hai, dobara banane ke button ke saath. Do jagah ek hi
              baat likhne par dono ki keemat aadhi ho jaati hai.
            */}
            {sceneAdvice(scene, at, draft)
              .filter(
                (entry) =>
                  !entry.text.startsWith("Awaaz banne ke baad") &&
                  !entry.text.startsWith("Ye awaaz us chunav"),
              )
              .map((entry) => (
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
        );
      })}

      {/*
        ⚠️ Naya scene jodne ka button neeche bhi hai, sirf har qatar par nahi.
        Aakhir me ek scene jodna sabse aam kaam hai (CTA, ya ek line jo chhoot
        gayi), aur uske liye aakhri qatar ka chhota "+" dhoondhna padta tha.
      */}
      <button
        type="button"
        onClick={() => onAdd(null)}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-ink-600 px-2 py-2 text-[11px] text-chalk-400 transition-colors hover:border-terracotta hover:text-chalk-100"
      >
        <Plus size={11} />
        Naya scene jodo
      </button>

      {live.length === 0 ? (
        <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          Saare scene hata diye. Kam se kam ek chahiye — upar se naya jodo, ya neeche se koi
          wapas le aao.
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
