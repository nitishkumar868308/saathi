"use client";

import { formatBytes } from "@reel/core";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Asset } from "@/lib/assets";
import { forgetAssetMeta } from "@/lib/assetMeta";

/**
 * File hamesha ke liye mitane ki tasdeek (26.24).
 *
 * ⚠️ **Ye delete wapas nahi aata**, aur wahi is dialog ke hone ki poori wajah
 * hai. `DELETE /api/assets/[id]` teen kaam karta hai: storage (R2 ya local disk)
 * se file, uska thumbnail, aur DB ki row — teeno chale jaate hain. Koi trash
 * nahi hai, koi undo nahi. Timeline ka `Ctrl+Z` yahan kuch nahi kar sakta: wo doc
 * ke andar ka itihaas hai, aur file doc ke bahar hai.
 *
 * ⚠️ "Kahan-kahan laga hai" pehle dikhaya jaata hai, mitane ke BAAD nahi. Server
 * bhi ye rokta hai (409 bina `?force=true` ke), par sirf rok dena kaafi nahi —
 * aadmi ko dikhna chahiye ki kaunsi reel tootegi, warna wo `force` bina samjhe
 * daba deta hai. Aur us reel ka render mahinon baad "asset nahi mila" par phat'ta
 * hai, jab yaad bhi nahi hota ki kya mitaya tha.
 */

interface Usage {
  projectId: string;
  projectName: string;
  itemCount: number;
}

export function DeleteAssetDialog({
  asset,
  onClose,
  onDeleted,
}: {
  /** `null` = dialog band. */
  asset: Asset | null;
  onClose(): void;
  onDeleted(assetId: string): void;
}) {
  const [usage, setUsage] = useState<Usage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Server ne "laga hua hai" keh kar roka — ab `force` ke saath poochhna hai. */
  const [blocked, setBlocked] = useState(false);

  const assetId = asset?.id ?? null;

  useEffect(() => {
    setUsage(null);
    setError(null);
    setBlocked(false);
    if (!assetId) return;

    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/assets/${assetId}`);
        const data = (await response.json()) as { usage?: Usage[] };
        if (alive) setUsage(data.usage ?? []);
      } catch {
        /*
         * Usage na aa paana mitane ko rokta nahi — server phir bhi 409 dega.
         * Yahan chup rehna theek hai: ek aur laal line dikhane par aadmi samajhta
         * hai ki delete hi toota hua hai, jabki wo bilkul chalta hai.
         */
        if (alive) setUsage([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [assetId]);

  async function remove(force: boolean): Promise<void> {
    if (!asset) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${asset.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { reason?: string; usage?: Usage[] };

      if (response.status === 409) {
        // Laga hua hai — ab saaf poochho, chup-chaap force mat karo.
        setUsage(data.usage ?? []);
        setBlocked(true);
        return;
      }
      if (!response.ok) throw new Error(data.reason ?? `HTTP ${response.status}`);

      // List ki naapi hui lambai ka cache — mit chuki file uske andar padi reh jaati.
      forgetAssetMeta();
      onDeleted(asset.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!asset) return null;

  const inUse = (usage?.length ?? 0) > 0;

  return (
    <Modal
      open
      title="Hamesha ke liye mitao?"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">
            Ye wapas nahi aayega.
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Rehne do
          </Button>
          <Button
            variant="danger"
            onClick={() => void remove(blocked)}
            disabled={busy}
            icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          >
            {blocked ? "Phir bhi mitao" : "Mitao"}
          </Button>
        </div>
      }
    >
      <div className="space-y-2 text-sm">
        <p className="text-chalk-300">
          <span className="text-chalk-100">{asset.filename}</span>
          <span className="text-chalk-500"> · {formatBytes(asset.bytes)}</span>
        </p>

        <p className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-chalk-400">
          File <strong className="text-chalk-100">storage se</strong> (R2 / disk) aur uski row{" "}
          <strong className="text-chalk-100">database se</strong> — dono mit jaayenge. Koi trash
          nahi hai aur Ctrl+Z yahan kaam nahi karta.
        </p>

        {usage === null ? (
          <p className="text-[11px] text-chalk-500">dekh raha hoon ki ye kahan-kahan laga hai…</p>
        ) : inUse ? (
          <div className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
            <p className="flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                Ye file {usage.length} project me lagi hui hai. Mitane par un reels me uski jagah
                khaali card aayega, aur unka render <strong>fail</strong> hoga:
              </span>
            </p>
            <ul className="mt-1 list-disc pl-5">
              {usage.map((entry) => (
                <li key={entry.projectId}>
                  {entry.projectName} — {entry.itemCount} item
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[11px] text-chalk-500">
            Ye file kisi project me nahi lagi — mitana surakshit hai.
          </p>
        )}

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
