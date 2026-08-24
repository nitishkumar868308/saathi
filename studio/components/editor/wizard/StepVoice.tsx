"use client";

import {
  estimateSpeechSeconds,
  sceneAdvice,
  sceneSeconds,
  usableVoiceSeconds,
  voiceStale,
  voiceStaleReason,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Info, Loader2, Mic } from "lucide-react";
import { useEffect, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useAssetDurations } from "@/lib/assetMeta";
import { generateVoice } from "@/lib/voiceGen";

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
/**
 * Ek scene par awaaz kitni tez — **naam se, number se nahi**.
 *
 * ⚠️ "Chup" ek asli chunav hai, koi galti nahi. Kuch scene sirf dikhne ke liye
 * hote hain (b-roll, ek tasveer jispar music chalta hai), aur wahan bolne wala
 * ulta rukavat banta hai. Bina is chunav ke aadmi ko us scene ki awaaz **hatani**
 * padti thi — aur uske saath uska likha hua text bhi chala jaata tha.
 */
const VOICE_LEVELS = [
  { volume: 1, label: "Normal", when: "Aam line — jaisi bani hai" },
  { volume: 1.3, label: "Tez", when: "Zor dene wali line par (thoda oopar)" },
  { volume: 0.6, label: "Dheemi", when: "Peeche ki baat, ya jab tasveer hi asli baat ho" },
  { volume: 0, label: "Chup", when: "Is scene par kuch bola na jaaye — sirf music/tasveer" },
] as const;

/** Poori reel me music ka level. */
const MUSIC_LEVELS = [
  { volume: 0.08, label: "Bahut halka", when: "Sirf khaali jagah bharne ke liye" },
  { volume: 0.15, label: "Halka", when: "Bolne wale ke peeche — sabse surakshit" },
  { volume: 0.3, label: "Sunai dene layak", when: "Jab bolne wala kam ho" },
  { volume: 0.6, label: "Tez", when: "Sirf bina awaaz wali reel par" },
] as const;

/** Ek scene par music ka level — `null` = poori reel wala. */
const SCENE_MUSIC = [
  { volume: null, label: "Reel jaisa", when: "Jo poori reel me chal raha hai" },
  { volume: 0.05, label: "Bahut kam", when: "Zaroori baat boli ja rahi ho" },
  { volume: 0, label: "Band", when: "Is scene par music bilkul nahi" },
] as const;

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

/**
 * "Sab ki awaaz banao" me do call ke beech ka thehrav.
 *
 * ⚠️ Ye bina wajah ka intezaar nahi hai. Muft wali Gemini key par TTS ki hadd
 * kuch hi request per minute hai; saat request seedhe peeche-peeche bhejne par
 * beech wali 429 par gir jaati hai — aur wo ek scene reel ke beech se chup ho
 * jaata hai. Aadhe second ka thehrav saat scene par 3.5 second jodta hai, aur
 * uske badle wo galti nahi hoti jise theek karne ke liye poora batch dobara
 * chalana padta hai.
 */
const BETWEEN_CALLS_MS = 500;

function VoiceRow({
  scene,
  at,
  draft,
  categoryId,
  providerId,
  ttsUsable,
  hasMusic,
  onChange,
}: {
  scene: WizardScene;
  at: number;
  /** Poori reel ka awaaz wala chunav yahin se aata hai — us par nishaan lagta hai. */
  draft: WizardDraft;
  categoryId: string | null;
  /** Poori reel ke liye ek hi provider — har scene apna faisla na kare. */
  providerId: string | null;
  /** Koi provider chalne layak hai? Nahi to "Awaaz banao" dabna hi nahi chahiye. */
  ttsUsable: boolean;
  /** Reel par music laga hai? Nahi to per-scene music ka chunav dikhta hi nahi. */
  hasMusic: boolean;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Library / upload se chuni hui awaaz lagao — **uski lambai ke saath**.
   *
   * ⚠️ Sirf `secondsOf()` par bharosa nahi kiya ja sakta, aur ye chala kar dekhne
   * par nikla. Wo list ek module-level cache se aati hai; abhi-abhi chadhi hui
   * file usme hoti hi nahi. Cache girta hai aur nayi list **async** aati hai,
   * yaani is pal wo abhi purani hi hai — aur scene ki lambai chup-chaap AI ke
   * andaaze par reh jaati (aksar 4s), jabki awaaz 9s ki hoti.
   *
   * Isliye na mile to seedha us ek asset se poochh lo. Ek chhoti request, aur
   * uske badle wo galti jo sirf reel sun kar pakdi jaati hai.
   */
  async function pickVoice(assetId: string): Promise<void> {
    let seconds = secondsOf(assetId);
    if (seconds === null) {
      try {
        const response = await fetch(`/api/assets/${assetId}`);
        const json = (await response.json()) as { asset?: { durationMs?: number | null } };
        const ms = json.asset?.durationMs;
        if (ms) seconds = ms / 1000;
      } catch {
        // Na pata chale to `null` — uspar apni alag salaah pehle se likhi hai.
      }
    }
    onChange(scene.index, {
      voiceAssetId: assetId,
      voiceForText: scene.text,
      voiceSeconds: seconds,
      /*
       * ⚠️ `null` — aur ye jaan-boojhkar hai. Ye aadmi ki apni file hai; uspar
       * "ye us chunav ki nahi hai jo abhi laga hai" wala nishaan lagana jhooth
       * hoga, kyunki uska koi chunav tha hi nahi. Aur wo nishaan lagne ka matlab
       * hota ki "Sab ki awaaz banao" uski apni file ko chup-chaap TTS se badal
       * de — yaani wo file jo usne khud record ki thi.
       */
      voiceCategoryId: null,
    });
  }

  const staleReason = voiceStaleReason(scene, draft);
  const stale = staleReason !== null;
  /** Bani hui awaaz ki asli lambai — `null` = hai hi nahi, ya wo purane shabdon ki hai. */
  const measured = usableVoiceSeconds(scene);
  /*
   * `voiceStale` wali baat upar apni jagah alag se likhi hai (wo is step ki sabse
   * zaroori line hai), isliye yahan usse hata diya jaata hai — ek hi baat do
   * jagah likhi ho to dono ki keemat aadhi ho jaati hai.
   */
  const advice = sceneAdvice(scene, at, draft).filter(
    (entry) => !entry.text.startsWith("Awaaz banne") && !entry.text.startsWith("Ye awaaz us chunav"),
  );

  async function generate(): Promise<void> {
    if (!scene.text.trim() || !categoryId) return;
    setBusy(true);
    setError(null);
    try {
      const made = await generateVoice({ text: scene.text, categoryId, providerId });
      /*
       * ⚠️ `voiceForText` aur `voiceCategoryId` yahin likhe jaate hain — us text
       * aur us chunav ke saath jisse awaaz SACH ME bani. Baad me kahin se copy
       * karne par wo alag ho sakte hain, aur tab "awaaz purani hai" wala nishaan
       * jhootha ho jaata.
       */
      onChange(scene.index, {
        voiceAssetId: made.assetId,
        voiceForText: scene.text,
        voiceCategoryId: categoryId,
        // Lambai wahi jo abhi bani — scene ki lambai isi par bandhi hai.
        voiceSeconds: made.seconds,
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
        Ye line kitni lambi hai — **banane se pehle** (26.24).

        ⚠️ Awaaz banne se pehle yahan andaaza dikhta hai, uske baad naapi hui
        lambai. Dono ka farak saaf likha hai ("~" aur "naapi hui"), kyunki wahi
        farak scene ki lambai tay karta hai: naapi hui lambai par scene bandhta
        hai, andaaze par nahi.

        ⚠️ Iske bina aadmi ko ye ginti kahin milti hi nahi thi. Wo teen line likh
        deta tha, "Sab ki awaaz banao" dabata tha, aur 30 second ki soch kar banayi
        gayi reel 70 second ki nikalti thi — wo bhi tab, jab saari awaazein ban
        chuki hoti thi.
      */}
      <p className="mb-1 text-[10px] text-chalk-500">
        {measured !== null
          ? `Awaaz ${measured.toFixed(1)}s ki hai (naapi hui) · scene ${sceneSeconds(scene).toFixed(1)}s`
          : scene.text.trim()
            ? `Bolne me ~${estimateSpeechSeconds(scene.text, scene.voiceRate).toFixed(1)}s lagenge (andaaza) · scene abhi ${sceneSeconds(scene).toFixed(1)}s`
            : "Is scene par koi text nahi — bolne ko kuch nahi hai."}
      </p>

      {/*
        ⚠️ Ye chetavni is poore step ki sabse zaroori line hai. Text badalne ke
        baad bani hui awaaz purane shabdon ki reh jaati hai, aur us galti ka
        koi nishaan kahin nahi hota: reel banti hai, chalti hai, export bhi ho
        jaati hai — bas awaaz kuch aur bolti hai aur screen par kuch aur likha
        hota hai. Wo tab pata chalta hai jab reel bhej di ja chuki hoti hai.
      */}
      {staleReason === "text" ? (
        <p className="mb-1 flex items-start gap-1 text-[10px] leading-snug text-amber">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          Ye awaaz purane shabdon ki hai — text badal chuka hai. Dobara banao, warna reel me
          awaaz aur likha hua alag-alag honge.
        </p>
      ) : staleReason === "choice" ? (
        /*
         * ⚠️ Alag line, kyunki alag baat hai. Bola gaya text bilkul theek hai —
         * bas ye us awaaz ka hai jo ab nahi chuni. Ek hi line dono par dikhane par
         * aadha waqt wo galat hoti, aur galat chetavni ko log padhna chhod dete
         * hain.
         */
        <p className="mb-1 flex items-start gap-1 text-[10px] leading-snug text-amber">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          Ye awaaz pehle wale chunav ki hai — upar se doosri awaaz chuni ja chuki hai. Dobara
          banao, warna reel ke beech me bolne wala badal jaayega.
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

        {/*
          ⚠️ Apni awaaz bhi isi ek raaste se aati hai — gallery kholo, aur wahin
          "Nayi file upload karo". Pehle upload ka apna button tha aur library ka
          apna; do raaste hone se wahi ek awaaz har reel me dobara chadhti thi.

          ⚠️ Library wala picker pehle Awaaz par **kabhi chala hi nahi**: wo tab ka
          id `${kind}s` jod kar banata tha, yaani `audios` — jo hai hi nahi, aur
          server saaf 400 deta tha. Ab id registry se aati hai (`libraryTabForKind`).
        */}
        <div className="min-w-0 max-w-[170px] flex-1">
          <AssetPickerButton
            kind="audio"
            allowUpload
            uploadTags={["wizard"]}
            assetId={scene.voiceAssetId}
            onPick={(assetId) => void pickVoice(assetId)}
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
            {measured !== null
              ? `${scene.voiceRate.toFixed(2)}x · scene ${sceneSeconds(scene).toFixed(1)}s`
              : "lambai pata nahi"}
          </span>
        </div>
      ) : null}

      {/*
        Is scene par awaaz kitni tez — **raftaar se alag** (26.24).

        ⚠️ Raftaar (kitni jaldi bola jaayega) aur level (kitna tez sunai dega) do
        alag cheezein hain, aur unhe ek hi patti me daalna galat samajh paida karta
        hai. Raftaar scene ki lambai badalti hai, level nahi.
      */}
      {scene.voiceAssetId ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Awaaz ka level:</span>
          {VOICE_LEVELS.map((entry) => (
            <button
              key={entry.label}
              type="button"
              title={entry.when}
              onClick={() => onChange(scene.index, { voiceVolume: entry.volume })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                Math.abs(scene.voiceVolume - entry.volume) < 0.01
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        ⚠️ Music ka per-scene chunav tabhi dikhta hai jab reel par music laga ho.
        Bina music ke ye teen button dabte to hain par kuch nahi karte — aur ek
        button jo kuch na kare, toote hue button jaisa hi hai (README rule 5).
      */}
      {hasMusic ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Music yahan:</span>
          {SCENE_MUSIC.map((entry) => (
            <button
              key={entry.label}
              type="button"
              title={entry.when}
              onClick={() => onChange(scene.index, { musicVolume: entry.volume })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                (entry.volume === null && scene.musicVolume === null) ||
                  (entry.volume !== null &&
                    scene.musicVolume !== null &&
                    Math.abs(scene.musicVolume - entry.volume) < 0.01)
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {entry.label}
            </button>
          ))}
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
  onMusic,
  onMusicVolume,
  onVoiceCategory,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
  /** `null` = music hata do. */
  onMusic(assetId: string | null): void;
  onMusicVolume(volume: number): void;
  /** Poori reel ki awaaz — draft me jaati hai, yahan ke state me nahi. */
  onVoiceCategory(categoryId: string): void;
}) {
  const live = draft.scenes.filter((scene) => !scene.removed);

  const [categories, setCategories] = useState<Category[]>([]);
  /*
   * ⚠️ Chunav **draft se** aata hai, is component ke `useState` se nahi — aur ye
   * ek asli bug ka ilaaj hai. Pehle wo yahin rehta tha, aur ye step har baar naye
   * sire se banta hai: aadmi "Aurat" chunta, teen scene banata, "Dekho" par jaata
   * aur wapas aata — chunav chup-chaap pehli category ("Aadmi") par gir jaata tha,
   * aur baaki chaar scene us doosri awaaz me ban jaate the. Screen par kahin kuch
   * galat nahi dikhta tha; wo galti sirf reel sun kar pakdi jaati hai.
   */
  const categoryId = draft.voiceCategoryId;
  const [ttsOff, setTtsOff] = useState<string | null>(null);
  /**
   * Poori reel ke liye ek hi provider — **ek baar chuna, phir wahi**.
   *
   * ⚠️ Bina iske har request par server dobara faisla karta hai ki kaun chalne
   * layak hai, aur us faisle ka badalna reel ke beech se bolne wala badal deta
   * hai. Ye us "har scene me awaaz alag lagti hai" wali shikayat ka doosra
   * hissa hai (pehla `draft.voiceCategoryId` tha).
   */
  const [providerId, setProviderId] = useState<string | null>(null);
  const ttsUsable = ttsOff === null;
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<{ at: number; reason: string }[]>([]);

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
        /*
         * Pehli baar par pehli category — par sirf **pehli baar**. Draft me pehle
         * se kuch likha ho to use haath nahi lagana: wo aadmi ka chunav hai, aur
         * uspar likh dena hi wo bug tha jisse har scene ki awaaz badal jaati thi.
         */
        const first = data.categories?.[0]?.id;
        if (!draft.voiceCategoryId && first) onVoiceCategory(first);

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
        setProviderId(usable[0]?.id ?? null);
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
    setFailed([]);

    const problems: { at: number; reason: string }[] = [];

    for (const [at, scene] of live.entries()) {
      if (!scene.text.trim()) continue;
      if (scene.voiceAssetId && !voiceStale(scene, draft)) continue;

      try {
        const made = await generateVoice({ text: scene.text, categoryId, providerId });
        onChange(scene.index, {
          voiceAssetId: made.assetId,
          voiceForText: scene.text,
          voiceCategoryId: categoryId,
          /*
           * ⚠️ Lambai yahan bhi likhni **zaroori** hai, aur ye ek asli bug tha.
           * Ek-ek karke banane wala raasta (`generate`) ise likhta tha, par
           * "Sab ki awaaz banao" wala nahi — jabki aam aadmi wahi dabata hai.
           * Nateeja chup-chaap bura tha: har scene ki lambai AI ke andaaze par
           * reh jaati thi (aksar 4s), aur awaaz ya to beech me kat'ti thi ya
           * uske baad chuppi aati thi. Screen par "awaaz lag gayi" likha aata
           * tha, isliye galti kahin dikhti bhi nahi thi.
           */
          voiceSeconds: made.seconds,
        });
      } catch (cause) {
        /*
         * ⚠️ Ek fail hone par baaki rukti nahi. Beech ke ek scene ki wajah se
         * aage ke saat chhod dena sabse chidhane wali baat hoti — aadmi ko phir
         * se sab chalana padta.
         *
         * ⚠️ Par wajah ab **chup nahi rehti**. Pehle ye `catch` khaali tha:
         * scene 7 par awaaz banti hi nahi thi aur us qatar par kuch bhi nahi
         * dikhta tha — na error, na nishaan. Aadmi ko lagta tha ki ban gayi.
         */
        problems.push({
          at: at + 1,
          reason: cause instanceof Error ? cause.message : String(cause),
        });
      }

      /*
       * ⚠️ Do call ke beech thodi saans. Muft wali Gemini key par TTS ki hadd
       * chhoti hai (kuch hi request per minute), aur saat request seedhe peeche-
       * peeche bhejne par beech wali 429 par gir jaati thi. Wo ek scene reel ke
       * beech se chup ho jaata tha — theek wo halat jise `draftAdvice` "toota hua
       * lagta hai" kehta hai.
       */
      await new Promise((done) => {
        setTimeout(done, BETWEEN_CALLS_MS);
      });
    }

    setFailed(problems);
    setRunning(false);
  }

  const pending = live.filter(
    (scene) => scene.text.trim() && (!scene.voiceAssetId || voiceStale(scene, draft)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <span className="text-[10px] text-chalk-500">Awaaz:</span>
        <select
          value={categoryId ?? ""}
          onChange={(event) => {
            if (event.target.value) onVoiceCategory(event.target.value);
          }}
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
          Poori reel ke liye ek hi — har scene par alag bolne wala reel ko tooti hui dikha deta
          hai. Ise badalne par pehle se bani awaazon par nishaan lag jaayega.
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

      {/*
        ⚠️ "Sab ki awaaz banao" me jo fail hui unki list — yahan, upar.

        Pehle ye kahin dikhti hi nahi thi (`catch` khaali tha). Sab kuch chal jaane
        jaisa lagta tha, aur ek scene chup reh jaata tha; wo sirf reel sun kar
        pakda jaata. Ab ginti bhi hai aur wajah bhi, us scene ke number ke saath —
        taaki neeche jaakar seedha wahi qatar dobara chalayi ja sake.
      */}
      {failed.length > 0 ? (
        <div className="space-y-0.5 rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5">
          <p className="text-[11px] text-red-300">
            {failed.length} scene par awaaz nahi ban paayi — neeche unki qatar par
            &ldquo;Awaaz banao&rdquo; dobara dabao.
          </p>
          {failed.map((entry) => (
            <p key={entry.at} className="text-[10px] leading-snug text-red-300/80">
              Scene {entry.at}: {entry.reason}
            </p>
          ))}
        </div>
      ) : null}

      {/*
        Peeche chalne wala music — **poori reel ke liye ek** (26.24).

        ⚠️ Ye wizard me isliye aaya ki bina iske reel aadhi lagti hai, aur use
        lagane ka ek hi raasta tha: poora editor kholo, music track banao, clip
        daalo, volume 0.15 par lao, loop karo. Wizard ka poora vaada hi ye hai ki
        aadmi ko editor sikhna na pade.

        ⚠️ Music library se aata hai (ya wahin se upload hota hai), aur uspar
        "music" ka tag lagta hai — isliye wo Media panel ke Music tab me apne aap
        aa jaata hai, aur agli reel me seedha wahan mil jaata hai.
      */}
      <div className="space-y-1.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Peeche music:</span>
          <div className="min-w-0 max-w-[190px] flex-1">
            <AssetPickerButton
              kind="audio"
              allowUpload
              uploadTags={["music", "wizard"]}
              assetId={draft.musicAssetId}
              onPick={(assetId) => onMusic(assetId)}
            />
          </div>
          {draft.musicAssetId ? (
            <button
              type="button"
              onClick={() => onMusic(null)}
              className="rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
            >
              Hata do
            </button>
          ) : (
            <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
              ya chhod do — reel bina music ke bhi banti hai
            </span>
          )}
        </div>

        {draft.musicAssetId ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-1.5">
            <span className="text-[10px] text-chalk-500">Music ka level:</span>
            {MUSIC_LEVELS.map((entry) => (
              <button
                key={entry.label}
                type="button"
                title={entry.when}
                onClick={() => onMusicVolume(entry.volume)}
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                  Math.abs(draft.musicVolume - entry.volume) < 0.01
                    ? "border-terracotta bg-terracotta/10 text-chalk-100"
                    : "border-ink-600 text-chalk-400 hover:border-chalk-500",
                )}
              >
                {entry.label}
                {Math.abs(entry.volume - 0.15) < 0.01 ? (
                  <span className="ml-1 rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
                    Sifaarish
                  </span>
                ) : null}
              </button>
            ))}
            <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
              Har scene par ise alag bhi kar sakte ho — neeche &ldquo;Music yahan&rdquo;.
            </span>
          </div>
        ) : null}
      </div>

      {live.map((scene, at) => (
        <VoiceRow
          key={scene.index}
          scene={scene}
          at={at}
          draft={draft}
          categoryId={categoryId}
          providerId={providerId}
          ttsUsable={ttsUsable}
          hasMusic={draft.musicAssetId !== null}
          onChange={onChange}
        />
      ))}
    </>
  );
}
