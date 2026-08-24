"use client";

import {
  requiredVisualSize,
  fitFor,
  suggestAnimation,
  suggestTransition,
  visualSlotKind,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Film, ImageOff, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { ChoicePicker } from "@/components/editor/wizard/ChoicePicker";
import { VideoTrimDialog } from "@/components/editor/wizard/VideoTrimDialog";
import { useAssetUrl } from "@/lib/assetUrls";
import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";

/**
 * Step 2 — **Tasveer** (26.6 / 26.7).
 *
 * ⚠️ Tasveer **chhodi ja sakti hai**, aur ye "kam" wala raasta nahi hai — yahi
 * is step ki jaan hai. Har scene par tasveer zaroori kar dene par aath scene
 * wali kahani ke liye aath tasveer dhoondhni padti, aur aadmi wahin chhod deta
 * hai. Adhoori reel se buri sirf ek cheez hai: koi reel na banna.
 *
 * Chhodne par wo scene text-wala ban jaata hai (aur awaaz ho to `text_audio`) —
 * poora hisaab `@reel/core` ke `effectiveType()` me hai.
 */

/**
 * Is scene ke liye sifaarish — ek hi jagah.
 *
 * ⚠️ Ye hisaab do jagah chahiye (qatar ka nishaan, aur tasveer lagte hi lagne
 * wali harkat), aur dono jagah alag likhne par wo ek din alag ho jaate hain:
 * nishaan kuch aur dikhata aur lagta kuch aur.
 */
function recommendedAnimationFor(scene: WizardScene, at: number, hasImage: boolean): string | null {
  return suggestAnimation({ type: scene.type, text: scene.text, hasImage }, at);
}

/**
 * Ek scene ki qatar.
 *
 * ⚠️ Upload ab yahan nahi hota — wo picker ke dialog ke andar hai (`AssetPicker`).
 * Pehle har qatar ka apna uploader tha, is dalil par ki tab "ye file kis scene ki
 * thi" wala sawaal hi nahi uthta. Wo dalil sahi thi par uska hal ab isse behtar
 * hai: dialog ek hi scene ke liye khulta hai, isliye jawab waise bhi pakka rehta
 * hai — aur badle me gallery aur upload ek hi jagah aa jaate hain, do alag raaston
 * ki jagah.
 */
function SceneRow({
  scene,
  at,
  recommendedAnimation,
  recommendedTransition,
  source,
  project,
  sourceSeconds,
  onChange,
}: {
  scene: WizardScene;
  at: number;
  recommendedAnimation: string | null;
  recommendedTransition: string;
  /** Chuni hui file ka asli naap — `null` = abhi pata nahi. */
  source: { width: number; height: number } | null;
  /** Video ki DB wali lambai — trim dialog ka fallback. */
  sourceSeconds: number | null;
  project: { width: number; height: number };
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  /**
   * Tasveer lagti/hatti hai to **harkat bhi saath me** tay hoti hai.
   *
   * ⚠️ Ye chala kar dekhne par nikla. Aadmi tasveer daalta hai aur "Harkat" ka
   * khaana **khaali** reh jaata hai, jabki uske bagal me "Sifaarish" ka nishaan
   * laga hota hai. Yaani screen ek sujhav dikhati hai jo laga hi nahi. Design ka
   * vaada iska ulta tha: "apne aap chun jaata hai, badalna ek tap".
   *
   * ⚠️ Tasveer hatne par harkat **null nahi hoti, text wali ho jaati hai**. Pehle
   * wo null hoti thi (zoom text par na lag jaaye), aur uska nateeja ye tha ki
   * bina tasveer wala scene bilkul sthir reh jaata tha. Ab `suggestAnimation`
   * khud text ke liye text wala preset deta hai, isliye dono taraf jawab hai.
   */
  const [trimFor, setTrimFor] = useState<string | null>(null);

  function setImage(assetId: string | null, kind: "image" | "video" = "image"): void {
    /*
     * Video chunte hi trim ka sawaal — baad me nahi. Baad me poochhne par aadmi
     * aage badh chuka hota hai, aur galat hissa reel bante waqt hi dikhta hai.
     */
    if (assetId && kind === "video") setTrimFor(assetId);

    onChange(scene.index, {
      visualAssetId: assetId,
      visualAssetKind: assetId ? kind : null,
      ...(assetId && kind === "video" ? {} : { visualTrim: null }),
      /*
       * ⚠️ Tasveer hatne par harkat ab **null nahi hoti, text wali ho jaati hai**.
       * Pehle yahan `null` likha tha, is dar se ki zoom text par lag jaayega. Us
       * dar ki keemat ye thi ki tasveer hatate hi wo scene bilkul sthir ho jaata
       * tha — aur "Harkat" ka khaana khaali, jabki uske bagal me "Sifaarish" ka
       * nishaan laga hota tha. Ab sifaarish khud text ke liye text wala preset
       * chunti hai, isliye dono taraf jawab maujood hai.
       */
      ...(scene.animationPresetId && assetId
        ? {}
        : { animationPresetId: recommendedAnimationFor(scene, at, Boolean(assetId)) }),
      /*
       * ⚠️ Text ki jagah bhi tasveer ke saath tay hoti hai, aur ye chala kar
       * dekhne par nikla: beech me rakha hua text seedha **chehre par** baith
       * jaata tha. Chaudi tasveer beech me ek patti banati hai (contain), aur
       * uske upar-neeche dhundhli jagah khaali padi rehti hai — text wahan
       * behtar baithta hai. Aadmi phir bhi badal sakta hai; ye sirf pehla
       * jawab hai, aakhri nahi.
       */
      ...(assetId && scene.textPosition === "center"
        ? { textPosition: "bottom" as const }
        : {}),
    });
  }

  /*
   * WARNING: Yahan pehle `{ thumb: true }` tha, aur wo har uploaded tasveer par
   * toota hua nishaan dikhata tha. Thumbnail sirf **bani hui reel** ka banta hai;
   * aam upload ka nahi. Us haalat me `/api/assets/[id]/url?thumb=1` saaf 404 deta
   * hai (aur wo 404 sahi hai), par UI use `<img src="">` bana kar toota hua icon
   * dikha deti thi - yaani aadmi ko lagta tha ki uski file kharab hai.
   *
   * Poori tasveer 54px ke dabbe me dikhane ka kharcha kuch bhi nahi hai.
   */
  const { url } = useAssetUrl(scene.visualAssetKind === "video" ? null : scene.visualAssetId);
  /** Video ki jhalak ke liye alag — `<img>` isme kaam nahi karta. */
  const { url: videoUrl } = useAssetUrl(
    scene.visualAssetKind === "video" ? scene.visualAssetId : null,
  );

  /*
   * ⚠️ Kuch scene tasveer maangte hain aur kuch video (`screen_recording`). Sirf
   * "image" thop dene par video wale scene ka slot bhara ja hi nahi sakta tha —
   * aur wo scene ant me "asset library me nahi mili" keh kar chhoot jaata tha,
   * bina aadmi ko theek karne ka koi raasta diye.
   */
  /*
   * WARNING: Ab DONO option hamesha dikhte hain, aur ek par "Sifaarish" ka
   * nishaan hota hai. Pehle sirf wahi ek dikhta tha jo scene type ka slot
   * maangta tha - yaani aadmi ke paas video hoti bhi to `image_audio` wale scene
   * par wo daal hi nahi sakta tha, aur use kabhi pata bhi nahi chalta ki ye ho
   * sakta hai. Chunav chhupa dena "aasan" nahi hota, wo sirf kam hota hai.
   *
   * Doosri cheez badalne par scene ka type khud badal jaata hai
   * (`effectiveType`), isliye galat jodi ban hi nahi sakti.
   */
  const suggested = visualSlotKind(scene.type) ?? "image";
  const picked = scene.visualAssetKind;

  /*
   * WARNING: Ye chetavni yahan hai, render ke baad nahi - aur wahi iska poora
   * matlab hai. Validator yahi baat pakadta hai, par tab tak aadmi saari
   * tasveerein daal chuka hota hai aur do minute ka render bhi ho chuka hota
   * hai. Yahan wo tasveer chunte hi dikh jaati hai, poore naap ke saath.
   */
  /*
   * ⚠️ Chuni hui file ka naap draft me likha jaata hai, aur wo yahin se ho sakta
   * hai — `applyWizard` core me hai aur wo asset list nahi padh sakta. Iske bina
   * fit ka faisla nahi ho sakta, aur landscape tasveer portrait frame me do guna
   * phail kar dhundhli chali jaati hai.
   */
  useEffect(() => {
    if (!source || !scene.visualAssetId) return;
    if (
      scene.visualSize &&
      scene.visualSize.width === source.width &&
      scene.visualSize.height === source.height
    ) {
      return;
    }
    onChange(scene.index, { visualSize: { width: source.width, height: source.height } });
  }, [source?.width, source?.height, scene.visualAssetId]);

  const fit = fitFor(source, project);
  const need = requiredVisualSize(scene.animationPresetId, project.width, project.height, source);
  /*
   * ⚠️ Chetavni sirf tab jab tasveer sach me phailegi. `contain` par wo chhoti
   * hoti hai, phailti nahi — wahan "kam pixel hain" likhna ek jhoothi chetavni
   * hai, aur jhoothi chetavni ka anjaam hamesha ek hi hota hai.
   */
  const tooSmall =
    fit.mode === "cover" && source && (source.width < need.width || source.height < need.height)
      ? need
      : null;

  /*
   * WARNING: File R2 me hai bhi ya nahi — ye alag sawaal hai, aur wizard ise
   * pehle poochhta hi nahi tha. DB me row ho aur file na ho (aisa har us upload
   * ke saath hua jo CORS theek hone se pehle ki thi: row ban gayi, PUT block ho
   * gaya), to `<img>` toota hua nishaan dikhata tha. Aadmi ko lagta tha ki
   * wizard kharab hai, jabki uski file wahan kabhi pahunchi hi nahi.
   *
   * Ab wo saaf likha jaata hai, dobara daalne ke raaste ke saath.
   */
  const [brokenId, setBrokenId] = useState<string | null>(null);
  const broken = brokenId !== null && brokenId === scene.visualAssetId;

  return (
    <div className="flex gap-2 rounded border border-ink-600 bg-ink-900 p-2">
      {/* Tasveer ki jhalak — 9:16 me, taaki reel me kaisi lagegi wo dikhe. */}
      <div className="flex h-24 w-[54px] shrink-0 items-center justify-center overflow-hidden rounded border border-ink-700 bg-ink-950">
        {scene.visualAssetKind === "video" && scene.visualAssetId && videoUrl ? (
          /*
           * Video ki jhalak — uska pehla frame.
           *
           * ⚠️ Pehle yahan sirf ek film ka icon tha, is dalil par ki `<img>` video
           * nahi dikha sakta. Wo dalil sahi thi par jawab adhoora: aath scene par
           * aath ek jaise icon dikhte the, aur ye batane ka koi tarika nahi tha ki
           * kis scene par kaunsi recording lagi hai. `<video preload="metadata">`
           * poori file nahi utaarta — sirf utna jitna ek frame dikhane ko chahiye.
           */
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={`${videoUrl}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : scene.visualAssetKind === "video" && scene.visualAssetId ? (
          <Film size={16} className="text-chalk-500" />
        ) : broken ? (
          <ImageOff size={14} className="text-red-400" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBrokenId(scene.visualAssetId)}
          />
        ) : (
          <ImageOff size={14} className="text-ink-500" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-chalk-500">
            Scene {at + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-300">
            {scene.text || "(koi text nahi)"}
          </span>
        </div>

        {broken ? (
          <p className="flex items-start gap-1 rounded border border-red-500/40 bg-red-500/10 px-1.5 py-1 text-[10px] leading-snug text-red-300">
            <AlertTriangle size={10} className="mt-0.5 shrink-0" />
            <span>
              Is file ka data storage me nahi mila — library me naam to hai par file nahi. Ye
              aksar us upload ke saath hota hai jo poori nahi ho paayi thi. Isse render bhi
              fail hoga: <strong>dobara daalo</strong> ya koi doosri file chuno.
            </span>
          </p>
        ) : null}

        {!broken && tooSmall && source ? (
          <p className="flex items-start gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1 text-[10px] leading-snug text-amber">
            <AlertTriangle size={10} className="mt-0.5 shrink-0" />
            <span>
              Ye tasveer <strong>{source.width}×{source.height}</strong> ki hai. Is harkat me wo{" "}
              {tooSmall.scale.toFixed(2)}x badi dikhegi, isliye dhundhli aayegi — chahiye kam se
              kam <strong>{tooSmall.width}×{tooSmall.height}</strong>. Badi tasveer daalo, ya
              harkat badal kar halki wali chuno.
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {/*
            ⚠️ **Ek hi raasta: gallery — aur upload usi ke andar** (26.24).

            Pehle yahan chaar button the: "Tasveer daalo", "Video daalo", aur
            library ke liye do chhote kind-switch. Do alag raaste hone ka nateeja
            har baar ek hi tha — aadmi upload wala button dabata tha, kyunki wo
            bada aur pehle likha tha. Wahi file har reel me dobara chadhti thi, aur
            library dhire-dhire ek hi tasveer ki chaar copy se bhar jaati thi.

            Ab pehle gallery khulti hai (jo pehle se hai wo dikhta hai), aur usi
            dialog me "Nayi file upload karo" hai. Chadhi hui file library me jaati
            hai, isliye agli baar wo wahin milti hai — aur ye baat dialog me likhi
            bhi hai.

            ⚠️ Kism ab picker se lautti hai (`onPick` ka doosra hissa), yahan ke
            kisi switch se nahi. Pehle wo "aakhri bar kaunsa button daba tha" se
            aati thi, aur wo andaaza galat ho jaane par `image` ka item ek video ki
            id le kar baith jaata tha — render me khaali frame, bina kisi error ke.
          */}
          <div className="min-w-0 flex-1">
            <AssetPickerButton
              kind={picked ?? suggested}
              kinds={["image", "video"]}
              allowUpload
              uploadTags={["wizard"]}
              assetId={scene.visualAssetId}
              onPick={(assetId, kind) =>
                setImage(assetId, kind === "video" ? "video" : "image")
              }
            />
          </div>

          {scene.visualAssetId ? (
            <button
              type="button"
              onClick={() => setImage(null)}
              className="rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
            >
              Hata do
            </button>
          ) : (
            <span className="text-[10px] text-chalk-500">
              ya chhod do — text wala scene ban jaayega
            </span>
          )}
        </div>

        {/*
          ⚠️ Harkat ka chunav ab **hamesha** dikhta hai, tasveer ho ya na ho.

          Pehle wo sirf tasveer wale scene par tha, is dalil par ki bina tasveer
          ke preset TEXT par lag jaayega. Us dalil ki keemat chala kar dekhne par
          samajh aayi: jis reel me tasveerein nahi thi (yaani shuru ki har reel),
          usme 30 second tak koi harkat thi hi nahi — har line achanak aati thi
          aur achanak chali jaati thi. Aur us aadmi ke paas use theek karne ka
          koi raasta bhi nahi tha, kyunki chunav dikhta hi nahi tha.

          Ab sifaarish khud text ke liye text wala preset deti hai (neeche se
          aana / uchhal kar aana), aur zoom wale sirf tab jab tasveer ho.
        */}
        <ChoicePicker
          kind="animation"
          value={scene.animationPresetId}
          recommended={recommendedAnimation}
          onPick={(id) => onChange(scene.index, { animationPresetId: id })}
        />

        {/*
          Rang / effect — **harkat ke theek neeche** (26.24).

          ⚠️ Ye chunav wizard me tha hi nahi, jabki editor me hai (Effects panel).
          Nateeja ye tha ki wizard se bani reel me har tasveer jaisi ki waisi lagti
          thi, aur use badalne ke liye aadmi ko poora editor sikhna padta — yaani
          theek wo cheez jisse bachne ke liye wizard bana hai.

          ⚠️ Iski koi "Sifaarish" nahi hai, aur wo jaan-boojhkar hai. Har scene par
          apne aap ek effect laga dena poori reel ka rang badal deta hai, aur aadmi
          ko wajah kabhi samajh nahi aati ("meri tasveerein aisi thi hi nahi").
          Harkat ka na hona reel ko mari hui bana deta hai; rang ka na hona nahi.

          ⚠️ Sirf tasveer/video wale scene par. Bina tasveer ke effect **text** par
          lagta hai, aur wahan "Safed-kaala" ka matlab hota safed text ka bhoora
          pad jaana — ek chunav jo dabta hai aur ulta nateeja deta hai.
        */}
        {scene.visualAssetId ? (
          <ChoicePicker
            kind="effect"
            value={scene.effectPresetId ?? "none"}
            recommended={null}
            onPick={(id) =>
              onChange(scene.index, { effectPresetId: id === "none" ? null : id })
            }
          />
        ) : null}

        {/*
          Fit ka faisla saaf likha hua — warna wo chup-chaap hota hai aur aadmi ko
          lagta hai ki uski tasveer "apne aap chhoti ho gayi".
        */}
        {scene.visualAssetId && fit.mode === "contain" ? (
          <p className="text-[10px] leading-snug text-chalk-500">
            Ye tasveer frame se chaudi hai — poori dikhegi, aur kinare usi tasveer ke dhundhle
            roop se bharenge. Cover karne par ise{" "}
            {(Math.max(project.width / (source?.width ?? 1), project.height / (source?.height ?? 1))).toFixed(1)}x
            phailana padta, jisme wo saaf nahi rehti.
          </p>
        ) : null}

        {/*
          Phone frame — sirf video par.

          ⚠️ Sifaarish saath me likhi hai kyunki ye chunav dekhe bina samajh nahi
          aata: app ki recording frame ke andar SAAF dikhti hai (58% chaudai par
          1.62x, poore frame me 2.26x), par camera ki footage phone ke andar chipki
          hui ajeeb lagti hai.
        */}
        {scene.visualAssetKind === "video" && scene.visualAssetId ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(scene.index, { phoneFrame: !scene.phoneFrame })}
              className={clsx(
                "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                scene.phoneFrame
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              <Smartphone size={9} />
              Phone frame {scene.phoneFrame ? "lagega" : "nahi"}
            </button>
            <span className="min-w-0 flex-1 text-[10px] text-chalk-500">
              App ki screen recording ho to lagao — frame ke andar likha hua saaf padha jaata
              hai. Camera se banayi video ho to rehne do.
            </span>
          </div>
        ) : null}

        {/* Video ho to uska chuna hua hissa saaf dikhe, aur badla ja sake. */}
        {scene.visualAssetKind === "video" && scene.visualAssetId ? (
          <button
            type="button"
            onClick={() => setTrimFor(scene.visualAssetId)}
            className="flex items-center gap-1 text-[10px] text-chalk-400 transition-colors hover:text-chalk-100"
          >
            <Film size={9} />
            {scene.visualTrim
              ? `${scene.visualTrim.startSeconds.toFixed(1)}s se ${scene.visualTrim.endSeconds.toFixed(1)}s`
              : "poori video"}
            <span className="underline">badlo</span>
          </button>
        ) : null}

        <VideoTrimDialog
          open={trimFor !== null}
          assetId={trimFor}
          sceneSeconds={scene.durationSeconds}
          fallbackSeconds={sourceSeconds}
          value={scene.visualTrim}
          onCancel={() => setTrimFor(null)}
          onSave={(trim) => {
            onChange(scene.index, { visualTrim: trim });
            setTrimFor(null);
          }}
        />

        {at > 0 ? (
          <ChoicePicker
            kind="transition"
            value={scene.transitionId}
            recommended={recommendedTransition}
            onPick={(id) => onChange(scene.index, { transitionId: id })}
          />
        ) : null}
      </div>
    </div>
  );
}

export function StepImage({
  draft,
  onChange,
}: {
  draft: WizardDraft;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const project = useEditorStore((state) => state.doc.project);
  // Wahi hook jo Export dialog chalata hai — asset ka asli naap ek hi jagah se.
  const meta = useAssetDurations(project.fps);
  const live = draft.scenes.filter((scene) => !scene.removed);

  return (
    <>
      {live.map((scene, at) => (
        <SceneRow
          key={scene.index}
          scene={scene}
          at={at}
          /*
           * Sifaarish yahin naapi jaati hai, har render par — aur wo sasta hai
           * (do `if`). Draft me jama karne par wo purani pad jaati: tasveer
           * daalte hi sahi sifaarish badal jaati hai, par nishaan purane par
           * laga rehta.
           */
          recommendedAnimation={recommendedAnimationFor(scene, at, Boolean(scene.visualAssetId))}
          recommendedTransition={suggestTransition(
            at,
            Boolean(scene.visualAssetId),
            Boolean(live[at - 1]?.visualAssetId),
          )}
          source={meta.loaded ? meta.sourceSize(scene.visualAssetId) : null}
          sourceSeconds={
            meta.loaded && scene.visualAssetId
              ? (meta.sourceFrames(scene.visualAssetId) ?? null) &&
                (meta.sourceFrames(scene.visualAssetId) as number) / project.fps
              : null
          }
          project={{ width: project.width, height: project.height }}
          onChange={onChange}
        />
      ))}
    </>
  );
}
