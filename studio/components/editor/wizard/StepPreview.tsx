"use client";

import {
  MUSIC_LEVELS,
  MUSIC_LEVEL_DEFAULT,
  NO_TWEAK,
  SCENE_MUSIC_LEVELS,
  VOICE_LEVELS,
  VOICE_RATES,
  applyWizard,
  autoFill,
  draftTotalSeconds,
  effectiveType,
  elementKeyMap,
  plainAnimation,
  plainEffect,
  primaryOfScene,
  sameLevel,
  sceneItemsInOrder,
  suggestAnimation,
  tweakIsEmpty,
  type Item,
  type SceneTweak,
  type WizardDraft,
  type WizardLevel,
  type WizardScene,
} from "@reel/core";
import { ReelComposition } from "@reel/remotion";
import { Player, type PlayerRef } from "@remotion/player";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { ChoicePicker } from "@/components/editor/wizard/ChoicePicker";
import { useAssetMap } from "@/lib/assetMap";
import { useFonts } from "@/lib/fonts";
import { useEditorStore } from "@/lib/store";

/**
 * Step 4 — **Dekho**, aur yahin se sudhaaro (26.10 / 26.28).
 *
 * ⚠️ Ye reel **sach me chal kar** dikhti hai, koi tasveeron ki list nahi. Wajah
 * seedhi hai: is wizard ka poora vaada hi ye hai ki aadmi ko editor sikhna na
 * pade. Aakhir me use "8 scene ban jaayenge" likh kar bhej dena us vaade ko
 * aakhri kadam par tod deta — timing, awaaz, aur harkat wo teen cheezein hain
 * jo likh kar kabhi samajh nahi aati.
 *
 * ⚠️ **Aur yahan se badla bhi ja sakta hai.** Pehle ye step sirf dikhata tha,
 * aur wahi uski sabse badi kami thi: aadmi reel chala kar dekhta, use lagta ki
 * "wo tasveer thodi badi honi chahiye", aur uske paas do hi raaste bachte the —
 * peeche jaakar us scene ko qatar ki list me dhoondhna, ya poora editor kholna.
 * Jo cheez dikh rahi ho use wahin chhoo kar theek karna hi sabse seedha raasta
 * hai — isliye ab reel me kisi bhi cheez par click karo, wo chun jaati hai aur
 * uske saare chunav bagal me khul jaate hain.
 *
 * ⚠️ **Yahan doc me kuch likha nahi jaata.** `applyWizard` ek naya doc lauta ta
 * hai (pure function), aur wo sirf is Player ko diya jaata hai. Har sudhaar
 * `draft` me jaata hai (`scene.tweaks`), doc me nahi — project ka apna doc waisa
 * ka waisa rehta hai jab tak aadmi "Editor me daalo" na dabaye.
 *
 * ⚠️ Aur ye editor wale `PreviewPlayer` se alag hai, jaan-boojhkar. Wo store ke
 * playhead, zoom tool aur playback se juda hua hai — usse yahan chalane ka matlab
 * hota ki wizard ka preview chalate hi editor ka playhead hilne lage, jabki
 * aadmi ne project me abhi kuch kiya bhi nahi.
 */

/** Ek tap me naap kitni badhe/ghate. */
const SCALE_STEP = 0.1;
const SCALE_MIN = 0.2;
const SCALE_MAX = 4;

/** Ek tap me kitna khiske — frame ke naap ka hissa, pixel nahi. */
const NUDGE_PERCENT = 0.03;

const ROTATION_STEP = 5;
const ROTATION_LIMIT = 180;

const OPACITY_STEP = 0.1;
const OPACITY_MIN = 0.1;

/**
 * Item ke type ka aam bhasha wala naam.
 *
 * ⚠️ `item.name` yahan jaan-boojhkar nahi dikhta. Wo caption ke pehle 40 akshar
 * hote hain ("Papa ne kabhi bataya nahi ki…"), jo panel ke sar par ek poori line
 * kha jaata hai aur ye batata bhi nahi ki chuni hui cheez hai kya. Type ka naam
 * chhota hai aur wahi sawaal ka jawab deta hai.
 */
const ELEMENT_NAMES: Record<string, string> = {
  image: "Tasveer",
  video: "Video",
  text: "Likha hua",
  shape: "Patti",
  subtitle: "Caption",
  audio: "Awaaz",
};

function elementName(item: Item): string {
  return ELEMENT_NAMES[item.type] ?? item.type;
}

/**
 * Ye element us jagah **kuch chhaapta** hai ya sirf ek khaali parat hai?
 *
 * ⚠️ Ye poore click-to-select ki jaan hai. Har item ek `AbsoluteFill` hai — yaani
 * poore frame jitna bada, chahe usme ek chhota sa shabd ho. Sirf "sabse upar wala
 * element" uthane par har click hamesha aakhri item par jaata (aksar caption),
 * aur tasveer kabhi chuni hi nahi ja sakti thi.
 *
 * Isliye click ke neeche padi saari parton me se **pehli aisi** chuni jaati hai
 * jo us bindu par sach me kuch dikhati hai: media, likha hua, ya apna rang. Wahi
 * cheez aankh bhi wahan dekh rahi hoti hai.
 */
function paintsSomething(element: Element): boolean {
  const tag = element.tagName;
  if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "svg") return true;

  const hasOwnText = Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
  );
  if (hasOwnText) return true;

  const style = window.getComputedStyle(element);
  if (style.backgroundImage !== "none") return true;

  const background = style.backgroundColor;
  return background !== "" && background !== "transparent" && !background.endsWith(", 0)");
}

/** Click ke neeche kaunsa item hai — aur uska wo hissa jo wahan dikh raha hai. */
function hitTest(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
): { element: Element; itemId: string } | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    if (!stage.contains(element)) continue;
    if (!paintsSomething(element)) continue;

    /*
     * ⚠️ Yahan `null` lautana zaroori hai, `continue` nahi. Sabse upar jo cheez
     * dikh rahi hai wo Player ki apni patti bhi ho sakti hai (play/pause). Uske
     * neeche khodte rehne par us patti par click karte hi peeche wali tasveer
     * chun jaati aur play ka button dabta hi nahi.
     */
    const owner = element.closest("[data-reel-item]");
    const itemId = owner?.getAttribute("data-reel-item");
    return itemId ? { element, itemId } : null;
  }
  return null;
}

/** Naam wale level ka ek qatar — awaaz, raftaar, music, teeno isi se bante hain. */
function LevelRow({
  label,
  levels,
  value,
  onPick,
}: {
  label: string;
  levels: readonly WizardLevel[];
  value: number | null;
  onPick(next: number | null): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-full text-[10px] text-chalk-500">{label}</span>
      {levels.map((entry) => (
        <button
          key={entry.label}
          type="button"
          title={entry.when}
          onClick={() => onPick(entry.value)}
          className={clsx(
            "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
            sameLevel(value, entry.value)
              ? "border-terracotta bg-terracotta/10 text-chalk-100"
              : "border-ink-600 text-chalk-400 hover:border-chalk-500",
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** Panel ka chhota button — sab jagah ek jaisa. */
function Tap({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick(): void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx(
        "flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] transition-colors",
        active
          ? "border-terracotta bg-terracotta/10 text-chalk-100"
          : "border-ink-600 text-chalk-400 hover:border-chalk-500 hover:text-chalk-100",
      )}
    >
      {children}
    </button>
  );
}

export function StepPreview({
  draft,
  onChange,
  onMusicVolume,
}: {
  draft: WizardDraft;
  /** Wahi `update` jo baaki step chalate hain — sab kuch draft me hi jaata hai. */
  onChange(index: number, patch: Partial<WizardScene>): void;
  /** Poori reel ke music ka level — scene wale se alag cheez hai. */
  onMusicVolume(volume: number): void;
}) {
  const doc = useEditorStore((state) => state.doc);

  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Chuni hui cheez ka wo DOM hissa jo click ke neeche tha — nishaan isi par banta hai. */
  const markedRef = useRef<Element | null>(null);

  /**
   * Chuni hui cheez — **scene ka number aur element ki pehchaan**, item ki id nahi.
   *
   * ⚠️ Id yahan kaam nahi karti: har badlav par `applyWizard` poora doc naye sire
   * se banata hai aur har item ko nayi id milti hai. Id yaad rakhne par pehla hi
   * sudhaar apni hi chuni hui cheez ko gum kar deta — aadmi ek tap karta aur
   * panel gayab ho jaata.
   */
  const [picked, setPicked] = useState<{ sceneIndex: number; key: string } | null>(null);
  const [mark, setMark] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );

  /*
   * `autoFill` yahan bhi — aadmi seedha is step par aa sakta hai bina kuch chune.
   * Bina iske preview me transition hote hi nahi aur reel ka katna jhatke jaisa
   * dikhta, jabki asli reel me wo aisa nahi hoga.
   */
  const built = useMemo(() => {
    try {
      return applyWizard({ doc, draft: autoFill(draft) });
    } catch {
      return null;
    }
  }, [doc, draft]);

  const previewDoc = built?.doc ?? null;

  const { assets, missing } = useAssetMap(previewDoc ?? doc);
  const { fonts } = useFonts(previewDoc ?? doc);
  const inputProps = useMemo(
    () => ({ doc: previewDoc ?? doc, assets, fonts }),
    [previewDoc, doc, assets, fonts],
  );

  /**
   * Chuni hui cheez ka abhi ka roop — har render me naye sire se dhoondhi jaati hai.
   *
   * ⚠️ Ye `useMemo` me isliye hai ki iske andar ka har jawab (kaunsa scene, kaunsa
   * item, wo primary hai ya nahi) preview ke naye doc se aata hai. State me rakhne
   * par wo purane doc ka reh jaata aur panel ek badlav peeche chalta.
   */
  const selection = useMemo(() => {
    if (!picked || !built || !previewDoc) return null;

    const scene = previewDoc.scenes.find(
      (entry) => built.sceneIndexById[entry.id] === picked.sceneIndex,
    );
    if (!scene) return null;

    const items = sceneItemsInOrder(previewDoc.items, scene);
    const keys = elementKeyMap(items);
    const item = items.find((entry) => keys[entry.id] === picked.key) ?? null;
    if (!item) return null;

    const primary = primaryOfScene(previewDoc.items, scene);
    const draftScene = draft.scenes.find((entry) => entry.index === picked.sceneIndex) ?? null;
    if (!draftScene) return null;

    /** Bache hue scenes me ye kaunse number par hai — sifaarish isi se banti hai. */
    const at = draft.scenes.filter((entry) => !entry.removed).indexOf(draftScene);

    return {
      item,
      draftScene,
      at,
      /*
       * Harkat aur rang dono `primary` par lagte hain (dekho `applyWizard`).
       * Isliye wo do chunav sirf usi cheez ke saath dikhte hain — baaki par wo
       * button dabte to hain par kuch nahi karte.
       */
      isPrimary: primary !== null && keys[primary.id] === picked.key,
    };
  }, [picked, built, previewDoc, draft]);

  const tweak: SceneTweak = selection?.draftScene.tweaks?.[picked?.key ?? ""] ?? NO_TWEAK;

  /*
   * Nishaan ka naap har frame par — kyunki chuni hui cheez khud hil rahi hoti hai.
   *
   * ⚠️ Ek baar naap kar rakh lena kaafi nahi tha: zoom aur slide jaisi harkatein
   * har frame par item ki jagah badalti hain, aur reel chalte hi nishaan apni
   * purani jagah par chipka reh jaata tha — jo "toota hua" dikhta hai. State tabhi
   * badalti hai jab naap sach me badla ho, isliye chup reel par ye ek khaali
   * `requestAnimationFrame` se zyada kuch nahi hai.
   */
  useEffect(() => {
    if (!picked) {
      setMark(null);
      return;
    }

    let raf = 0;
    const tick = (): void => {
      const stage = stageRef.current;
      const marked = markedRef.current;

      if (stage && marked && marked.isConnected) {
        const box = marked.getBoundingClientRect();
        const base = stage.getBoundingClientRect();
        const next = {
          left: box.left - base.left,
          top: box.top - base.top,
          width: box.width,
          height: box.height,
        };
        setMark((was) =>
          was &&
          Math.abs(was.left - next.left) < 0.5 &&
          Math.abs(was.top - next.top) < 0.5 &&
          Math.abs(was.width - next.width) < 0.5 &&
          Math.abs(was.height - next.height) < 0.5
            ? was
            : next,
        );
      } else {
        setMark((was) => (was === null ? was : null));
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [picked]);

  /**
   * Reel par click — chuno, aur reel rok do.
   *
   * ⚠️ Rokna zaroori hai. Chalti hui reel par kuch chun kar uska naap badalna wo
   * kaam hai jo aankh se ho hi nahi sakta — badlav us frame par dikhta hai jo tab
   * tak nikal chuka hota hai. Rukne se hi sudhaar dikhta hai.
   */
  function handleStageClick(event: React.MouseEvent<HTMLDivElement>): void {
    const stage = stageRef.current;
    if (!stage || !built || !previewDoc) return;

    const hit = hitTest(stage, event.clientX, event.clientY);
    // Player ki apni patti (play/pause) — click use hi jaana chahiye.
    if (!hit) return;

    const item = previewDoc.items.find((entry) => entry.id === hit.itemId);
    const scene = previewDoc.scenes.find((entry) => entry.id === item?.sceneId);
    if (!item || !scene) return;

    const sceneIndex = built.sceneIndexById[scene.id];
    if (sceneIndex === undefined) return;

    const key = elementKeyMap(sceneItemsInOrder(previewDoc.items, scene))[item.id];
    if (!key) return;

    event.preventDefault();
    event.stopPropagation();
    playerRef.current?.pause();
    markedRef.current = hit.element;
    setPicked({ sceneIndex, key });
  }

  /** Chuni hui cheez par ek sudhaar — khaali ho jaane par khaana hi hat jaata hai. */
  function patchTweak(patch: Partial<SceneTweak>): void {
    if (!picked || !selection) return;

    const tweaks = { ...(selection.draftScene.tweaks ?? {}) };
    const next: SceneTweak = { ...(tweaks[picked.key] ?? NO_TWEAK), ...patch };

    /*
     * ⚠️ Khaali tweak record me rakhna galat nahi dikhta par galat hai: "yahan
     * kuch haath se badla hai" ka jawab har jagah `Object.keys().length` se milta
     * hai — band karte waqt ki tasdeek me bhi. Ek khaali khaana us jawab ko jhootha
     * kar deta hai, aur aadmi ko bina wajah "kaam chala jaayega" wali chetavni
     * milti hai.
     */
    if (tweakIsEmpty(next)) delete tweaks[picked.key];
    else tweaks[picked.key] = next;

    onChange(picked.sceneIndex, { tweaks });
  }

  if (!built || !previewDoc || built.applied === 0) {
    return (
      <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
        Abhi dikhane layak kuch nahi bana. Har scene me kam se kam text hona chahiye — peeche
        jaakar dekh lo.
      </p>
    );
  }

  const { width, height, fps, durationInFrames } = previewDoc.project;
  /*
   * ⚠️ Wahi ek hisaab jo footer me dikhta hai aur jo `applyWizard` lagata hai
   * (`draftTotalSeconds` — gap samet). Yahan alag se jodne par preview "26s"
   * likhta aur reel 29s ki banti, aur wo farak sirf export ke baad pakda jaata.
   */
  const wizardSeconds = draftTotalSeconds(draft);
  const hasOld = previewDoc.scenes.length > built.applied;

  const nudgeX = Math.round(width * NUDGE_PERCENT);
  const nudgeY = Math.round(height * NUDGE_PERCENT);

  const scene = selection?.draftScene ?? null;
  const sceneMusicId = scene ? (scene.musicAssetId ?? draft.musicAssetId) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-[200px] shrink-0 space-y-2">
          {/*
            ⚠️ Click capture par pakda jaata hai, bubble par nahi. Player apne
            container par khud click sunta hai (play/pause) — bubble par baithne
            se pehle wo chal jaata, aur har baar kuch chunte hi reel bhi chalne
            lagti. Capture me `stopPropagation` karke hi ye do cheezein alag
            rakhi ja sakti hain.
          */}
          <div
            ref={stageRef}
            onClickCapture={handleStageClick}
            className="relative overflow-hidden rounded border border-ink-600 bg-black"
          >
            <Player
              ref={playerRef}
              component={ReelComposition}
              inputProps={inputProps}
              durationInFrames={Math.max(1, durationInFrames)}
              compositionWidth={width}
              compositionHeight={height}
              fps={fps}
              style={{ width: "100%" }}
              controls
              loop
            />

            {/*
              Chuni hui cheez ka nishaan.
              ⚠️ `pointerEvents: none` zaroori hai — warna ye khud hi sabse upar
              wali parat ban jaata aur uske andar dobara kuch chuna hi nahi ja
              sakta tha.
            */}
            {mark ? (
              <div
                className="pointer-events-none absolute rounded-sm border border-terracotta shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                style={{
                  left: mark.left - 1,
                  top: mark.top - 1,
                  width: mark.width + 2,
                  height: mark.height + 2,
                }}
              />
            ) : null}
          </div>

          {/*
            ⚠️ Do number, aur dono zaroori hain. Player poori reel chalata hai — usme
            project ke purane scene bhi hain. Sirf "8 scene · 56 second" likhne par
            aadmi ko lagta hai ki wizard ne 56 second banaye, jabki usne 26 banaye
            aur baaki pehle se pade the. Wo galti export ke baad hi dikhti hai.
          */}
          <p className="text-center text-[11px] text-chalk-500">
            {built.applied} naye scene
            {wizardSeconds > 0 ? ` · ${Math.round(wizardSeconds)}s` : ""}
            {" · "}
            <span className={hasOld ? "text-amber" : undefined}>
              poori reel {Math.round(durationInFrames / fps)}s
            </span>
          </p>
        </div>

        {/* ------------------------------------------------ chuni hui cheez */}
        <div className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 p-2">
          {!selection || !scene ? (
            <div className="space-y-1.5">
              <p className="text-[11px] leading-snug text-chalk-300">
                Reel me <strong>kisi bhi cheez par click karo</strong> — tasveer, video, ya likha
                hua. Wo chun jaayegi aur uske saare chunav yahin khul jaayenge.
              </p>
              <p className="text-[10px] leading-snug text-chalk-500">
                Naap, jagah, ghumav, halkapan, harkat, rang ka effect, aur us scene ki awaaz aur
                music — sab yahin se. Kuch bhi doc me nahi likha jaata jab tak &ldquo;Editor me
                daalo&rdquo; na dabao.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 border-b border-ink-700 pb-1.5">
                <span className="text-[11px] text-chalk-100">{elementName(selection.item)}</span>
                <span className="truncate text-[10px] text-chalk-500">
                  scene {selection.at + 1} · {scene.name}
                </span>
                <button
                  type="button"
                  title="Chunav chhod do"
                  onClick={() => setPicked(null)}
                  className="ml-auto shrink-0 rounded border border-ink-600 p-0.5 text-chalk-400 transition-colors hover:border-chalk-500 hover:text-chalk-100"
                >
                  <X size={10} />
                </button>
              </div>

              {/* ------------------------------------------------------ naap */}
              <div className="flex items-center gap-1">
                <span className="w-14 shrink-0 text-[10px] text-chalk-500">Naap</span>
                <Tap
                  title="Chhota karo"
                  onClick={() =>
                    patchTweak({ scale: Math.max(SCALE_MIN, Number((tweak.scale - SCALE_STEP).toFixed(2))) })
                  }
                >
                  <Minus size={10} />
                </Tap>
                <span className="w-12 text-center font-mono text-[10px] text-chalk-300">
                  {Math.round(tweak.scale * 100)}%
                </span>
                <Tap
                  title="Bada karo"
                  onClick={() =>
                    patchTweak({ scale: Math.min(SCALE_MAX, Number((tweak.scale + SCALE_STEP).toFixed(2))) })
                  }
                >
                  <Plus size={10} />
                </Tap>
                {tweak.scale !== 1 ? (
                  <Tap title="Naap wapas jaisa tha" onClick={() => patchTweak({ scale: 1 })}>
                    <Undo2 size={10} />
                  </Tap>
                ) : null}
              </div>

              {/* ----------------------------------------------------- jagah */}
              <div className="flex items-center gap-1">
                <span className="w-14 shrink-0 text-[10px] text-chalk-500">Jagah</span>
                <Tap title="Baayen" onClick={() => patchTweak({ x: tweak.x - nudgeX })}>
                  <ArrowLeft size={10} />
                </Tap>
                <Tap title="Daayen" onClick={() => patchTweak({ x: tweak.x + nudgeX })}>
                  <ArrowRight size={10} />
                </Tap>
                <Tap title="Upar" onClick={() => patchTweak({ y: tweak.y - nudgeY })}>
                  <ArrowUp size={10} />
                </Tap>
                <Tap title="Neeche" onClick={() => patchTweak({ y: tweak.y + nudgeY })}>
                  <ArrowDown size={10} />
                </Tap>
                {tweak.x !== 0 || tweak.y !== 0 ? (
                  <Tap title="Wapas apni jagah par" onClick={() => patchTweak({ x: 0, y: 0 })}>
                    <Crosshair size={10} />
                  </Tap>
                ) : null}
                <span className="ml-auto font-mono text-[10px] text-chalk-500">
                  {tweak.x === 0 && tweak.y === 0 ? "beech" : `${tweak.x} , ${tweak.y}`}
                </span>
              </div>

              {/* ---------------------------------------------------- ghumav */}
              <div className="flex items-center gap-1">
                <span className="w-14 shrink-0 text-[10px] text-chalk-500">Ghumav</span>
                <Tap
                  title="Ulta ghumao"
                  onClick={() =>
                    patchTweak({ rotation: Math.max(-ROTATION_LIMIT, tweak.rotation - ROTATION_STEP) })
                  }
                >
                  <RotateCcw size={10} />
                </Tap>
                <span className="w-12 text-center font-mono text-[10px] text-chalk-300">
                  {tweak.rotation}°
                </span>
                <Tap
                  title="Seedha ghumao"
                  onClick={() =>
                    patchTweak({ rotation: Math.min(ROTATION_LIMIT, tweak.rotation + ROTATION_STEP) })
                  }
                >
                  <RotateCw size={10} />
                </Tap>
                {tweak.rotation !== 0 ? (
                  <Tap title="Seedha kar do" onClick={() => patchTweak({ rotation: 0 })}>
                    <Undo2 size={10} />
                  </Tap>
                ) : null}
              </div>

              {/* ------------------------------------------------- halkapan */}
              <div className="flex items-center gap-1">
                <span className="w-14 shrink-0 text-[10px] text-chalk-500">Halkapan</span>
                <Tap
                  title="Halka karo"
                  onClick={() =>
                    patchTweak({
                      opacity: Math.max(OPACITY_MIN, Number((tweak.opacity - OPACITY_STEP).toFixed(2))),
                    })
                  }
                >
                  <Minus size={10} />
                </Tap>
                <span className="w-12 text-center font-mono text-[10px] text-chalk-300">
                  {Math.round(tweak.opacity * 100)}%
                </span>
                <Tap
                  title="Gehra karo"
                  onClick={() =>
                    patchTweak({ opacity: Math.min(1, Number((tweak.opacity + OPACITY_STEP).toFixed(2))) })
                  }
                >
                  <Plus size={10} />
                </Tap>
                <Tap
                  title={tweak.hidden ? "Wapas dikhao" : "Is cheez ko reel se hata do"}
                  active={tweak.hidden}
                  onClick={() => patchTweak({ hidden: !tweak.hidden })}
                >
                  {tweak.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                  {tweak.hidden ? "Chhupi hai" : "Chhupao"}
                </Tap>
              </div>

              {/*
                Harkat aur rang — sirf us cheez par jispar wo sach me lagte hain.

                ⚠️ Baaki cheezon par ye do khaane dikhane ka matlab hota do aise
                button jo dabte to hain par kuch nahi karte (README rule 5). Kaun
                si cheez "wo cheez" hai, iska faisla wahi function karta hai jo
                `applyWizard` karta hai — `primaryOfScene` — do jagah do niyam
                rakhne par wizard me chunav dikhta aur reel me lagta hi nahi.
              */}
              {selection.isPrimary ? (
                <div className="space-y-1.5 border-t border-ink-700 pt-1.5">
                  <ChoicePicker
                    kind="animation"
                    value={scene.animationPresetId}
                    recommended={suggestAnimation(
                      {
                        type: effectiveType(scene),
                        text: scene.text,
                        hasImage: Boolean(scene.visualAssetId),
                      },
                      selection.at,
                    )}
                    onPick={(id) => onChange(scene.index, { animationPresetId: id })}
                  />
                  <Tap
                    title={
                      tweak.noAnimation
                        ? "Harkat wapas lagao"
                        : "Is cheez par koi harkat mat lagao — chunav waisa ka waisa rahega"
                    }
                    active={tweak.noAnimation}
                    onClick={() => patchTweak({ noAnimation: !tweak.noAnimation })}
                  >
                    {tweak.noAnimation
                      ? `Harkat hati hui hai${
                          scene.animationPresetId
                            ? ` (${plainAnimation(scene.animationPresetId)?.label ?? scene.animationPresetId})`
                            : ""
                        } — wapas lao`
                      : "Harkat hata do"}
                  </Tap>

                  <ChoicePicker
                    kind="effect"
                    value={scene.effectPresetId ?? "none"}
                    recommended={null}
                    onPick={(id) =>
                      onChange(scene.index, { effectPresetId: id === "none" ? null : id })
                    }
                  />
                  {scene.effectPresetId ? (
                    <Tap
                      title={
                        tweak.noEffect
                          ? "Rang ka effect wapas lagao"
                          : "Is cheez par rang ka effect mat lagao"
                      }
                      active={tweak.noEffect}
                      onClick={() => patchTweak({ noEffect: !tweak.noEffect })}
                    >
                      {tweak.noEffect
                        ? `Effect hata hua hai (${plainEffect(scene.effectPresetId)?.label ?? scene.effectPresetId}) — wapas lao`
                        : "Effect hata do"}
                    </Tap>
                  ) : null}
                </div>
              ) : null}

              {/*
                Is scene ki awaaz aur music — yahin, kyunki galti yahin sunai deti hai.

                ⚠️ Ye chunav Awaaz wale step me bhi hai, aur wo dohraav nahi hai.
                "Music bolne wale par chadh raha hai" ek aisi galti hai jo sirf reel
                CHALA KAR pakdi jaati hai; us waqt aadmi yahan khada hota hai. Use
                wapas step 3 par bhejne ka matlab hai ki wo scene dhoondhe, badle,
                phir wapas aakar dobara sune — aur teesri baar wo ye karta hi nahi.
              */}
              <div className="space-y-1.5 border-t border-ink-700 pt-1.5">
                {scene.voiceAssetId ? (
                  <>
                    <LevelRow
                      label="Is scene ki awaaz"
                      levels={VOICE_LEVELS}
                      value={scene.voiceVolume}
                      onPick={(next) => onChange(scene.index, { voiceVolume: next ?? 1 })}
                    />
                    <LevelRow
                      label="Bolne ki raftaar"
                      levels={VOICE_RATES}
                      value={scene.voiceRate}
                      onPick={(next) => onChange(scene.index, { voiceRate: next ?? 1 })}
                    />
                  </>
                ) : (
                  <p className="text-[10px] text-chalk-500">
                    Is scene par koi awaaz nahi — Awaaz wale step me banayi ja sakti hai.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1">
                  <span className="w-full text-[10px] text-chalk-500">Is scene ka music</span>
                  <div className="min-w-0 max-w-[160px] flex-1">
                    <AssetPickerButton
                      kind="audio"
                      allowUpload
                      uploadTags={["music", "wizard"]}
                      assetId={scene.musicAssetId}
                      onPick={(assetId) => onChange(scene.index, { musicAssetId: assetId })}
                    />
                  </div>
                  {scene.musicAssetId ? (
                    <Tap
                      title="Is scene par bhi wahi dhun jo poori reel par chal rahi hai"
                      onClick={() => onChange(scene.index, { musicAssetId: null })}
                    >
                      Reel wala
                    </Tap>
                  ) : (
                    <span className="text-[10px] text-chalk-500">
                      {draft.musicAssetId ? "reel wali dhun" : "koi music nahi"}
                    </span>
                  )}
                </div>

                {sceneMusicId ? (
                  <LevelRow
                    label="Music yahan"
                    levels={SCENE_MUSIC_LEVELS}
                    value={scene.musicVolume}
                    onPick={(next) => onChange(scene.index, { musicVolume: next })}
                  />
                ) : null}

                {/*
                  ⚠️ Poori reel ka level bhi yahin hai. Ek scene par music kam karna
                  aur poori reel par kam karna do alag faisle hain, aur aksar sahi
                  jawab doosra wala hota hai — "yahan tez lag raha hai" ka matlab
                  aam taur par ye hota hai ki wo har jagah tez hai.
                */}
                {draft.musicAssetId ? (
                  <LevelRow
                    label="Poori reel ka music"
                    levels={MUSIC_LEVELS}
                    value={draft.musicVolume}
                    onPick={(next) => onMusicVolume(next ?? MUSIC_LEVEL_DEFAULT)}
                  />
                ) : null}
              </div>

              {!tweakIsEmpty(tweak) ? (
                <button
                  type="button"
                  onClick={() =>
                    patchTweak({
                      scale: 1,
                      x: 0,
                      y: 0,
                      rotation: 0,
                      opacity: 1,
                      noAnimation: false,
                      noEffect: false,
                      hidden: false,
                    })
                  }
                  className="w-full rounded border border-ink-600 px-1.5 py-1 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500 hover:text-chalk-100"
                >
                  Is cheez par kiya hua sab wapas
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {hasOld ? (
        <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
          Is project me pehle se {previewDoc.scenes.length - built.applied} scene hain, aur naye
          uske <strong>aage</strong> jud rahe hain. Sirf ye nayi reel chahiye to pehle step me
          &ldquo;Purane scene hata do&rdquo; chun lo.
        </p>
      ) : null}

      {/*
        ⚠️ Jo asset nahi mili wo yahan likhi jaati hai, chhupayi nahi jaati. Bina
        iske preview me us jagah khaali/gulaabi card dikhta hai aur aadmi ko lagta
        hai ki wizard ne kuch toda — jabki asal me wo file storage me hai hi nahi.
      */}
      {missing.length > 0 ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
          {missing.length} asset nahi mili — us scene ki jagah khaali card dikhega. Peeche jaakar
          wo tasveer ya awaaz dobara daal do.
        </p>
      ) : null}

      {built.skipped.length > 0 ? (
        <div className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
          {built.skipped.length} scene nahi ban paaya:
          <ul className="mt-0.5 list-disc pl-4">
            {built.skipped.map((entry) => (
              <li key={entry.index}>{entry.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
