"use client";

import { COLLAGE_LAYOUTS, collageSlots, type CollageLayout } from "@reel/core";
import clsx from "clsx";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { makeCollage, CollageError } from "@/lib/collage";
import { uploadBlob } from "@/lib/upload/uploadBlob";

/**
 * Kai tasveerein jod kar ek — upar-neeche, bagal-bagal, ya jaali me.
 *
 * ⚠️ Jodi hui tasveer **ek nayi file** banti hai aur library me jaati hai. Wo
 * jaan-boojhkar hai: scene ke paas ek hi tasveer jaati hai, isliye baaki poora
 * raasta (fit, harkat, chhupana, render) bina kisi badlav ke chalta rehta hai.
 * Scene ko "teen tasveerein" samajhna sikhane ka matlab hota har us jagah ek
 * naya case jodna — aur unme se ek din ek jagah chhoot jaati.
 *
 * ⚠️ Asli tasveerein waisi ki waisi rehti hain. Jodi hui unke **bagal me** banti
 * hai, upar nahi likhti — wahi niyam jo fit ki copy ka hai.
 */
export function CollageDialog({
  open,
  frame,
  onCancel,
  onDone,
}: {
  open: boolean;
  frame: { width: number; height: number };
  onCancel(): void;
  /** Bani hui tasveer ki id — scene uspar lag jaata hai. */
  onDone(assetId: string): void;
}) {
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<CollageLayout>("rows");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = collageSlots({ count: Math.max(assetIds.length, 1), layout, frame });
  const enough = assetIds.length >= 2;

  async function build(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const blob = await makeCollage({ assetIds, layout, frame });
      const made = await uploadBlob({
        blob,
        filename: `jodi-hui-${assetIds.length}-tasveer.jpg`,
        /*
         * ⚠️ `wizard` ka tag saath me isliye ki ye library me wahin dikhe jahan
         * baaki wizard wali file dikhti hai — aadmi ne ise wizard me hi banwaya
         * hai, aur agli baar wo use wahin dhoondhega.
         */
        tags: ["collage", "wizard"],
        width: frame.width,
        height: frame.height,
      });
      onDone(made.assetId);
      setAssetIds([]);
    } catch (cause) {
      setError(
        cause instanceof CollageError || cause instanceof Error
          ? cause.message
          : String(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Kai tasveerein jod kar ek" onClose={onCancel}>
      <div className="space-y-3">
        <p className="text-[11px] leading-snug text-chalk-400">
          Do ya zyada tasveerein chuno — wo ek hi tasveer me jud jaayengi, aur scene par wahi
          lagegi. Kram wahi rahega jis kram me yahan hain.
        </p>

        {/* Chuni hui tasveerein — kram ke saath. */}
        {assetIds.length > 0 ? (
          <ul className="space-y-1">
            {assetIds.map((assetId, at) => (
              <li key={`${assetId}-${at}`} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-[10px] text-chalk-500">{at + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-chalk-400">
                  {assetId}
                </span>
                <button
                  type="button"
                  title="Upar le jao"
                  disabled={at === 0}
                  onClick={() =>
                    setAssetIds((list) => {
                      const next = [...list];
                      const moved = next[at] as string;
                      next[at] = next[at - 1] as string;
                      next[at - 1] = moved;
                      return next;
                    })
                  }
                  className="rounded border border-ink-600 px-1 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Hata do"
                  onClick={() => setAssetIds((list) => list.filter((_, other) => other !== at))}
                  className="rounded border border-ink-600 px-1 py-0.5 text-chalk-400 transition-colors hover:border-red-400 hover:text-red-300"
                >
                  <Trash2 size={10} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <AssetPickerButton
          kind="image"
          assetId={null}
          allowUpload
          uploadTags={["wizard"]}
          onPick={(assetId) => setAssetIds((list) => [...list, assetId])}
        />

        {/* Kis tarah baithengi — registry par map. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-chalk-500">Kaise:</span>
          {COLLAGE_LAYOUTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.hint}
              onClick={() => setLayout(entry.id)}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                layout === entry.id
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/*
          Khaka — kaunsi tasveer kahan baithegi.

          ⚠️ Ye wahi `collageSlots()` chalata hai jo asli file banati hai, isliye
          jo yahan dikhta hai wahi banta bhi hai. Alag se ek "lagbhag aisa dikhega"
          wala khaka banana wo halat banata hai jahan khaka kuch aur kehta hai aur
          file kuch aur nikalti hai.
        */}
        <div
          style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
          className="relative w-full max-w-[120px] overflow-hidden rounded border border-ink-600 bg-ink-900"
        >
          {slots.map((slot, at) => (
            <div
              key={at}
              className="absolute flex items-center justify-center bg-ink-700 text-[9px] text-chalk-500"
              style={{
                left: `${(slot.x / frame.width) * 100}%`,
                top: `${(slot.y / frame.height) * 100}%`,
                width: `${(slot.width / frame.width) * 100}%`,
                height: `${(slot.height / frame.height) * 100}%`,
              }}
            >
              {at + 1}
            </div>
          ))}
        </div>

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[10px] leading-snug text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            className="px-2 py-1 text-[11px]"
            icon={busy ? <Loader2 size={11} className="animate-spin" /> : undefined}
            disabled={!enough || busy}
            onClick={() => void build()}
          >
            {busy ? "Jodi ja rahi hai…" : "Jod do"}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-ink-600 px-2 py-1 text-[11px] text-chalk-400 transition-colors hover:border-chalk-500"
          >
            Rehne do
          </button>
          {!enough ? (
            <span className="text-[10px] text-chalk-500">kam se kam do tasveerein chuno</span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
