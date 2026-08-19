"use client";

import {
  framesToSeconds,
  isSceneCustomEdited,
  itemEndFrame,
  listSceneTypes,
  requireSceneType,
  secondsToFrames,
  validateSceneIntegrity,
  type Scene,
} from "@reel/core";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Copy, Pencil, Trash2, Wrench } from "lucide-react";
import { useState } from "react";

import { AddScenePanel } from "@/components/editor/scenes/AddScenePanel";
import { SceneSlotRow } from "@/components/editor/scenes/SceneSlotRow";
import { NumberField } from "@/components/controls/NumberField";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useEditorStore } from "@/lib/store";

/**
 * Scene Cards — beginner mode (12.6).
 *
 * ⚠️ **Ye ek alag editor nahi hai.** Card aur timeline ek hi doc par chalte hain
 * aur dono wahi named ops bulate hain. Isliye card me duration badalte hi
 * timeline hil jaata hai, aur timeline me clip trim karte hi card ka number
 * badal jaata hai — bina kisi sync code ke, kyunki sync jaisi koi cheez hai hi
 * nahi. Do doc rakhne par unme se ek hamesha peeche reh jaata.
 *
 * ⚠️ Card ki duniya seedhi hai (ek scene = ek lagataar block), par timeline me
 * user kuch bhi kar sakta hai. Jab wo seedhapan toot jaata hai to card par
 * **"Custom edited"** ka badge aata hai — chup-chaap galat dikhate rehna sabse
 * bura hota (12.8).
 */
export function SceneCards() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const setMode = useEditorStore((state) => state.setMode);
  const setSelection = useEditorStore((state) => state.setSelection);

  const scenes = [...doc.scenes].sort((a, b) => a.order - b.order);
  const issues = validateSceneIntegrity(doc);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
      {issues.length > 0 ? (
        <div className="rounded border border-amber/40 bg-amber/10 p-2">
          <p className="text-[11px] leading-snug text-amber">
            <strong>Scenes aur timeline ka rishta toota hua hai.</strong>{" "}
            {issues[0]?.message}
            {issues.length > 1 ? ` (aur ${issues.length - 1} aur)` : ""}
          </p>
          <Button
            icon={<Wrench size={12} />}
            className="mt-1 px-2 py-0.5 text-[11px]"
            onClick={() => applyOp("repairScenes", undefined as never, { label: "Scenes theek kiye" })}
            title="Gayab ids hata di jaayengi aur anaath clips scene se alag ho jaayengi — koi clip delete nahi hogi"
          >
            Theek karo
          </Button>
        </div>
      ) : null}

      {scenes.length === 0 ? (
        <p className="rounded border border-dashed border-ink-600 p-6 text-center text-sm text-chalk-500">
          Abhi koi scene nahi.
          <span className="mt-1 block text-xs">
            Neeche se ek scene jodo — reel bina timeline chhue ban jaayegi.
          </span>
        </p>
      ) : (
        <ol className="space-y-2">
          {scenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={index}
              count={scenes.length}
              onEditInTimeline={() => {
                setMode("advanced");
                setSelection({ itemIds: [...scene.itemIds], trackIds: [] });
              }}
            />
          ))}
        </ol>
      )}

      <AddScenePanel />

      <p className="pt-2 text-center text-[10px] text-chalk-500">
        {listSceneTypes().length} scene types · sab wahi ops chalate hain jo timeline chalata
        hai, isliye Ctrl+Z yahan bhi kaam karta hai
      </p>
    </div>
  );
}

function SceneCard({
  scene,
  index,
  count,
  onEditInTimeline,
}: {
  scene: Scene;
  index: number;
  count: number;
  onEditInTimeline(): void;
}) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const [proportional, setProportional] = useState(false);

  const type = requireSceneType(scene.type);
  const items = doc.items.filter((item) => item.sceneId === scene.id);
  const fps = doc.project.fps;

  const start = items.length > 0 ? Math.min(...items.map((item) => item.startFrame)) : 0;
  const end = items.length > 0 ? Math.max(...items.map(itemEndFrame)) : 0;
  const durationFrames = end - start;
  const custom = isSceneCustomEdited(doc, scene.id);

  return (
    <li className="rounded border border-ink-600 bg-ink-800">
      <div className="flex items-center gap-2 border-b border-ink-700 px-2 py-1.5">
        <span className="w-5 shrink-0 text-center font-mono text-[11px] text-chalk-500">
          {index + 1}
        </span>
        <Icon name={type.icon} size={13} className="shrink-0 text-chalk-500" />
        <span className="min-w-0 flex-1 truncate text-sm text-chalk-100" title={type.hint}>
          {scene.name}
        </span>

        {custom ? (
          <span
            className="shrink-0 rounded bg-amber/20 px-1.5 py-0.5 text-[10px] text-amber"
            title="Is scene ki clips timeline me haath se badli gayi hain — card ki simple duniya ab poori sach nahi hai"
          >
            Custom edited
          </span>
        ) : null}

        <IconButton
          className="h-6 w-6"
          title="Upar"
          aria-label="Upar"
          disabled={index === 0}
          onClick={() =>
            applyOp("reorderScenes", { sceneId: scene.id, toIndex: index - 1 }, { label: "Scene upar" })
          }
        >
          <ChevronUp size={12} />
        </IconButton>
        <IconButton
          className="h-6 w-6"
          title="Neeche"
          aria-label="Neeche"
          disabled={index === count - 1}
          onClick={() =>
            applyOp("reorderScenes", { sceneId: scene.id, toIndex: index + 1 }, { label: "Scene neeche" })
          }
        >
          <ChevronDown size={12} />
        </IconButton>
        <IconButton
          className="h-6 w-6"
          title="Duplicate"
          aria-label="Duplicate"
          onClick={() => applyOp("duplicateScene", { sceneId: scene.id }, { label: "Scene duplicate" })}
        >
          <Copy size={12} />
        </IconButton>
        <IconButton
          className="h-6 w-6"
          variant="danger"
          title="Delete"
          aria-label="Delete"
          onClick={() => applyOp("deleteScene", { sceneId: scene.id }, { label: "Scene delete" })}
        >
          <Trash2 size={12} />
        </IconButton>
      </div>

      <div className="space-y-2 p-2">
        {type.slots.map((slot) => (
          <SceneSlotRow key={slot.id} scene={scene} slot={slot} />
        ))}

        <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-2">
          <span className="text-[11px] text-chalk-500">Lambai</span>
          <span className="w-20">
            <NumberField
              value={Number(framesToSeconds(durationFrames, fps).toFixed(2))}
              min={0.1}
              step={0.1}
              unit="s"
              onChange={(next) =>
                applyOp(
                  "setSceneDuration",
                  {
                    sceneId: scene.id,
                    durationInFrames: secondsToFrames(next, fps),
                    proportional,
                  },
                  { label: "Scene ki lambai", coalesceKey: `scene:${scene.id}:duration` },
                )
              }
            />
          </span>
          <span className="font-mono text-[10px] text-chalk-500">{durationFrames}f</span>

          <label
            className="flex items-center gap-1 text-[10px] text-chalk-500"
            title="On: scene ke saare items anupaat me badlenge. Off: sirf sabse lambi item — recording wali awaaz waisi hi rehti hai"
          >
            <input
              type="checkbox"
              checked={proportional}
              onChange={(event) => setProportional(event.target.checked)}
              className="accent-terracotta"
            />
            sab items
          </label>

          <span className="flex-1" />
          <Button
            icon={<Pencil size={11} />}
            className="px-2 py-0.5 text-[11px]"
            onClick={onEditInTimeline}
            title="Timeline me jaakar isi scene ki clips chuni hui milengi"
          >
            Timeline me edit
          </Button>
        </div>

        <p className="text-[10px] text-chalk-500">
          {items.length} clip · {framesToSeconds(start, fps).toFixed(1)}s se{" "}
          {framesToSeconds(end, fps).toFixed(1)}s
        </p>
      </div>
    </li>
  );
}
