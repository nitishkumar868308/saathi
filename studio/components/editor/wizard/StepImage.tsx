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
import {
  AlertTriangle,
  Film,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Smartphone,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { ChoicePicker } from "@/components/editor/wizard/ChoicePicker";
import { VideoTrimDialog } from "@/components/editor/wizard/VideoTrimDialog";
import { useAssetUrl } from "@/lib/assetUrls";
import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";
import { useUploader } from "@/lib/upload/uploader";

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
 * ⚠️ Har qatar ka **apna** uploader hai, aur ye jaan-boojhkar hai. Ek saanjha
 * uploader rakhne par ye sawaal bacha reh jaata hai ki jo file abhi chadhi wo
 * **kis scene** ki thi — `addFiles()` koi id nahi lautata. Us sawaal ka jawab
 * "aakhri wala scene" maan kar dena bilkul chalta dikhta hai aur do file ek
 * saath chunne par chup-chaap galat scene par tasveer laga deta hai.
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
  const input = useRef<HTMLInputElement>(null);

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

  /** Kaunsa button daba tha — file aane par yahi kind lagti hai. */
  const uploadKind = useRef<"image" | "video">("image");
  const uploader = useUploader({
    tags: ["wizard"],
    onFinished: ({ assetId }) => setImage(assetId, uploadKind.current),
  });
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
  /** Library me kya dhoondhna hai — `null` = jo is scene ke liye theek hai. */
  const [libKind, setLibKind] = useState<"image" | "video" | null>(null);

  const [brokenId, setBrokenId] = useState<string | null>(null);
  const broken = brokenId !== null && brokenId === scene.visualAssetId;

  const task = uploader.tasks[uploader.tasks.length - 1];
  const uploading = task && task.phase !== "done" && task.phase !== "duplicate" && task.phase !== "error";

  return (
    <div className="flex gap-2 rounded border border-ink-600 bg-ink-900 p-2">
      {/* Tasveer ki jhalak — 9:16 me, taaki reel me kaisi lagegi wo dikhe. */}
      <div className="flex h-24 w-[54px] shrink-0 items-center justify-center overflow-hidden rounded border border-ink-700 bg-ink-950">
        {uploading ? (
          <Loader2 size={14} className="animate-spin text-chalk-500" />
        ) : scene.visualAssetKind === "video" && scene.visualAssetId ? (
          // Video ko <img> me dikhaya nahi ja sakta — uska apna nishaan.
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

        {task?.phase === "error" ? (
          <p className="text-[10px] text-red-300">{task.error}</p>
        ) : null}

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
          <input
            ref={input}
            type="file"
            accept={uploadKind.current === "video" ? "video/*" : "image/*"}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploader.addFiles([file]);
              // Wahi file dobara chunne par `change` nahi chalta — isliye khaali.
              event.target.value = "";
            }}
          />

          {(["image", "video"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                uploadKind.current = kind;
                input.current?.click();
              }}
              title={
                kind === suggested
                  ? "Is scene ke liye yahi sabse theek baithta hai"
                  : "Ye bhi chal jaayega — scene ka type apne aap badal jaayega"
              }
              className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100"
            >
              {kind === "video" ? <Film size={9} /> : <Upload size={9} />}
              {kind === "video" ? "Video daalo" : "Tasveer daalo"}
              {kind === suggested ? (
                <span className="rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
                  Sifaarish
                </span>
              ) : null}
            </button>
          ))}

          {/*
            ⚠️ Library ke liye kind ka apna switch hai, aur ye chala kar dekhne par
            joda gaya. Pehle picker `picked ?? suggested` par chalta tha — yaani
            jis scene ki sifaarish "tasveer" thi, wahan library me **sirf tasveerein**
            dikhti thi. Aadmi apni recording pehle hi library me daal chuka ho, to
            bhi wo use nahi kar sakta tha; uske paas ek hi raasta bachta tha — wahi
            file dobara upload karna. Upload ke do button the, par library ka ek hi.
          */}
          <div className="flex items-center gap-0.5">
            {(["image", "video"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setLibKind(kind)}
                title={kind === "video" ? "Library me video dikhao" : "Library me tasveerein dikhao"}
                className={clsx(
                  "rounded border px-1 py-1 text-[10px] transition-colors",
                  (libKind ?? picked ?? suggested) === kind
                    ? "border-terracotta bg-terracotta/10 text-chalk-100"
                    : "border-ink-600 text-chalk-500 hover:border-chalk-500",
                )}
              >
                {kind === "video" ? <Film size={9} /> : <ImageIcon size={9} />}
              </button>
            ))}
          </div>

          <div className="min-w-0 max-w-[130px] flex-1">
            <AssetPickerButton
              kind={libKind ?? picked ?? suggested}
              assetId={scene.visualAssetId}
              onPick={(assetId) => setImage(assetId, libKind ?? picked ?? suggested)}
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
