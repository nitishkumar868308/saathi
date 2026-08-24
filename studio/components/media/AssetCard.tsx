"use client";

import { assetQuality, formatBytes, getAssetKind } from "@reel/core";
import clsx from "clsx";
import { Trash2 } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { AudioPreview } from "@/components/media/AudioPreview";
import { setAssetDragData } from "@/lib/assetDrag";
import { useAssetUrl } from "@/lib/assetUrls";
import { msToClock } from "@/lib/format";
import type { Asset } from "@/lib/assets";

/**
 * Library ka ek card (grid) ya ek row (list).
 *
 * Quality badge yahin dikhta hai, aur wo **project ke size ke hisaab se** dikhta
 * hai — "480p" apne aap me bura nahi hai, 1080x1920 ke frame me bura hai. Isi
 * wajah se badge ko target chahiye, aur wahi helper Phase 20 me poore project
 * par chalega.
 */

const LEVEL_STYLES: Record<string, string> = {
  good: "bg-emerald-500/15 text-emerald-300",
  ok: "bg-amber/15 text-amber",
  low: "bg-red-500/15 text-red-300",
  unknown: "bg-ink-700 text-chalk-500",
};

export interface AssetCardProps {
  asset: Asset;
  target: { width: number; height: number } | null;
  selected?: boolean;
  view: "grid" | "list";
  onOpen(asset: Asset): void;
  /**
   * Card se seedha mitao — `undefined` ho to button dikhta hi nahi.
   *
   * ⚠️ Mitane ka raasta pehle sirf detail dialog ke andar tha (card kholo, phir
   * "Mitao"). Wo raasta hai to sahi, par library me pehchaan hi nahi hoti thi ki
   * wo wahan hai — aur galat file dhoondh kar mitane ke liye har card ek-ek karke
   * kholna padta tha. Ab card par hi ek nishaan hai; tasdeek (aur "kahan-kahan
   * laga hai" ki jaanch) phir bhi wahi ek dialog karta hai.
   */
  onDelete?(asset: Asset): void;
}

export function AssetCard({ asset, target, selected, view, onOpen, onDelete }: AssetCardProps) {
  // `require` nahi: DB me kabhi koi purani kism pad sakti hai, aur uske liye
  // poora panel gir jaana galat hoga — icon ka fallback kaafi hai.
  const kindIcon = getAssetKind(asset.kind)?.icon ?? "FileQuestion";
  const quality = assetQuality(asset, target);
  // Thumbnail bana hi na ho to request bhi nahi jaati — 404 par 404 bhejne se
  // network tab bhar jaata hai aur asli galtiyan usme chhup jaati hain.
  const { url: thumbUrl } = useAssetUrl(asset.thumbKey ? asset.id : null, { thumb: true });

  /*
   * Thumbnail na ho to **asli file** dikhao (26.24).
   *
   * ⚠️ Ye ek asli shikayat ka ilaaj hai: library me har tasveer aur har video ek
   * khaali dabbe jaisi dikhti thi, sirf ek icon ke saath. Wajah ye hai ki
   * `thumbKey` sirf **bani hui reel** ka banta hai; aam upload ka koi thumbnail
   * kabhi banta hi nahi. Yaani wo fallback icon halat ka apwaad nahi tha, wo har
   * uploaded file par lagta tha — poori library pehchaan ke bina.
   *
   * ⚠️ Poori file 100px ke dabbe me dikhana mehnga lagta hai par hai nahi: browser
   * wahi file cache karta hai jo preview aur editor bhi maangte hain (ek hi
   * stable URL), aur `loading="lazy"` se sirf jo screen par hai wahi utarta hai.
   * Video par sirf **metadata** utarta hai — poora file nahi (dekho neeche).
   */
  const previewKind = asset.kind === "image" || asset.kind === "video" ? asset.kind : null;
  const { url: fullUrl } = useAssetUrl(!asset.thumbKey && previewKind ? asset.id : null);
  const url = thumbUrl ?? fullUrl;

  const duration = asset.durationMs === null ? null : msToClock(asset.durationMs);
  /*
   * Awaaz wali file par sunne ka raasta hona hi chahiye. Pehle wo tha hi nahi —
   * TTS se banti thi, upload ho jaati thi, timeline par lag bhi jaati thi, par
   * bajaakar dekhne ke liye poori reel preview karni padti thi.
   */
  const isAudio = asset.kind === "audio";

  /*
   * Timeline par le jaane ke liye card khud draggable hai (16.3).
   *
   * ⚠️ Draggable **card** hai, koi alag "drag handle" nahi. Handle rakhne par
   * user ko wo pehle dhoondhna padta hai, aur library me har card chhota hota
   * hai — 8px ka handle ungli se to bhool hi jao, maus se bhi mushkil hai.
   * Card ka `onClick` isse tootta nahi: browser click aur dragstart ko alag
   * rakhta hai.
   */
  const dragProps = {
    draggable: true,
    onDragStart: (event: React.DragEvent) =>
      setAssetDragData(event, {
        assetId: asset.id,
        kind: asset.kind,
        filename: asset.filename,
        durationMs: asset.durationMs,
      }),
  };

  if (view === "list") {
    const row = (
      <button
        type="button"
        {...dragProps}
        onClick={() => onOpen(asset)}
        title={`${asset.filename}\n${quality.detail}\n\nTimeline par ghaseet kar chhodo`}
        className={clsx(
          "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
          selected
            ? "border-terracotta bg-terracotta/10"
            : "border-transparent hover:border-ink-600 hover:bg-ink-700",
        )}
      >
        <Thumb
          url={url}
          kindIcon={kindIcon}
          video={!asset.thumbKey && asset.kind === "video"}
          className="h-8 w-8 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-chalk-100">{asset.filename}</span>
          <span className="block text-[11px] text-chalk-500">
            {formatBytes(asset.bytes)}
            {duration ? ` · ${duration}` : ""}
          </span>
        </span>
        <span className={clsx("rounded px-1.5 py-0.5 text-[10px]", LEVEL_STYLES[quality.level])}>
          {quality.badge}
        </span>
      </button>
    );

    /*
     * Player card ke **bahar** hai, andar nahi — card khud ek `<button>` hai aur
     * button ke andar button na theek HTML hai, na uska click theek se chalta
     * (dono handler ek saath lag jaate).
     */
    return (
      <div className="group/card relative">
        {row}
        {isAudio ? <AudioPreview assetId={asset.id} className="px-2 pb-1" /> : null}
        <DeleteButton asset={asset} onDelete={onDelete} className="right-1 top-1" />
      </div>
    );
  }

  const card = (
    <button
      type="button"
      {...dragProps}
      onClick={() => onOpen(asset)}
      title={`${asset.filename}\n${quality.detail}\n\nTimeline par ghaseet kar chhodo`}
      className={clsx(
        "group flex flex-col cursor-grab overflow-hidden rounded-lg border text-left transition-colors active:cursor-grabbing",
        selected
          ? "border-terracotta bg-terracotta/10"
          : "border-ink-600 bg-ink-900 hover:border-ink-500",
      )}
    >
      <Thumb
        url={url}
        kindIcon={kindIcon}
        video={!asset.thumbKey && asset.kind === "video"}
        className="aspect-square w-full"
      />
      <span className="flex items-center gap-1 px-1.5 pb-1 pt-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-300">
          {asset.filename}
        </span>
        <span className={clsx("shrink-0 rounded px-1 text-[10px]", LEVEL_STYLES[quality.level])}>
          {quality.badge}
        </span>
      </span>
    </button>
  );

  return (
    <div className="group/card relative space-y-0.5">
      {card}
      {isAudio ? <AudioPreview assetId={asset.id} className="px-1.5 pb-1" /> : null}
      <DeleteButton asset={asset} onDelete={onDelete} className="right-1 top-1" />
    </div>
  );
}

/**
 * Card ke kone par mitane ka nishaan.
 *
 * ⚠️ Ye card ke **bahar** hai, andar nahi — card khud ek `<button>` hai, aur
 * button ke andar button na theek HTML hai na theek se chalta hai (dono handler
 * ek saath lag jaate hain, aur mitane ke saath detail dialog bhi khul jaata).
 * Wahi wajah `AudioPreview` ke bahar hone ki bhi hai.
 *
 * ⚠️ Sirf hover/focus par dikhta hai. Har card par hamesha ek laal nishaan rakhna
 * library ko khatarnak bana deta hai — nazar usi par jaati hai, jabki aam kaam
 * file chunna hai, mitana nahi. Touch par `group-hover` nahi chalta, isliye
 * `focus-within` bhi hai (tap se focus aata hai).
 */
function DeleteButton({
  asset,
  onDelete,
  className,
}: {
  asset: Asset;
  onDelete?(asset: Asset): void;
  className?: string;
}) {
  if (!onDelete) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete(asset);
      }}
      title="Ye file hamesha ke liye mita do (storage + DB)"
      className={clsx(
        "absolute rounded border border-ink-600 bg-ink-950/90 p-1 text-chalk-500 opacity-0 transition-opacity hover:border-red-500/60 hover:text-red-300 focus:opacity-100 group-hover/card:opacity-100",
        className,
      )}
    >
      <Trash2 size={11} />
    </button>
  );
}

function Thumb({
  url,
  kindIcon,
  className,
  video,
}: {
  url: string | null;
  kindIcon: string;
  className?: string;
  /** Video hai — tab `<img>` kaam nahi karta, ek chupa hua `<video>` chahiye. */
  video?: boolean;
}) {
  return (
    <span
      className={clsx("flex items-center justify-center overflow-hidden bg-ink-950", className)}
    >
      {url && video ? (
        /*
         * Video ki jhalak — **sirf pehla frame**.
         *
         * ⚠️ `preload="metadata"` aur `#t=0.1` dono zaroori hain. Metadata ke bina
         * browser poori file kheenchne lagta hai (200MB ki recording par library
         * kholna hi bhaari ho jaata). Aur `#t` ke bina wo pehla frame dikhata hi
         * nahi — bahut se video ka frame 0 kaala hota hai, isliye ek dabba phir
         * bhi kaala dikhta. `0.1s` par wo aksar asli tasveer hoti hai.
         *
         * ⚠️ `muted` + `playsInline` zaroori hain: iske bina kuch browser (iOS)
         * frame nikaalne se pehle hi mana kar dete hain.
         */
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={`${url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL hai,
        // Next ka image optimizer ise fetch nahi kar sakta (dev me local route).
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon name={kindIcon} size={18} className="text-chalk-500" />
      )}
    </span>
  );
}
