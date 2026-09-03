"use client";

import {
  MUSIC_LEVELS,
  MUSIC_LEVEL_DEFAULT,
  SCENE_MUSIC_LEVELS,
  VOICE_LEVELS,
  VOICE_RATES,
  estimateSpeechSeconds,
  sameLevel,
  sceneAdvice,
  sceneSeconds,
  draftTotalSeconds,
  usableVoiceSeconds,
  rateForSeconds,
  voiceSeconds,
  voiceStale,
  voiceStaleReason,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Info, Loader2, Mic, Scissors } from "lucide-react";
import { useEffect, useState } from "react";

import { AudioPreview } from "@/components/media/AudioPreview";
import { VideoTrimDialog } from "@/components/editor/wizard/VideoTrimDialog";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { VoiceTrimDialog } from "@/components/editor/wizard/VoiceTrimDialog";
import { VolumePoints } from "@/components/editor/wizard/VolumePoints";
import { useAssetDurations } from "@/lib/assetMeta";
import { VoiceError, generateVoice } from "@/lib/voiceGen";

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
/*
 * Awaaz aur music ke level ki list ab `@reel/core` (`wizard/names.ts`) me hai.
 *
 * ⚠️ Wo yahan se hatayi gayi thi kyunki wahi chunav ab Dekho wale step me bhi
 * dikhta hai. Do jagah do list rakhne par ek din "Dheemi" ka matlab ek jagah 0.6
 * hota aur doosri jagah 0.5 — aur wo farak screen par kabhi nahi dikhta.
 */

interface Category {
  id: string;
  label: string;
  hint?: string;
}

/**
 * "Sab ki awaaz banao" me do call ke beech ka thehrav.
 *
 * ⚠️ Ye 500ms tha, aur wo **naapa hua galat** nikla. Free quota par Gemini ki
 * hadd per-minute hai (teen-chaar call), isliye aadhe second ke gap se chhe scene
 * bhejne par pehle do-teen ban jaate the aur baaki har ek 429 par gir jaata tha.
 * Aadmi ke liye ye "aadhi reel par awaaz hai" jaisa dikhta tha, bina kisi wajah ke.
 *
 * ⚠️ Ye sirf shuruaati chaal hai, hadd nahi. Asli rukna 429 ke jawab me hota hai,
 * jahan Google khud batata hai ki kitni der (`retryAfterSeconds`) — andaaze se
 * rukna ya to bekaar intezaar hai ya bekaar koshish.
 */
const BETWEEN_CALLS_MS = 4_000;

/**
 * Ek saath kitni awaazein banti hain (26.27).
 *
 * ⚠️ Pehle ye 1 thi — har scene ek-ek karke, aur har do ke beech 4 second ka
 * gap. Saat scene ki reel par wo **50 second** ka intezaar tha, jisme se aadha
 * waqt kuch ho hi nahi raha tha. Aur wo gap har baar lagta tha, chahe provider
 * ne ek baar bhi mana na kiya ho — yaani jo hadd kabhi lagi hi nahi, uski keemat
 * har reel chukati thi.
 *
 * ⚠️ **1 hai — 3 se wapas laaya gaya (26.28).** Pehle 3 kiya gaya tha, aur wo
 * naap kar nahi, ummeed par tha. Asli nateeja ye nikla:
 *
 *     Scene 1 — Server ne jawab beech me chhod diya
 *     Scene 2 — awaaz lag gayi
 *     Scene 3 — Server ne jawab beech me chhod diya
 *
 * Wajah ye hai ki teen call ek saath bhejne se wo teen guna tez nahi hoti —
 * Google unhe apne yahan qatar me lagata hai, har ek pehle se dheemi ho jaati
 * hai, aur ek-do us 60 second ki hadd ko chhoo leti hain jispar Vercel function
 * ko maar deta hai. Yaani tez chalne ki koshish ne har baar **aadhi reel par
 * awaaz** bana di — aur wo sabse buri shakal hai kisi bhi kharabi ki, kyunki
 * aadmi ko na wajah dikhti hai na koi tarteeb.
 *
 * ⚠️ Intezaar phir bhi pehle jitna nahi hai, aur wo hissa bacha hua hai: beech
 * ka 4 second ka gap ab tabhi lagta hai jab provider ek baar mana kar de
 * (`slow`). Pehle wo har reel par har baar lagta tha, us hadd se bachne ke liye
 * jo aksar lagti hi nahi. Jo cheez hatayi gayi wo **bekaar intezaar** tha, na ki
 * wo tarteeb jo kaam ko chalta rakhti hai.
 *
 * ⚠️ **Upar wali wajah galat thi, par ginti sahi hai (26.29).** "Teen call ek
 * saath bhejne par Google unhe dheema kar deta hai" — aisa kuch nahi hota. Wo
 * "jawab beech me chhod diya" `temperature: 0` ka atakna tha (dekho
 * `GEMINI_TEMPERATURE`), jo ab theek hai; 6 call bina kisi gap ke chalayi gayi
 * aur har ek 5-8s me lauti.
 *
 * Phir bhi 1 hi hai, ab ek naapi hui wajah se: TTS model par Tier 1 ki hadd
 * **10 call/minute** hai. Ek call ~6s ki hai, yaani ek lane khud-ba-khud us
 * hadd ke andar rehti hai. Teen lane usse teen guna tez nahi banati — wo bas
 * 429 ke uss raaste par le jaati hai jahan rukna padta hai, aur kul waqt utna
 * hi ya zyada ho jaata hai.
 *
 * ⚠️ Ye ginti badhane se pehle: ek scene ka fail hona ek awaaz ka kharcha aur
 * ek adhoori reel hai. Utni keemat par thodi si tezi kabhi sasti nahi padti.
 */
const LANES = 1;

/** Do awaazon ke beech ki saans — upar wala ⚠️ dekho. */
const BREATH_MS = 2_000;

/**
 * Ek scene par kitni baar rukein.
 *
 * ⚠️ Do ke baad haar maan li jaati hai, aur ye jaan-boojhkar hai: teesri baar tak
 * baat hadd ki nahi rehti (wo to khul chuki hoti hai), kuch aur galat hota hai —
 * aur wahan aur rukna aadmi ko sirf intezaar karwana hai.
 */
const RATE_LIMIT_WAITS = 2;

/** Google `retryDelay` na bataye to itna. */
const DEFAULT_RETRY_SECONDS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

function VoiceRow({
  scene,
  at,
  draft,
  categoryId,
  providerId,
  ttsUsable,
  reelMusicAssetId,
  onChange,
  onSceneMusicTrim,
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
  /**
   * Poori reel ka gaana — `null` = reel par koi music nahi.
   *
   * ⚠️ Pehle yahan ek `hasMusic: boolean` tha, aur wo kaafi nahi raha. Ab har
   * scene apna gaana bhi rakh sakta hai, isliye "is scene par music baj raha hai
   * ya nahi" ka jawab dono se milkar banta hai — sirf reel wale se nahi.
   */
  reelMusicAssetId: string | null;
  onChange(index: number, patch: Partial<WizardScene>): void;
  /** Is scene par gaane ka hissa chunne ka dialog kholo. */
  onSceneMusicTrim(index: number): void;
}) {
  /** "Itne second me bulwao" wala khaana — string, taaki aadha likha hua na mit jaaye. */
  const [wantSeconds, setWantSeconds] = useState("4");

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
  /** Awaaz kaatne wala dialog khula hai? */
  const [trimming, setTrimming] = useState(false);

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
      /*
       * ⚠️ Purani kaat yahin girti hai. Nayi file ki lambai alag hoti hai, aur
       * "2.4s se 6.1s" us file ka matlab rakhti thi jo ab hai hi nahi — nayi par
       * wo aksar aadhi awaaz kaat deti, chup-chaap.
       */
      voiceTrim: null,
    });
  }

  const staleReason = voiceStaleReason(scene, draft);
  const stale = staleReason !== null;
  /** Bani hui awaaz ki asli lambai — `null` = hai hi nahi, ya wo purane shabdon ki hai. */
  const measured = usableVoiceSeconds(scene);

  /*
   * ⚠️ Hisaab `@reel/core` ka — yahan dobara nahi likha gaya. Raftaar ka ganit
   * (saans ki ginti, hadd, aur "maang poori hui ya nahi") wahan jaancha hua hai;
   * yahan likhne par screen ek number dikhati aur lagne par doosra nikalta.
   */
  const pace = (() => {
    const want = Number.parseFloat(wantSeconds);
    if (!Number.isFinite(want) || want <= 0) return null;
    return rateForSeconds(scene, want);
  })();
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
        // Nayi awaaz, nayi lambai — purani kaat uspar bemaani hai.
        voiceTrim: null,
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
              onChange(scene.index, {
                voiceAssetId: null,
                voiceForText: null,
                voiceSeconds: null,
                voiceTrim: null,
              })
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
        Sun kar dekho — **wahin jahan awaaz banti hai** (26.27).

        ⚠️ Ye pehle nahi tha, aur uski keemat har baar lagti thi. Awaaz ban jaane
        ke baad use sunne ka ek hi tarika tha: wizard band karo, timeline par
        jao, us clip ko dhoondho, phir chalao. Yaani jaanchne ki keemat itni thi
        ki koi jaanchta hi nahi tha — sab "awaaz lag gayi" padh kar aage badh
        jaate the, aur galat awaaz ya kata hua text export ke baad pata chalta tha.

        ⚠️ Player sirf tab jab awaaz ho. Khaali player dikhana (jo dabta hai par
        kuch bajta nahi) toote hue button jaisa hi hai.
      */}
      {scene.voiceAssetId ? (
        <div className="mt-1 flex items-center gap-1.5">
          <AudioPreview assetId={scene.voiceAssetId} className="min-w-0 flex-1" />
          {/*
            Kaat — **player ke bilkul bagal me** (26.28).

            ⚠️ Ye button yahan hai, kisi menu me nahi, kyunki ye wahi pal hai jab
            zaroorat pata chalti hai: aadmi awaaz sunta hai, shuru me ek lambi
            saans milti hai, aur agla haath usi jagah jaana chahiye. Do click door
            rakhne par wo saans reel me chali jaati hai.
          */}
          <button
            type="button"
            onClick={() => setTrimming(true)}
            title="Awaaz ka sirf ek hissa lo — shuru ki saans ya ant ka adhoora shabd kaat do"
            className={clsx(
              "flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
              scene.voiceTrim
                ? "border-terracotta bg-terracotta/10 text-chalk-100"
                : "border-ink-600 text-chalk-400 hover:border-chalk-500 hover:text-chalk-100",
            )}
          >
            <Scissors size={9} />
            {scene.voiceTrim
              ? `${scene.voiceTrim.startSeconds.toFixed(1)}–${scene.voiceTrim.endSeconds.toFixed(1)}s`
              : "Kaato"}
          </button>
          {scene.voiceTrim ? (
            <button
              type="button"
              onClick={() => onChange(scene.index, { voiceTrim: null })}
              title="Poori awaaz wapas"
              className="shrink-0 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
            >
              Poori
            </button>
          ) : null}
        </div>
      ) : null}

      <VoiceTrimDialog
        open={trimming}
        assetId={scene.voiceAssetId}
        fallbackSeconds={scene.voiceSeconds}
        value={scene.voiceTrim}
        onCancel={() => setTrimming(false)}
        onSave={(trim) => {
          onChange(scene.index, { voiceTrim: trim });
          setTrimming(false);
        }}
      />

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
              key={entry.label}
              type="button"
              title={entry.when}
              onClick={() => onChange(scene.index, { voiceRate: entry.value ?? 1 })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                sameLevel(scene.voiceRate, entry.value)
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
        "Itne second me bulwao" — raftaar peeche se apne aap tay hoti hai.

        ⚠️ Ye chaar bane hue chunavon ke SAATH hai, unki jagah nahi. Zyadatar
        waqt aadmi ko "tez" ya "dheemi" hi chahiye hota hai aur wo ek tap hai;
        par jab scene ki lambai pehle se tay ho (jaise doosre scene ke saath
        milani ho) tab wahi chaar chunav ek paheli ban jaate hain — "1.15x se
        kitne second banenge?" ka jawab kisi ke paas nahi hota.

        ⚠️ Maang hadd se bahar ho to wo SAAF bataya jaata hai. Chup-chaap hadd
        tak le jaane par aadmi 3 second maangta, use 4.2 milta, aur use kabhi
        pata na chalta ki uski maang poori hui hi nahi.
      */}
      {scene.voiceAssetId && measured !== null ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Ya itne second me bulwao:</span>
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={wantSeconds}
            onChange={(event) => setWantSeconds(event.target.value)}
            className="w-16 rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[10px] text-chalk-100"
          />
          <button
            type="button"
            disabled={!pace}
            onClick={() => {
              if (pace) onChange(scene.index, { voiceRate: pace.rate });
            }}
            className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-terracotta hover:text-chalk-100 disabled:opacity-40"
          >
            Laga do
          </button>
          {pace ? (
            <span
              className={clsx(
                "min-w-0 flex-1 text-right font-mono text-[10px]",
                pace.clamped ? "text-amber" : "text-chalk-500",
              )}
            >
              {pace.clamped
                ? `itni tez nahi ho sakti — ${pace.rate.toFixed(2)}x par ${pace.seconds.toFixed(1)}s`
                : `${pace.rate.toFixed(2)}x`}
            </span>
          ) : null}
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
              onClick={() => onChange(scene.index, { voiceVolume: entry.value ?? 1 })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                sameLevel(scene.voiceVolume, entry.value)
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
        ⚠️ Safar ki hadd **awaaz ki apni lambai** hai, scene ki nahi. Kaat lagne ke
        baad awaaz scene se chhoti ho sakti hai; scene ki lambai dikhane par uske
        aage ka mod chup-chaap gir jaata aur uska koi nishaan kahin nahi dikhta.
      */}
      {scene.voiceAssetId ? (
        <div className="mt-1">
          <VolumePoints
            label="Bolne wale ka safar"
            hint="Scene ke beech me awaaz kam ya zyada karni ho to yahan mod jodo."
            maxSeconds={voiceSeconds(scene) ?? sceneSeconds(scene)}
            base={scene.voiceVolume}
            points={scene.voiceVolumePoints}
            onChange={(next) => onChange(scene.index, { voiceVolumePoints: next })}
          />
        </div>
      ) : null}

      {/*
        Is scene ka apna gaana (26.28).

        ⚠️ Ye chunav har scene par dikhta hai, tab bhi jab reel par music na ho —
        aur wo jaan-boojhkar hai. Aksar aadmi ko music poori reel par nahi, sirf
        aakhri CTA par chahiye hota hai; reel wale chunav ki shart lagane par uske
        paas wo karne ka koi raasta hi nahi bachta.

        ⚠️ Khaali hone par yahan "Reel wala" likha hai, "koi nahi" nahi — kyunki
        khaali ka matlab wahi hai. "Koi nahi" padh kar aadmi har scene par gaana
        chunne lagta hai, jabki 90% reel me ek hi dhun sahi hoti hai.
      */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-chalk-500">Is scene ka music:</span>
        <div className="min-w-0 max-w-[170px] flex-1">
          <AssetPickerButton
            kind="audio"
            allowUpload
            uploadTags={["music", "wizard"]}
            assetId={scene.musicAssetId}
            onPick={(assetId) => onChange(scene.index, { musicAssetId: assetId })}
          />
        </div>
        {scene.musicAssetId ? (
          <button
            type="button"
            title="Is scene par bhi wahi dhun jo poori reel par chal rahi hai"
            onClick={() => onChange(scene.index, { musicAssetId: null })}
            className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
          >
            Reel wala
          </button>
        ) : (
          <span className="text-[10px] text-chalk-500">
            {reelMusicAssetId ? "reel wali dhun chal rahi hai" : "koi music nahi"}
          </span>
        )}
      </div>

      {/*
        Music bhi sun kar dekho — bilkul awaaz ki tarah (26.28).

        ⚠️ Ye kami chala kar pakdi gayi: awaaz ka player pehle din se tha, music
        ka nahi. Yaani aadmi gaana chunta tha aur use SUNE BINA aage badh jaata
        tha — uske paas koi raasta hi nahi tha. Galat ya bahut tez dhun poori reel
        banne ke baad hi pata chalti thi.

        ⚠️ Jo dhun is scene par sach me bajegi wahi bajti hai — scene ka apna gaana
        ho to wo, warna reel wala. Sirf `scene.musicAssetId` dikhane par un scenes
        par kuch bhi na hota jahan reel wali dhun chal rahi hai, jo aam haalat hai.
      */}
      {(scene.musicAssetId ?? reelMusicAssetId) ? (
        <AudioPreview assetId={scene.musicAssetId ?? reelMusicAssetId} className="mt-1" />
      ) : null}

      {/*
        ⚠️ Level ka chunav tabhi dikhta hai jab is scene par music sach me baj
        raha ho — reel wala ho ya iska apna. Bina music ke ye teen button dabte to
        hain par kuch nahi karte, aur ek button jo kuch na kare wo toote hue
        button jaisa hi hai (README rule 5).
      */}
      {(scene.musicAssetId ?? reelMusicAssetId) ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Music yahan:</span>
          {SCENE_MUSIC_LEVELS.map((entry) => (
            <button
              key={entry.label}
              type="button"
              title={entry.when}
              onClick={() => onChange(scene.index, { musicVolume: entry.value })}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                sameLevel(scene.musicVolume, entry.value)
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
        Is scene par gaane ka kaunsa hissa.

        ⚠️ Ye reel wale hisse ke UPAR chalta hai, uski jagah nahi leta — wahi
        tarika jo music ke chunav aur level ka hai. Jahan scene ka apna gaana ho
        wahan ye bilkul theek hai; ek hi gaane ke beech me ye soch kar hi karna
        chahiye, kyunki jodon par dhun kood sakti hai.
      */}
      {(scene.musicAssetId ?? reelMusicAssetId) ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Is scene par gaane ka hissa:</span>
          <button
            type="button"
            onClick={() => onSceneMusicTrim(scene.index)}
            className="flex items-center gap-1 text-[10px] text-chalk-400 transition-colors hover:text-chalk-100"
          >
            <Scissors size={9} />
            {scene.musicTrim
              ? `${scene.musicTrim.startSeconds.toFixed(1)}s se ${scene.musicTrim.endSeconds.toFixed(1)}s`
              : "reel jaisa"}
            <span className="underline">badlo</span>
          </button>
          {scene.musicTrim ? (
            <button
              type="button"
              onClick={() => onChange(scene.index, { musicTrim: null })}
              className="rounded border border-ink-600 px-1 py-0.5 text-[9px] text-chalk-500 transition-colors hover:border-chalk-500"
            >
              reel jaisa karo
            </button>
          ) : null}
        </div>
      ) : null}

      {(scene.musicAssetId ?? reelMusicAssetId) ? (
        <div className="mt-1">
          <VolumePoints
            label="Dhun ka safar"
            hint="Jaise: shuru ke 3 second dheemi, phir aakhri me tez — mod jodo."
            maxSeconds={sceneSeconds(scene)}
            base={scene.musicVolume ?? draft.musicVolume}
            points={scene.musicVolumePoints}
            onChange={(next) => onChange(scene.index, { musicVolumePoints: next })}
          />
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
  onMusicTrim,
  onVoiceCategory,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
  /** `null` = music hata do. */
  onMusic(assetId: string | null): void;
  onMusicVolume(volume: number): void;
  /** Gaane ka chuna hua hissa — `null` = poora gaana. */
  onMusicTrim(trim: { startSeconds: number; endSeconds: number } | null): void;
  /** Poori reel ki awaaz — draft me jaati hai, yahan ke state me nahi. */
  onVoiceCategory(categoryId: string): void;
}) {
  const [musicTrimOpen, setMusicTrimOpen] = useState(false);
  /** Kis scene ka gaane wala hissa chuna ja raha hai — `null` = koi nahi. */
  const [sceneTrimFor, setSceneTrimFor] = useState<number | null>(null);
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
  /**
   * Batch abhi kahan hai — **ek line me**.
   *
   * ⚠️ Iske bina "Sab ki awaaz banao" sirf ek ghoomta hua chakkar tha. Ek scene
   * 3 second bhi le sakta hai aur (jab provider dheema ho) minute bhar bhi; hadd
   * lagne par beech me 30 second ka intezaar bhi aata hai. Un teeno halaton me
   * screen bilkul ek jaisi dikhti thi, isliye aadmi ke paas "atak gaya" ke alawa
   * koi natija tha hi nahi — aur wo wizard band kar deta tha, jisse aadhi bani
   * awaazein bhi chali jaati thi.
   */
  const [progress, setProgress] = useState<string | null>(null);

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
  /**
   * Sab ki awaaz — **teen ek saath, aur provider mana kare to ek-ek karke**.
   *
   * ⚠️ Poora bartaav 429 ke asli jawab par chalta hai, kisi andaaze par nahi.
   * Teen cheezein isme zaroori hain:
   *
   *  0. **Tez chalna default hai.** Teen lane ek saath chalti hain aur beech ka
   *     gap tab tak lagta hi nahi jab tak provider ek baar mana na kar de (26.27).
   *     Pehle ulta tha — har reel har baar sabse dheemi chaal se banti thi, us
   *     hadd se bachne ke liye jo aksar lagti hi nahi thi.
   *  1. **Hadd lagne par rukna, na ki agli scene par bhaagna.** Pehle 429 ko ek
   *     aam nakami maan kar aage badh jaate the — nateeja ye ki chhe me se do
   *     scene ban'te the aur chaar par wahi error, kyunki hadd to lagi hi rehti
   *     thi. Ab utni der ruka jaata hai jitni Google batata hai, aur **wahi scene**
   *     dobara chalti hai.
   *  2. **Din bhar ki hadd par poora batch rok dena.** Wo rukne se khulti hi
   *     nahi; baaki paanch scene bhejna sirf paanch aur nakaam call hai.
   *  3. **Har halat ka nishaan, aur wo bhi turant.** Chup-chaap chhoot jaana wo
   *     galti hai jo sirf reel sun kar pakdi jaati hai. Nakami ab **usi waqt**
   *     likhi jaati hai jab hoti hai, batch ke ant me nahi — warna aadmi paanch
   *     scene ka intezaar poori ummeed se karta hai aur ant me pata chalta hai ki
   *     pehli hi scene gir chuki thi.
   */
  async function runAll(): Promise<void> {
    if (!categoryId) return;
    /*
     * ⚠️ Chunav ek local const me utha liya jaata hai. Upar wala guard TypeScript
     * ke liye kaafi nahi hai — `lane()` ek alag function hai, aur uske andar tak
     * wo narrowing nahi pahunchti. Isse bada faayda ye hai ki poore batch ke
     * dauraan awaaz **wahi** rehti hai jo shuru me chuni thi, chahe beech me upar
     * se koi doosri chun le: warna aadhi reel ek aadmi ki awaaz me hoti aur aadhi
     * doosre ki.
     */
    const voice = categoryId;
    setRunning(true);
    setFailed([]);
    setProgress(null);

    const queue = live.filter(
      (scene) => scene.text.trim() && (!scene.voiceAssetId || voiceStale(scene, draft)),
    );

    /** Agli scene kaunsi — saari lane isi ek ginti se uthaati hain. */
    let cursor = 0;
    let done = 0;
    let stopped = false;
    /**
     * Provider ne ek baar mana kar diya — ab ek-ek karke aur gap ke saath.
     *
     * ⚠️ Ye ek tarfa hai: `true` hone ke baad wapas `false` nahi hota. Hadd
     * khulne par dobara tez ho jaana aasan lagta hai, par wo seedha usi hadd me
     * wapas ja girta hai — aur har girna ginti me aata hai.
     */
    let slow = false;
    const inFlight = new Set<number>();

    const tick = (message?: string): void => {
      if (message) {
        setProgress(message);
        return;
      }
      const busyNow = [...inFlight].sort((a, b) => a - b);
      setProgress(
        busyNow.length === 0
          ? `${done}/${queue.length} ho chuki`
          : `Scene ${busyNow.join(", ")} ki awaaz ban rahi hai… (${done}/${queue.length} ho chuki)`,
      );
    };

    async function lane(laneNo: number): Promise<void> {
      while (!stopped) {
        // Dheeme mode me sirf pehli lane bachti hai; baaki apna kaam khatam
        // karke chup-chaap nikal jaati hain.
        if (slow && laneNo > 0) return;

        const mine = cursor;
        cursor += 1;
        if (mine >= queue.length) return;
        const scene = queue[mine];
        if (!scene) return;

        const at = live.indexOf(scene) + 1;
        let waits = 0;
        inFlight.add(at);
        tick();

        while (!stopped) {
          try {
            const made = await generateVoice({
              text: scene.text,
              categoryId: voice,
              providerId,
            });
            onChange(scene.index, {
              voiceAssetId: made.assetId,
              voiceForText: scene.text,
              voiceCategoryId: voice,
              /*
               * ⚠️ Lambai yahan bhi likhni **zaroori** hai, aur ye ek asli bug tha.
               * Ek-ek karke banane wala raasta (`generate`) ise likhta tha, par
               * "Sab ki awaaz banao" wala nahi — jabki aam aadmi wahi dabata hai.
               * Nateeja chup-chaap bura tha: har scene ki lambai AI ke andaaze par
               * reh jaati thi (aksar 4s), aur awaaz ya to beech me kat'ti thi ya
               * uske baad chuppi aati thi.
               */
              voiceSeconds: made.seconds,
            });
            done += 1;
            break;
          } catch (cause) {
            const error =
              cause instanceof VoiceError ? cause : new VoiceError(String(cause), "other");

            if (error.kind === "quota-over") {
              /*
               * Aaj bhar ki hadd — rukne se nahi khulegi. Baaki scene bhejna sirf
               * utni aur nakaam call hai, aur har nakaam call bhi ginti me aati hai.
               */
              setFailed((prev) => [...prev, { at, reason: error.message }]);
              stopped = true;
              break;
            }

            if (error.kind === "rate-limit") {
              /*
               * ⚠️ Pehli 429 par hi ikattha bhejna band — us scene ko chhodne se
               * pehle. Ye tarteeb maayne rakhti hai: agar ye line retry ke baad
               * hoti, to baaki do lane us poore intezaar ke dauraan naye call
               * bhejti rehti aur hadd kabhi khulti hi nahi.
               */
              slow = true;

              if (waits >= RATE_LIMIT_WAITS) {
                setFailed((prev) => [...prev, { at, reason: error.message }]);
                break;
              }
              waits += 1;
              const seconds = error.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS;
              for (let left = seconds; left > 0 && !stopped; left -= 1) {
                tick(
                  `Hadd lag gayi — ${left}s baad scene ${at} dobara ` +
                    `(${done}/${queue.length} ho chuki).`,
                );
                await sleep(1000);
              }
              continue;
            }

            setFailed((prev) => [...prev, { at, reason: error.message }]);
            break;
          }
        }

        inFlight.delete(at);
        tick();
        /*
         * Do call ke beech thodi saans — **per-minute hadd ke liye** (26.29).
         *
         * ⚠️ Yahan pehle ye likha tha ki "ek ke baad ek bina ruke bulane par
         * Gemini ki latency chadhti jaati hai (3.3s → 6.7s → 40.7s → jawab hi
         * nahi)". Wo naap sach tha par uska matlab galat nikala gaya tha: us
         * waqt `temperature: 0` laga hua tha aur wahi atakne ki asli wajah thi
         * (dekho `GEMINI_TEMPERATURE`). Theek karne ke baad 6 call **bina kisi
         * gap ke** chalayi gayi: 7.8s, 6.2s, 7.7s, 7.6s, 5.8s, 5.2s. Koi ramp
         * nahi hai.
         *
         * ⚠️ Gap phir bhi rehta hai, kyunki uski ek doosri, asli wajah hai:
         * TTS model par Tier 1 ki hadd **10 call/minute** hai. ~6s ki call ke
         * saath 2s ka gap yaani ~7.5 call/minute — us hadd se saaf neeche, bina
         * kisi mehsoos hone wale intezaar ke.
         *
         * ⚠️ `slow` par gap poora 4s ho jaata hai. Do alag number hone ki wajah
         * saaf hai: neeche wala gap hadd ke paas jaane se rokta hai, upar wala
         * tab lagta hai jab provider **saaf mana** kar chuka ho.
         */
        if (!stopped) await sleep(slow ? BETWEEN_CALLS_MS : BREATH_MS);
      }
    }

    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(LANES, queue.length)) }, (_, i) => lane(i)),
    );

    setProgress(null);
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

      {progress ? (
        <p className="flex items-center gap-1.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] text-chalk-300">
          <Loader2 size={11} className="shrink-0 animate-spin" />
          {progress}
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

        {/*
          ⚠️ Reel ka gaana bhi sunna chahiye, chunne ke turant baad. Bina iske
          library se ek naam chun lena hi poora "chunav" tha — aur naam se ye kabhi
          pata nahi chalta ki dhun reel ke saath baithegi ya nahi.
        */}
        {draft.musicAssetId ? <AudioPreview assetId={draft.musicAssetId} /> : null}

        {/*
          Gaane ka kaunsa hissa bajega.

          ⚠️ Ye poori reel ka chunav hai, per-scene nahi — aur wo jaan-boojhkar
          hai. Music scene-dar-scene aage badhta hai (ek hi dhun katti nahi,
          chalti rehti hai). Har scene par apna hissa chunne ka matlab hota har
          jod par dhun ka achanak kood jaana, aur wo reel ki sabse buri awaaz hai.
        */}
        {draft.musicAssetId ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-1.5">
            <span className="text-[10px] text-chalk-500">Gaane ka hissa:</span>
            <button
              type="button"
              onClick={() => setMusicTrimOpen(true)}
              className="flex items-center gap-1 text-[10px] text-chalk-400 transition-colors hover:text-chalk-100"
            >
              <Scissors size={9} />
              {draft.musicTrim
                ? `${draft.musicTrim.startSeconds.toFixed(1)}s se ${draft.musicTrim.endSeconds.toFixed(1)}s`
                : "poora gaana"}
              <span className="underline">badlo</span>
            </button>
          </div>
        ) : null}

        {/*
          Is scene ka apna gaane wala hissa.

          ⚠️ `assetId` scene ka apna gaana hai agar ho, warna reel wala — warna
          dialog us gaane ki jhalak dikhata jo is scene par baj hi nahi raha.
        */}
        <VideoTrimDialog
          open={sceneTrimFor !== null}
          assetId={
            sceneTrimFor === null
              ? null
              : (draft.scenes.find((entry) => entry.index === sceneTrimFor)?.musicAssetId ??
                draft.musicAssetId)
          }
          sceneSeconds={Math.max(4, draftTotalSeconds(draft))}
          fallbackSeconds={null}
          value={
            sceneTrimFor === null
              ? null
              : (draft.scenes.find((entry) => entry.index === sceneTrimFor)?.musicTrim ?? null)
          }
          onCancel={() => setSceneTrimFor(null)}
          onSave={(trim) => {
            if (sceneTrimFor !== null) onChange(sceneTrimFor, { musicTrim: trim });
            setSceneTrimFor(null);
          }}
        />

        <VideoTrimDialog
          open={musicTrimOpen}
          assetId={draft.musicAssetId}
          sceneSeconds={Math.max(4, draftTotalSeconds(draft))}
          fallbackSeconds={null}
          value={draft.musicTrim}
          onCancel={() => setMusicTrimOpen(false)}
          onSave={(trim) => {
            onMusicTrim(trim);
            setMusicTrimOpen(false);
          }}
        />

        {draft.musicAssetId ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-1.5">
            <span className="text-[10px] text-chalk-500">Music ka level:</span>
            {MUSIC_LEVELS.map((entry) => (
              <button
                key={entry.label}
                type="button"
                title={entry.when}
                onClick={() => onMusicVolume(entry.value ?? MUSIC_LEVEL_DEFAULT)}
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                  sameLevel(draft.musicVolume, entry.value)
                    ? "border-terracotta bg-terracotta/10 text-chalk-100"
                    : "border-ink-600 text-chalk-400 hover:border-chalk-500",
                )}
              >
                {entry.label}
                {sameLevel(entry.value, MUSIC_LEVEL_DEFAULT) ? (
                  <span className="ml-1 rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
                    Sifaarish
                  </span>
                ) : null}
              </button>
            ))}
            <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
              Har scene par level aur dhun dono alag ho sakte hain — neeche har qatar me.
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
          reelMusicAssetId={draft.musicAssetId}
          onChange={onChange}
          onSceneMusicTrim={(index) => setSceneTrimFor(index)}
        />
      ))}
    </>
  );
}
