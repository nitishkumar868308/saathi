"use client";

import {
  EXPORT_PRESETS,
  estimateExportBytes,
  formatBytes,
  framesToSeconds,
  preflight,
  type PreflightIssue,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Download, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";

/**
 * Export dialog (11.5).
 *
 * ⚠️ Yahan ki jaanch (`preflight`) **soojh-boojh hai, deewar nahi** — asli rok
 * `POST /api/render` par bhi lagti hai. Sirf yahan rakhne par AI patch, script,
 * ya ek purana khula tab seedha job bana sakta tha.
 *
 * ⚠️ File size aur waqt dono par saaf likha hai ki ye **andaaze** hain. CRF
 * variable bitrate deta hai; ek sthir number dikhana jhooth hoga, aur us jhooth
 * ka pata tab chalta hai jab file aa chuki hoti hai.
 */
export function ExportDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose(): void;
  onStarted(jobId: string): void;
}) {
  const doc = useEditorStore((state) => state.doc);
  const projectId = useEditorStore((state) => state.projectId);
  const saveNow = useEditorStore((state) => state.saveNow);
  const meta = useAssetDurations(doc.project.fps);

  const [presetId, setPresetId] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worker, setWorker] = useState<{ online: boolean; secondsAgo: number | null } | null>(null);

  // Worker zinda hai ya nahi — dialog khulte hi, aur phir har 5 second.
  useEffect(() => {
    if (!open) return;
    let alive = true;

    const check = async () => {
      try {
        const response = await fetch("/api/worker");
        const data = (await response.json()) as { worker?: { online: boolean; secondsAgo: number | null } };
        if (alive && data.worker) setWorker(data.worker);
      } catch {
        if (alive) setWorker({ online: false, secondsAgo: null });
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [open]);

  const assetMap: Record<string, { width: number | null; height: number | null; durationMs: number | null }> = {};
  for (const item of doc.items) {
    if (!item.assetId || assetMap[item.assetId]) continue;
    const size = meta.sourceSize(item.assetId);
    const frames = meta.sourceFrames(item.assetId);
    // Asset list load hone se pehle jaanch chalana galat warning deta hai —
    // isliye tab tak wo asset "pata nahi" ki jagah "maujood" maana jaata hai.
    if (!meta.loaded) {
      assetMap[item.assetId] = { width: null, height: null, durationMs: null };
      continue;
    }
    if (size || frames !== null) {
      assetMap[item.assetId] = {
        width: size?.width ?? null,
        height: size?.height ?? null,
        durationMs: frames === null ? null : (frames / doc.project.fps) * 1000,
      };
    }
  }

  const check = preflight({ doc, presetId, assets: assetMap });
  const bytes = estimateExportBytes(doc, presetId);
  const seconds = framesToSeconds(doc.project.durationInFrames, doc.project.fps);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      /*
       * Pehle save. Server DB se doc padhta hai, isliye bina save kiye export
       * karne par aakhri kuch edits chhoot jaati — aur wo galti tab dikhti hai
       * jab video ban chuki hoti hai.
       */
      await saveNow();

      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, preset: presetId, force: true }),
      });
      const data = (await response.json()) as { job?: { id: string }; reason?: string };
      if (!response.ok || !data.job) {
        setError(data.reason ?? `export shuru nahi hua (${response.status})`);
        return;
      }
      onStarted(data.job.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Export" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="space-y-2">
          {EXPORT_PRESETS.list().map((preset) => (
            <label
              key={preset.id}
              className={clsx(
                "flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5",
                preset.id === presetId ? "border-terracotta bg-terracotta/10" : "border-ink-600",
              )}
            >
              <input
                type="radio"
                name="preset"
                checked={preset.id === presetId}
                onChange={() => setPresetId(preset.id)}
                className="mt-1 accent-terracotta"
              />
              <span className="min-w-0">
                <span className="block text-chalk-100">{preset.label}</span>
                <span className="block text-[11px] text-chalk-500">{preset.hint}</span>
                <span className="block font-mono text-[10px] text-chalk-500">
                  CRF {preset.crf} · x264 {preset.x264Preset} · audio {preset.audioBitrateKbps}k
                </span>
              </span>
            </label>
          ))}
        </div>

        <dl className="space-y-1 rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px]">
          <Row label="Size" value={`${doc.project.width}×${doc.project.height} @ ${doc.project.fps}fps`} />
          <Row label="Lambai" value={`${seconds.toFixed(1)}s (${doc.project.durationInFrames} frames)`} />
          <Row label="File (andaaza)" value={`~${formatBytes(bytes)}`} />
          <Row
            label="Waqt (andaaza)"
            value={`~${estimateMinutes(doc.project.durationInFrames, presetId)}`}
          />
        </dl>
        <p className="text-[10px] leading-snug text-chalk-500">
          Size aur waqt dono **andaaze** hain — CRF variable bitrate deta hai, aur render ki
          raftaar tumhare CPU par nirbhar hai. Asli numbers render ke baad history me dikhte
          hain.
        </p>

        {check.errors.length > 0 ? (
          <IssueList issues={check.errors} level="error" />
        ) : null}
        {check.warnings.length > 0 ? (
          <IssueList issues={check.warnings} level="warning" />
        ) : null}

        {worker && !worker.online ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
            <strong>Worker offline hai.</strong> Job queue me chali jaayegi par render tab tak
            shuru nahi hoga. Ek doosre terminal me chalao:{" "}
            <code className="font-mono">npm run dev:worker</code>
            {worker.secondsAgo !== null ? (
              <span className="block text-[10px] opacity-80">
                aakhri dhadkan {worker.secondsAgo}s pehle
              </span>
            ) : null}
          </p>
        ) : null}

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Download size={14} />}
            disabled={busy || !check.canExport}
            title={
              check.canExport
                ? undefined
                : "Pehle upar wali error theek karo — aadhi-adhoori video banane me waqt bekaar jaata hai"
            }
            onClick={() => void start()}
          >
            {busy ? "shuru ho raha hai…" : check.warnings.length > 0 ? "Phir bhi export karo" : "Export"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Rehne do
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-chalk-500">{label}</dt>
      <dd className="font-mono text-chalk-300">{value}</dd>
    </div>
  );
}

function IssueList({ issues, level }: { issues: PreflightIssue[]; level: "error" | "warning" }) {
  const isError = level === "error";
  return (
    <ul
      className={clsx(
        "space-y-1 rounded border px-2 py-1.5 text-[11px]",
        isError ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-amber/40 bg-amber/10 text-amber",
      )}
    >
      {issues.map((issue, index) => (
        <li key={`${issue.ruleId}-${index}`} className="flex items-start gap-1.5">
          {isError ? (
            <XCircle size={12} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Render me kitna waqt lagega — mota andaaza.
 *
 * ⚠️ Base number is machine ke asli render se aaya hai (`npm run render:sample`:
 * 300 frames, ~42s, yaani ~7 fps `standard` par). Ye har CPU par alag hoga,
 * isliye UI me saaf likha hai ki andaaza hai. Ek "sahi" number dikhane ke liye
 * pichhle renders ka ausat rakhna behtar hoga — wo Phase 20 me history ke saath.
 */
function estimateMinutes(frames: number, presetId: string): string {
  const BASE_FPS = 7;
  const speed: Record<string, number> = { draft: 3, standard: 1, high: 0.55, uhd: 0.3 };
  const fps = BASE_FPS * (speed[presetId] ?? 1);
  const seconds = frames / fps;

  if (seconds < 90) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)} min`;
}
