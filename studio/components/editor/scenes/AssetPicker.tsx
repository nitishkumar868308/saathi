"use client";

import { formatBytes, libraryTabForKind } from "@reel/core";
import clsx from "clsx";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { Asset } from "@/lib/assets";
import { useAssetUrl } from "@/lib/assetUrls";
import { forgetAssetMeta } from "@/lib/assetMeta";
import { useUploader } from "@/lib/upload/uploader";
import { useEditorStore } from "@/lib/store";

/**
 * Asset chunne ka button + dialog.
 *
 * ⚠️ Ye media library ko dobara nahi banata — wahi `GET /api/assets` chalta hai
 * jo LeftSidebar ka Media panel chalata hai, sirf kind ka filter alag hota hai.
 * Do alag list rakhne par upload karne ke baad ek me nayi file dikhti aur doosri
 * me nahi, aur uski wajah dhoondhna bekaar ka kaam hota.
 *
 * ⚠️ **Upload yahan se bhi hota hai** (`allowUpload`), aur ye badla hua hai.
 * Pehle yahan likha tha ki upload sirf Media panel me hona chahiye, taaki upload
 * ka poora chakkar (progress, cancel, retry, duplicate) ek hi jagah rahe. Wo dalil
 * theek thi par uski keemat wizard me chukani padti thi: aadmi ek scene par khada
 * hota hai, uske paas file hai, aur usse kaha jaata hai ki wizard band karo, Media
 * panel kholo, upload karo, wapas aao. Aadhe raaste me wizard ka kaam chala jaata
 * hai.
 *
 * Ab dono ek jagah hain — **gallery pehle, upload uske andar** — aur upload ka
 * chakkar phir bhi ek hi jagah likha hai: `useUploader`. Yahan wo hook chalta hai,
 * uska code dobara nahi likha gaya. Isliye tag, duplicate-detect aur probe wahi
 * rehte hain jo Media panel me hain, aur chadhi hui file **library me hi jaati
 * hai** — agli baar wo gallery me mil jaayegi.
 */
export function AssetPickerButton({
  kind,
  assetId,
  onPick,
  allowUpload = false,
  uploadTags,
  kinds,
}: {
  /** `null` = koi bhi kind. */
  kind: string | null;
  assetId: string | null;
  /**
   * Chuni hui file — aur **uski kism**.
   *
   * ⚠️ `kind` isliye jaata hai ki bulane wale ko aksar wahi chahiye hota hai:
   * wizard ko scene ka type isi se tay karna hota hai (tasveer aayi ya video).
   * Bina iske wizard ko alag se ek "abhi kaunsa button daba tha" wala switch
   * rakhna padta tha, aur wo chunav galat ho jaane par `image` ka item ek video
   * ki id le kar baith jaata — render me khaali frame, bina kisi error ke.
   */
  onPick(assetId: string, kind?: string): void;
  /** Dialog ke andar se nayi file chadhane do (wizard). */
  allowUpload?: boolean;
  /** Naye asset par tag — `useUploader` ko jaate hain. */
  uploadTags?: readonly string[];
  /**
   * Dialog me kin-kin kism ke tab dikhein.
   *
   * ⚠️ Ye `kind` se alag hai: `kind` "abhi kya dikh raha hai" hai, `kinds` "kya
   * dikh sakta hai". Wizard me dono chahiye — sifaarish tasveer ki hoti hai par
   * aadmi ke paas video bhi ho sakti hai, aur uske liye do alag button rakhna
   * (jo pehle tha) chunav ko chhupa deta hai.
   */
  kinds?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const { url } = useAssetUrl(assetId, { thumb: true });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-left text-xs transition-colors hover:border-chalk-500"
      >
        {url ? (
          <span
            className="h-6 w-8 shrink-0 rounded bg-ink-700 bg-cover bg-center"
            style={{ backgroundImage: `url(${url})` }}
          />
        ) : (
          <span className="h-6 w-8 shrink-0 rounded bg-ink-700" />
        )}
        <span className={clsx("min-w-0 flex-1 truncate", assetId ? "text-chalk-300" : "text-chalk-500")}>
          {assetId ? "Badlo…" : allowUpload ? "Gallery / upload…" : "Chuno…"}
        </span>
      </button>

      {/*
        ⚠️ Dialog tabhi banta hai jab khula ho. Hamesha render karne par har scene
        ki qatar ke saath ek uploader hook aur ek fetch effect bhi bana rehta —
        aath scene par aath, jinme se saat kabhi khulte hi nahi.
      */}
      {open ? (
        <AssetPickerDialog
          open={open}
          kind={kind}
          kinds={kinds}
          allowUpload={allowUpload}
          uploadTags={uploadTags}
          onClose={() => setOpen(false)}
          onPick={(id, pickedKind) => {
            onPick(id, pickedKind);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Kind ka aam bhasha wala naam — tab ke button par. */
const KIND_LABELS: Record<string, string> = {
  image: "Tasveerein",
  video: "Video",
  audio: "Awaaz",
};

/** File chunne wale dialog me `accept` — kind se, haath se nahi. */
const KIND_ACCEPT: Record<string, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
};

function AssetPickerDialog({
  open,
  kind,
  kinds,
  allowUpload,
  uploadTags,
  onClose,
  onPick,
}: {
  open: boolean;
  kind: string | null;
  kinds?: readonly string[];
  allowUpload?: boolean;
  uploadTags?: readonly string[];
  onClose(): void;
  onPick(assetId: string, kind?: string): void;
}) {
  /** Abhi kaunsa tab khula hai — shuru me wahi jo bulane wale ne kaha. */
  const [activeKind, setActiveKind] = useState<string | null>(kind);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  /**
   * Abhi jo file chadh rahi hai wo kis kism ki hai.
   *
   * ⚠️ Ye file ke apne `type` se aata hai, us tab se nahi jispar aadmi khada tha.
   * Tab se lena bilkul chalta hua dikhta hai aur "Sab" wale tab par (jahan koi
   * kind hai hi nahi) chup-chaap khaali jaata — aur tab wizard ke paas scene ka
   * type tay karne ka koi jawab nahi bachta.
   */
  const pendingKind = useRef<string | undefined>(undefined);

  /*
   * ⚠️ Frame store se, kisi prop se nahi. Ye dialog wizard ke andar se bhi
   * khulta hai aur properties panel se bhi; prop banane par har bulane wale ko
   * wo aage bhejna padta, aur ek jagah chhoot jaane par rok chup-chaap lagni
   * band ho jaati — bina kisi error ke.
   */
  const project = useEditorStore((state) => state.doc.project);

  const uploader = useUploader({
    ...(uploadTags ? { tags: uploadTags } : {}),
    frame: { width: project.width, height: project.height },
    /*
     * File chadhne par do kaam: naya asset seedha chun lo, aur list taaza karo.
     *
     * ⚠️ `forgetAssetMeta()` zaroori hai. Scene ki lambai asset ki naapi hui
     * lambai se banti hai (`useAssetDurations`), aur wo list cache hoti hai — bina
     * ise girane par abhi chadhi hui awaaz "lambai pata nahi" dikhati hai, aur us
     * scene ki lambai AI ke andaaze par reh jaati hai.
     */
    onFinished: ({ assetId }) => {
      forgetAssetMeta();
      setReloadKey((n) => n + 1);
      onPick(assetId, pendingKind.current);
    },
  });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        /*
         * ⚠️ Tab ka id registry se aata hai, `${kind}s` jod kar nahi. Wo jod
         * `audio` par toot'ti thi (us tab ka id `audio` hai, `audios` nahi) aur
         * Awaaz wala picker hamesha 400 dikhata tha — dekho `libraryTabForKind`.
         */
        const tab = activeKind ? (libraryTabForKind(activeKind)?.id ?? "all") : "all";
        const response = await fetch(`/api/assets?tab=${tab}`);
        const data = (await response.json()) as { assets?: Asset[]; reason?: string };
        if (!alive) return;
        if (!response.ok) setError(data.reason ?? "list nahi aayi");
        else setAssets(data.assets ?? []);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, activeKind, reloadKey]);

  const tabs = kinds && kinds.length > 1 ? kinds : null;
  const task = uploader.tasks[uploader.tasks.length - 1];
  const uploading =
    task && task.phase !== "done" && task.phase !== "duplicate" && task.phase !== "error";

  return (
    <Modal
      open={open}
      title={`${activeKind ? (KIND_LABELS[activeKind] ?? activeKind) : "Koi bhi"} — gallery`}
      onClose={onClose}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs?.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setActiveKind(entry)}
              className={clsx(
                "rounded border px-2 py-1 text-[11px] transition-colors",
                activeKind === entry
                  ? "border-terracotta bg-terracotta/10 text-chalk-100"
                  : "border-ink-600 text-chalk-400 hover:border-chalk-500",
              )}
            >
              {KIND_LABELS[entry] ?? entry}
            </button>
          ))}

          {allowUpload ? (
            <>
              <input
                ref={input}
                type="file"
                accept={activeKind ? (KIND_ACCEPT[activeKind] ?? undefined) : undefined}
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    pendingKind.current = file.type.split("/")[0];
                    uploader.addFiles([file]);
                  }
                  // Wahi file dobara chunne par `change` nahi chalta — isliye khaali.
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={Boolean(uploading)}
                className="ml-auto flex items-center gap-1 rounded border border-ink-600 px-2 py-1 text-[11px] text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100 disabled:opacity-40"
              >
                {uploading ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Upload size={11} />
                )}
                {uploading
                  ? `${Math.round((task?.progress ?? 0) * 100)}%`
                  : "Nayi file upload karo"}
              </button>
            </>
          ) : null}
        </div>

        {task?.phase === "error" ? (
          <p className="text-[11px] text-red-300">{task.error}</p>
        ) : null}
        {task?.phase === "duplicate" ? (
          <p className="text-[11px] text-chalk-500">
            Ye file pehle se library me thi — wahi purani chun li gayi (dobara upload nahi hui).
          </p>
        ) : null}

        {loading ? (
          <p className="text-xs text-chalk-500">load ho raha hai…</p>
        ) : error ? (
          <p className="text-xs text-red-300">{error}</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-chalk-500">
            {allowUpload
              ? "Is kism ki koi file gallery me nahi hai. Upar se upload kar do — ek baar chadhne ke baad wo yahin mil jaayegi, agli reel me bhi."
              : "Is kism ki koi file abhi tak upload nahi hui. Baayein Media panel se pehle upload karo."}
          </p>
        ) : (
          <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-auto">
            {assets.map((asset) => (
              <AssetTile key={asset.id} asset={asset} onPick={onPick} />
            ))}
          </ul>
        )}

        {/*
          ⚠️ Ye line sirf jaankari nahi hai — wizard ka poora bharosa isi par
          tikta hai. Aadmi ko dikhna chahiye ki uski file kahin "wizard ke andar"
          nahi ja rahi; wo library me jaati hai aur agli baar wahin milegi.
        */}
        {allowUpload && assets.length > 0 ? (
          <p className="text-[10px] leading-snug text-chalk-500">
            Yahan se chadhi hui file library me hi jaati hai — agli baar isi gallery se chun
            lena, dobara upload karne ki zaroorat nahi.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function AssetTile({
  asset,
  onPick,
}: {
  asset: Asset;
  onPick(assetId: string, kind?: string): void;
}) {
  const { url: thumbUrl } = useAssetUrl(asset.thumbKey ? asset.id : null, { thumb: true });
  /*
   * ⚠️ Thumbnail sirf **bani hui reel** ka banta hai; aam upload ka nahi. Isliye
   * gallery me har uploaded file ek khaali dabba dikhti thi — naam ke alawa
   * pehchaan ka koi tarika nahi. Ab thumbnail na ho to asli file dikhti hai
   * (video par sirf uska pehla frame, `preload="metadata"` ke saath).
   */
  const { url: fullUrl } = useAssetUrl(!asset.thumbKey ? asset.id : null);
  const url = thumbUrl ?? fullUrl;

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(asset.id, asset.kind)}
        title={`${asset.filename} · ${formatBytes(asset.bytes)}`}
        className="w-full overflow-hidden rounded border border-ink-600 text-left transition-colors hover:border-terracotta"
      >
        {url && asset.kind === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={`${url}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            className="block h-16 w-full bg-ink-900 object-contain"
          />
        ) : (
          <span
            className="block h-16 w-full bg-ink-900 bg-contain bg-center bg-no-repeat"
            style={url && asset.kind !== "audio" ? { backgroundImage: `url(${url})` } : undefined}
          />
        )}
        <span className="block truncate px-1 py-0.5 text-[10px] text-chalk-500">
          {asset.filename}
        </span>
      </button>
    </li>
  );
}
