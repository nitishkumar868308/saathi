"use client";

import {
  assetQuality,
  formatBytes,
  getAssetKind,
  libraryTags,
} from "@reel/core";
import clsx from "clsx";
import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Asset } from "@/lib/assets";
import { forgetAssetUrl, useAssetUrl } from "@/lib/assetUrls";
import { timeAgo } from "@/lib/format";

/**
 * Ek asset ka poora byora — aur wahi teen kaam jo yahin hone chahiye:
 * naam badalna, tag lagana, aur delete karna.
 *
 * ⚠️ Delete par server pehle dekhta hai ki asset kisi project me laga to nahi.
 * Laga ho to 409 aata hai aur yahan **saaf likha jaata hai ki kis project me
 * kitne items par**. User tab hi force kar sakta hai. Chupchaap mita dena
 * matlab kal us project ka render "asset nahi mila" par phatna.
 */

interface Usage {
  projectId: string;
  projectName: string;
  itemCount: number;
}

interface Props {
  asset: Asset | null;
  target: { width: number; height: number } | null;
  onClose(): void;
  onChanged(asset: Asset): void;
  onDeleted(assetId: string): void;
}

export function AssetDetailDialog({ asset, target, onClose, onChanged, onDeleted }: Props) {
  const [name, setName] = useState(asset?.filename ?? "");
  const [usage, setUsage] = useState<Usage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { url } = useAssetUrl(asset?.id ?? null, { thumb: Boolean(asset?.thumbKey) });

  useEffect(() => {
    setName(asset?.filename ?? "");
    setUsage([]);
    setError(null);
    setConfirmDelete(false);
    if (!asset) return;

    // Usage har baar taaza — purani list dikhana delete ke faisle me sabse
    // khatarnak jhooth hoga.
    let alive = true;
    void fetch(`/api/assets/${asset.id}`)
      .then((response) => response.json())
      .then((data: { usage?: Usage[] }) => {
        if (alive) setUsage(data.usage ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [asset]);

  if (!asset) return null;

  const kind = getAssetKind(asset.kind);
  const quality = assetQuality(asset, target);
  const meta = asset.meta as Record<string, unknown>;
  const probeError = typeof meta.probeError === "string" ? meta.probeError : null;

  async function patch(body: Record<string, unknown>) {
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        asset?: Asset;
        reason?: string;
        error?: string;
      };
      if (!response.ok || !data.asset) {
        setError(data.reason ?? data.error ?? `${response.status}`);
        return;
      }
      onChanged(data.asset);
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    ["Kism", kind?.label ?? asset.kind],
    ["Size", formatBytes(asset.bytes)],
    ...(asset.width && asset.height
      ? ([["Resolution", `${asset.width}x${asset.height}`]] as [string, string][])
      : []),
    ...(asset.durationMs !== null
      ? ([["Lambai", `${(asset.durationMs / 1000).toFixed(2)}s`]] as [string, string][])
      : []),
    ...(asset.fps ? ([["fps", String(asset.fps)]] as [string, string][]) : []),
    ...(meta.videoCodec ? ([["Video codec", String(meta.videoCodec)]] as [string, string][]) : []),
    ...(meta.videoProfile ? ([["Profile", String(meta.videoProfile)]] as [string, string][]) : []),
    ...(meta.pixelFormat ? ([["Pixel format", String(meta.pixelFormat)]] as [string, string][]) : []),
    ...(meta.rotation ? ([["Rotation", `${String(meta.rotation)}°`]] as [string, string][]) : []),
    ...(meta.audioCodec ? ([["Audio codec", String(meta.audioCodec)]] as [string, string][]) : []),
    ...(asset.sampleRate
      ? ([["Sample rate", `${asset.sampleRate} Hz`]] as [string, string][])
      : []),
    ...(asset.channels ? ([["Channels", String(asset.channels)]] as [string, string][]) : []),
    ...(meta.totalBitRate
      ? ([["Bitrate", `${Math.round(Number(meta.totalBitRate) / 1000)} kbps`]] as [string, string][])
      : []),
    ["Lifecycle", asset.lifecycle],
    ["Aaya", timeAgo(asset.createdAt)],
  ];

  return (
    <Modal
      open
      title="Asset"
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            icon={<RefreshCw size={14} />}
            disabled={busy}
            title="ffprobe dobara chalao (thumbnail bhi banega)"
            onClick={async () => {
              setBusy(true);
              setError(null);
              const response = await fetch(`/api/assets/${asset.id}/probe`, { method: "POST" });
              const data = (await response.json().catch(() => ({}))) as {
                asset?: Asset;
                reason?: string;
              };
              setBusy(false);
              if (data.asset) {
                forgetAssetUrl(asset.id);
                onChanged(data.asset);
              }
              if (!response.ok) setError(data.reason ?? "probe fail");
            }}
          >
            Dobara probe
          </Button>
          <span className="flex-1" />
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const response = await fetch(
                `/api/assets/${asset.id}${confirmDelete ? "?force=true" : ""}`,
                { method: "DELETE" },
              );
              const data = (await response.json().catch(() => ({}))) as {
                usage?: Usage[];
                reason?: string;
              };
              setBusy(false);

              if (response.status === 409) {
                // Pehla click sirf batata hai — mitata doosra click hai.
                setUsage(data.usage ?? []);
                setConfirmDelete(true);
                setError(data.reason ?? "ye asset use ho raha hai");
                return;
              }
              if (!response.ok) {
                setError(data.reason ?? `${response.status}`);
                return;
              }
              forgetAssetUrl(asset.id);
              onDeleted(asset.id);
            }}
          >
            {confirmDelete ? "Phir bhi mitao" : "Mitao"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="flex items-start justify-center rounded-lg bg-ink-950 p-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL.
            <img src={url} alt="" className="max-h-56 w-full object-contain" />
          ) : (
            <span className="py-10 text-xs text-chalk-500">preview nahi hai</span>
          )}
        </div>

        <div className="min-w-0">
          <label className="block text-xs uppercase tracking-wide text-chalk-500">Naam</label>
          <div className="mt-1 flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm outline-none focus:border-terracotta"
            />
            <Button
              disabled={busy || !name.trim() || name === asset.filename}
              onClick={() => void patch({ filename: name.trim() })}
            >
              Rakh do
            </Button>
          </div>

          <div className="mt-3 text-xs uppercase tracking-wide text-chalk-500">Tags</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {libraryTags().map((tag) => {
              const on = asset.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void patch({
                      tags: on ? asset.tags.filter((t) => t !== tag) : [...asset.tags, tag],
                    })
                  }
                  className={clsx(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    on
                      ? "border-terracotta bg-terracotta/15 text-chalk-100"
                      : "border-ink-600 text-chalk-500 hover:bg-ink-700",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div
            className={clsx(
              "mt-3 rounded-md px-2 py-1.5 text-xs",
              quality.level === "good"
                ? "bg-emerald-500/10 text-emerald-300"
                : quality.level === "ok"
                  ? "bg-amber/10 text-amber"
                  : quality.level === "low"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-ink-700 text-chalk-500",
            )}
          >
            {quality.detail}
          </div>

          {probeError ? (
            <p className="mt-2 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
              probe fail hua tha: {probeError}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ink-600 pt-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-chalk-500">{label}</dt>
            <dd className="truncate font-mono text-chalk-100">{value}</dd>
          </div>
        ))}
      </dl>

      {usage.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
          Ye asset in projects me laga hua hai:
          <ul className="mt-1 space-y-0.5">
            {usage.map((entry) => (
              <li key={entry.projectId}>
                • {entry.projectName} — {entry.itemCount} item
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </Modal>
  );
}
