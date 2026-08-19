"use client";

import { formatBytes } from "@reel/core";
import clsx from "clsx";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { Asset } from "@/lib/assets";
import { useAssetUrl } from "@/lib/assetUrls";

/**
 * Asset chunne ka button + dialog.
 *
 * ⚠️ Ye media library ko dobara nahi banata — wahi `GET /api/assets` chalta hai
 * jo LeftSidebar ka Media panel chalata hai, sirf kind ka filter alag hota hai.
 * Do alag list rakhne par upload karne ke baad ek me nayi file dikhti aur doosri
 * me nahi, aur uski wajah dhoondhna bekaar ka kaam hota.
 *
 * ⚠️ Upload yahan se **nahi** hota. Beginner ko ek jagah upload karna aur doosri
 * jagah chunna sikhana ulta lagta hai, par upload ka poora chakkar (progress,
 * cancel, retry, duplicate) Media panel me hai — usko yahan dobara likhna do
 * jagah do vyavhaar bana deta. Dialog me saaf likha hai ki file pehle Media
 * panel se aati hai.
 */
export function AssetPickerButton({
  kind,
  assetId,
  onPick,
}: {
  /** `null` = koi bhi kind. */
  kind: string | null;
  assetId: string | null;
  onPick(assetId: string): void;
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
          {assetId ? "Badlo…" : "Chuno…"}
        </span>
      </button>

      <AssetPickerDialog
        open={open}
        kind={kind}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          onPick(id);
          setOpen(false);
        }}
      />
    </>
  );
}

function AssetPickerDialog({
  open,
  kind,
  onClose,
  onPick,
}: {
  open: boolean;
  kind: string | null;
  onClose(): void;
  onPick(assetId: string): void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    void (async () => {
      try {
        // Tab id `LIBRARY_TABS` se milti hai — "image" kind ka tab "images" hai.
        const tab = kind ? `${kind}s` : "all";
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
  }, [open, kind]);

  return (
    <Modal open={open} title={`${kind ?? "Koi bhi"} chuno`} onClose={onClose}>
      {loading ? (
        <p className="text-xs text-chalk-500">load ho raha hai…</p>
      ) : error ? (
        <p className="text-xs text-red-300">{error}</p>
      ) : assets.length === 0 ? (
        <p className="text-xs text-chalk-500">
          Is kism ki koi file abhi tak upload nahi hui. Baayein Media panel se pehle upload
          karo — upload ka poora chakkar (progress, cancel, duplicate detect) wahin hai.
        </p>
      ) : (
        <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-auto">
          {assets.map((asset) => (
            <AssetTile key={asset.id} asset={asset} onPick={onPick} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

function AssetTile({ asset, onPick }: { asset: Asset; onPick(assetId: string): void }) {
  const { url } = useAssetUrl(asset.id, { thumb: true });

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(asset.id)}
        title={`${asset.filename} · ${formatBytes(asset.bytes)}`}
        className="w-full overflow-hidden rounded border border-ink-600 text-left transition-colors hover:border-terracotta"
      >
        <span
          className="block h-16 w-full bg-ink-900 bg-contain bg-center bg-no-repeat"
          style={url ? { backgroundImage: `url(${url})` } : undefined}
        />
        <span className="block truncate px-1 py-0.5 text-[10px] text-chalk-500">
          {asset.filename}
        </span>
      </button>
    </li>
  );
}
