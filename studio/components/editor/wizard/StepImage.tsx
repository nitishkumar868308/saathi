"use client";

import {
  suggestAnimation,
  suggestTransition,
  visualSlotKind,
  type WizardDraft,
  type WizardScene,
} from "@reel/core";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { useRef } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { ChoicePicker } from "@/components/editor/wizard/ChoicePicker";
import { useAssetUrl } from "@/lib/assetUrls";
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
function recommendedAnimationFor(scene: WizardScene, at: number): string | null {
  return suggestAnimation(
    { type: scene.type, text: scene.text, hasImage: true },
    at,
  );
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
  onChange,
}: {
  scene: WizardScene;
  at: number;
  recommendedAnimation: string | null;
  recommendedTransition: string;
  onChange(index: number, patch: Partial<WizardScene>): void;
}) {
  const input = useRef<HTMLInputElement>(null);

  /**
   * Tasveer lagti/hatti hai to **harkat bhi saath me** tay hoti hai.
   *
   * ⚠️ Ye chala kar dekhne par nikla. Wizard khulte hi `autoFill` chalta hai, us
   * waqt kisi scene par tasveer nahi hoti, isliye `suggestAnimation` sahi hi
   * `null` deta hai. Phir aadmi tasveer daalta hai — aur "Harkat" ka khaana
   * **khaali** reh jaata hai, jabki uske bagal me "Sifaarish" ka nishaan laga
   * hota hai. Yaani screen ek sujhav dikhati hai jo laga hi nahi. Design ka
   * vaada iska ulta tha: "apne aap chun jaata hai, badalna ek tap".
   *
   * ⚠️ Aur ulta bhi utna hi zaroori hai: tasveer hata dene par harkat **hat
   * jaani chahiye**. Warna wo harkat text par jaakar lagti hai, aur hilta hua
   * text ajeeb dikhta hai — theek wahi cheez jisse bachne ke liye
   * `suggestAnimation` bina tasveer ke `null` deta hai.
   */
  function setImage(assetId: string | null): void {
    onChange(scene.index, {
      visualAssetId: assetId,
      ...(assetId
        ? scene.animationPresetId
          ? {}
          : { animationPresetId: recommendedAnimationFor(scene, at) }
        : { animationPresetId: null }),
    });
  }

  const uploader = useUploader({
    tags: ["wizard"],
    onFinished: ({ assetId }) => setImage(assetId),
  });
  const { url } = useAssetUrl(scene.visualAssetId, { thumb: true });

  /*
   * ⚠️ Kuch scene tasveer maangte hain aur kuch video (`screen_recording`). Sirf
   * "image" thop dene par video wale scene ka slot bhara ja hi nahi sakta tha —
   * aur wo scene ant me "asset library me nahi mili" keh kar chhoot jaata tha,
   * bina aadmi ko theek karne ka koi raasta diye.
   */
  const want = visualSlotKind(scene.type) ?? "image";
  const wantLabel = want === "video" ? "Video daalo" : "Tasveer daalo";

  const task = uploader.tasks[uploader.tasks.length - 1];
  const uploading = task && task.phase !== "done" && task.phase !== "duplicate" && task.phase !== "error";

  return (
    <div className="flex gap-2 rounded border border-ink-600 bg-ink-900 p-2">
      {/* Tasveer ki jhalak — 9:16 me, taaki reel me kaisi lagegi wo dikhe. */}
      <div className="flex h-24 w-[54px] shrink-0 items-center justify-center overflow-hidden rounded border border-ink-700 bg-ink-950">
        {uploading ? (
          <Loader2 size={14} className="animate-spin text-chalk-500" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
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

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={input}
            type="file"
            accept={want === "video" ? "video/*" : "image/*"}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploader.addFiles([file]);
              // Wahi file dobara chunne par `change` nahi chalta — isliye khaali.
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center gap-1 rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100"
          >
            <Upload size={9} />
            {wantLabel}
          </button>

          <div className="min-w-0 max-w-[150px] flex-1">
            <AssetPickerButton
              kind={want}
              assetId={scene.visualAssetId}
              onPick={(assetId) => setImage(assetId)}
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
          ⚠️ Harkat ka chunav sirf tab dikhta hai jab tasveer ho. Bina tasveer ke
          wo TEXT par lagti, aur hilta hua text ajeeb lagta hai — `suggestAnimation`
          bhi wahan `null` deta hai. Ek chunav jo dabane par kuch galat kare, us
          chunav se bura hai jo hai hi nahi.
        */}
        {scene.visualAssetId ? (
          <ChoicePicker
            kind="animation"
            value={scene.animationPresetId}
            recommended={recommendedAnimation}
            onPick={(id) => onChange(scene.index, { animationPresetId: id })}
          />
        ) : null}

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
          recommendedAnimation={suggestAnimation(
            {
              type: scene.type,
              text: scene.text,
              hasImage: Boolean(scene.visualAssetId),
            },
            at,
          )}
          recommendedTransition={suggestTransition(
            at,
            Boolean(scene.visualAssetId),
            Boolean(live[at - 1]?.visualAssetId),
          )}
          onChange={onChange}
        />
      ))}
    </>
  );
}
