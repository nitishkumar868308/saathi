"use client";

import {
  listAnimations,
  listTransitions,
  primarySceneItem,
  type Scene,
} from "@reel/core";

import { useEditorStore } from "@/lib/store";

/**
 * Scene-level animation aur transition (12.11).
 *
 * ⚠️ **Ye koi naya engine nahi hai.** Dono dropdown wahi ops chalate hain jo
 * Properties panel me item par chalte hain — `addAnimation` aur `setTransition`.
 * Scene ka apna animation system banane par ek din scene wala aur item wala
 * animation aamne-saamne aa jaate, aur "kaun jeetega" ka jawab kisi ko pata nahi
 * hota. Yahan sirf ek sawaal ka jawab diya gaya hai: **kis item par lagega.**
 *
 * ⚠️ Us sawaal ka jawab `primarySceneItem()` me hai, is file me nahi — aur wo
 * jaan-boojhkar core me rakha gaya hai, uske apne test ke saath. Yahi wo faisla
 * hai jiski wajah se 12.11 ruka hua tha: `image_audio` scene me teen item hote
 * hain, aur agar animation caption ya awaaz par lag jaye to user ko lagta hai
 * kuch hua hi nahi.
 *
 * ⚠️ Jis scene me dikhne layak kuch nahi (sirf awaaz), wahan dropdown **dikhta
 * hi nahi** — uski jagah ek line likhi hoti hai. Ek dropdown jo dabane par kuch
 * na kare, toote hue button jaisa hi hai (README rule 5).
 */
export function SceneAnimation({ scene }: { scene: Scene }) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const primary = primarySceneItem(doc, scene.id);

  if (!primary) {
    return (
      <p className="border-t border-ink-700 pt-2 text-[10px] text-chalk-500">
        Is scene me dikhne wali koi cheez nahi hai — animation lagane ke liye pehle tasveer,
        video ya text jodo.
      </p>
    );
  }

  const currentAnimation = primary.animations[0]?.type ?? "";
  const currentTransition = primary.transitionIn?.type ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-2">
      <label className="flex items-center gap-1 text-[11px] text-chalk-500">
        Animation
        <select
          value={currentAnimation}
          title={`"${primary.name}" par lagegi — scene me yahi cheez sabse peeche dikhti hai`}
          onChange={(event) => {
            const id = event.target.value;
            if (!id) {
              /*
               * "Koi nahi" chunne par purani animation hatti hai. Bina iske user
               * ke paas wapas jaane ka koi raasta nahi hota — sirf Ctrl+Z, jo
               * do-teen edit baad kaam nahi karta.
               */
              if (primary.animations[0]) {
                applyOp(
                  "removeAnimation",
                  { itemId: primary.id, index: 0 },
                  { label: "Scene ki animation hatai" },
                );
              }
              return;
            }
            /*
             * ⚠️ `addAnimation` — `applyAnimationPreset` **nahi**. Dono alag list
             * par chalte hain: preset ek jama-jamaya set hai (`ANIMATION_PRESETS`),
             * aur `listAnimations()` ek-ek animation deti hai. Pehle yahan preset
             * wala op tha aur dropdown animation ki id bhejta tha — op chup-chaap
             * kuch nahi karta tha aur select wapas "Koi nahi" par aa jaata tha.
             * Browser me pakda gaya (transition lag rahi thi, animation nahi).
             *
             * Purani animation pehle hatti hai taaki dropdown ek **chunav** rahe,
             * dher na ban jaye — panel me "aur jodo" ka apna raasta pehle se hai.
             */
            if (primary.animations[0]) {
              applyOp(
                "removeAnimation",
                { itemId: primary.id, index: 0 },
                { label: "Purani animation hatai" },
              );
            }
            applyOp(
              "addAnimation",
              { itemIds: [primary.id], typeId: id },
              { label: `Scene: ${id}` },
            );
          }}
          className="rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-[11px] outline-none focus:border-terracotta"
        >
          <option value="">Koi nahi</option>
          {listAnimations().map((entry) => (
            <option key={entry.id} value={entry.id} title={entry.hint}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 text-[11px] text-chalk-500">
        Aane par
        <select
          value={currentTransition}
          title="Pichhle scene se is scene me aate waqt kya ho"
          onChange={(event) =>
            applyOp(
              "setTransition",
              { itemIds: [primary.id], side: "in", type: event.target.value || "none" },
              { label: "Scene ka transition" },
            )
          }
          className="rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-[11px] outline-none focus:border-terracotta"
        >
          {listTransitions().map((entry) => (
            <option key={entry.id} value={entry.id} title={entry.hint}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      {/*
        Kis item par lag raha hai, ye chhupaya nahi jaata. Scene me teen clip hoti
        hain aur "animation kahan lagi" ka jawab bina iske sirf preview dekh kar
        andaazna padta.
      */}
      <span className="text-[10px] text-chalk-500" title="Scene ka primary item">
        → {primary.name}
      </span>
    </div>
  );
}
