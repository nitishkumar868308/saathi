"use client";

import { getItemType, type Item, type OpName } from "@reel/core";
import { useEffect, useRef } from "react";

import { useEditorStore, type OpArgsOf } from "@/lib/store";

/**
 * Clip par right-click ka menu (16.9).
 *
 * ⚠️ Har entry wahi op chalati hai jo shortcut aur panel chalate hain — koi
 * "menu wala raasta" alag se nahi hai. Do raaste hone par ek din menu wala split
 * keyframes sambhalna bhool jaata aur wo galti sirf menu se hoti, jise dobara
 * paida karna bahut mushkil hota.
 *
 * Jo cheez is clip par ho hi nahi sakti, wo entry **dikhti hi nahi** — grey
 * karke dikhane se list lambi hoti hai aur user sochta rehta hai ki wo kaise
 * chalu hogi.
 */

export interface ClipMenuState {
  item: Item;
  x: number;
  y: number;
}

export function ClipContextMenu({
  state,
  onClose,
}: {
  state: ClipMenuState | null;
  onClose(): void;
}) {
  const doc = useEditorStore((store) => store.doc);
  const applyOp = useEditorStore((store) => store.applyOp);
  const playheadFrame = useEditorStore((store) => store.playheadFrame);
  const selection = useEditorStore((store) => store.selection);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    // `capture` isliye ki clip ka apna pointer handler pehle chalta hai aur menu
    // khulte hi band ho jaata.
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", close, true);
    };
  }, [state, onClose]);

  if (!state) return null;

  const item = state.item;
  const entry = getItemType(item.type);
  const localFrame = playheadFrame - item.startFrame;
  const insideClip = localFrame > 0 && localFrame < item.durationInFrames;
  const itemIds = selection.itemIds.includes(item.id) ? [...selection.itemIds] : [item.id];
  const grouped = doc.items.some((other) => other.groupId && other.groupId === item.groupId);

  // Generic isliye ki har op ke apne args hain — `Record<string, unknown>` lene
  // par TS ka poora check ud jaata aur ek galat arg chup-chaap nikal jaata.
  function run<K extends OpName>(op: K, args: OpArgsOf<K>, label: string): void {
    applyOp(op, args, { label });
    onClose();
  }

  return (
    <div
      ref={ref}
      role="menu"
      // Menu ke andar ka pointerdown bahar wale close se na takraye.
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left: state.x, top: state.y }}
      className="fixed z-50 min-w-[168px] rounded border border-ink-600 bg-ink-900 py-1 text-[11px] shadow-lg"
    >
      <MenuItem
        label="Playhead par todo"
        hint="S"
        disabled={!insideClip}
        onClick={() => run("splitAtFrame", { frame: playheadFrame, itemIds }, "Split")}
      />
      {insideClip && (entry?.hasAudio || item.type === "video") ? (
        <MenuItem
          label="Freeze frame"
          onClick={() =>
            run(
              "freezeFrame",
              {
                itemId: item.id,
                frame: playheadFrame,
                durationInFrames: Math.round(doc.project.fps * 1.5),
              },
              "Freeze frame",
            )
          }
        />
      ) : null}

      <Divider />

      <MenuItem
        label="Copy"
        hint="Ctrl+D"
        onClick={() => run("duplicateItems", { itemIds }, "Duplicate")}
      />
      <MenuItem label="Delete" hint="Del" onClick={() => run("deleteItems", { itemIds }, "Delete")} />
      <MenuItem
        label="Ripple delete"
        hint="Shift+Del"
        onClick={() => run("rippleDeleteItems", { itemIds }, "Ripple delete")}
      />

      {itemIds.length > 1 || grouped ? <Divider /> : null}
      {itemIds.length > 1 && !grouped ? (
        <MenuItem label="Group" hint="Ctrl+G" onClick={() => run("groupItems", { itemIds }, "Group")} />
      ) : null}
      {grouped ? (
        <MenuItem
          label="Ungroup"
          hint="Ctrl+Shift+G"
          onClick={() => run("ungroupItems", { itemIds }, "Ungroup")}
        />
      ) : null}

      <Divider />

      <MenuItem
        label={item.locked ? "Unlock" : "Lock"}
        onClick={() =>
          run(
            "setItemsProperty",
            { itemIds, path: "locked", value: !item.locked },
            item.locked ? "Unlock" : "Lock",
          )
        }
      />
      <MenuItem
        label={item.hidden ? "Dikhao" : "Chhupao"}
        onClick={() =>
          run(
            "setItemsProperty",
            { itemIds, path: "hidden", value: !item.hidden },
            item.hidden ? "Dikhao" : "Chhupao",
          )
        }
      />
    </div>
  );
}

function MenuItem({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-2.5 py-1 text-left text-chalk-300 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:text-chalk-500 disabled:hover:bg-transparent"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="shrink-0 font-mono text-[10px] text-chalk-500">{hint}</span> : null}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-ink-700" />;
}
