"use client";

import {
  EXPORT_PRESETS,
  estimateExportBytes,
  formatBytes,
  framesToSeconds,
  canExport,
  requireExportPreset,
  validateExportSettings,
  type ValidationIssue,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Info, Download, XCircle } from "lucide-react";
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
/**
 * Kisi bhi promise par ek hadd — taaki "kuch nahi ho raha" ek saaf error bane.
 *
 * ⚠️ Ye `Promise.race` hai, `AbortSignal` nahi, aur wo jaan-boojhkar: `saveNow()`
 * ke andar abort ka koi raasta hai hi nahi. Yahan maqsad request rokna nahi,
 * **user ko batana** hai — peeche ka kaam chalta rahe to koi nuksaan nahi.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${what} (${ms / 1000}s tak). Ek baar page reload karke dobara koshish karo — ` +
                `job shayad ban chuki ho, Renders panel dekh lena.`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

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
  /** Error nahi — kaam ho gaya, par ek baat jaanna zaroori hai. */
  const [notice, setNotice] = useState<string | null>(null);
  const [worker, setWorker] = useState<{ online: boolean; secondsAgo: number | null } | null>(null);
  /**
   * Worker kahan chalta hai — is PC par ya GitHub ke runner par (25.3).
   *
   * ⚠️ Iske bina "Worker offline" cloud par roz jhoothi chetavni banti hai:
   * runner tabhi uthta hai jab job aati hai, isliye Export dabane se **pehle**
   * wo hamesha offline hi hota hai. Wo chetavni par gaur karna user turant band
   * kar deta, aur phir asli wali (local worker chala hi nahi) bhi anpadhi jaati.
   */
  const [mode, setMode] = useState<"cloud" | "local">("local");

  // Worker zinda hai ya nahi — dialog khulte hi, aur phir har 5 second.
  useEffect(() => {
    if (!open) return;
    let alive = true;

    const check = async () => {
      try {
        const response = await fetch("/api/worker");
        const data = (await response.json()) as {
          worker?: { online: boolean; secondsAgo: number | null };
          mode?: "cloud" | "local";
        };
        if (!alive) return;
        if (data.worker) setWorker(data.worker);
        if (data.mode) setMode(data.mode);
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

  /*
   * ⚠️ Ab poora validator chalta hai (`validateExportSettings`), purana
   * `preflight()` nahi — aur wo ek hi jagah se aata hai jise worker bhi chalata
   * hai (20.7). Do jagah do list rakhne par ek din UI kuch kehta aur render
   * kuch aur, aur user ko lagta ki editor jhooth bol raha hai.
   */
  const check = validateExportSettings({ doc, presetId, assets: assetMap });
  const preset = requireExportPreset(presetId);
  const allowed = canExport(check, preset.tier);
  const bytes = estimateExportBytes(doc, presetId);
  const seconds = framesToSeconds(doc.project.durationInFrames, doc.project.fps);

  async function start(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      /*
       * Pehle save. Server DB se doc padhta hai, isliye bina save kiye export
       * karne par aakhri kuch edits chhoot jaati — aur wo galti tab dikhti hai
       * jab video ban chuki hoti hai.
       */
      /*
       * ⚠️ Dono par hadd lagi hui hai, aur ye ek asli halat dekhne ke baad aayi.
       *
       * Live par Export dabane par dialog **hamesha ke liye atak gaya**: button
       * disabled, koi error nahi, koi job nahi. Wajah kuch bhi ho sakti thi —
       * autosave ka flush jo laut hi na raha ho, ya ek request jiska jawab kabhi
       * na aaye. Par user ke liye dono ek jaisi dikhti hain: kuch nahi ho raha,
       * aur pata bhi nahi kyun.
       *
       * Bina hadd ke wo halat **kabhi khatam hi nahi hoti** — aadmi page reload
       * karta hai aur use aaj tak nahi pata chalta ki kya hua tha. Hadd lagne se
       * wo ek saaf jaawab me badal jaati hai jispar kuch kiya ja sakta hai.
       */
      await withTimeout(saveNow(), 15_000, "Project save hone me atak gaya");

      const response = await withTimeout(
        fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, preset: presetId, force: true }),
        }),
        30_000,
        "Server ne jawab hi nahi diya",
      );
      const data = (await response.json()) as {
        job?: { id: string };
        reason?: string;
        /** `false` = job to ban gayi par cloud worker jagaya nahi ja saka. */
        dispatched?: boolean | null;
      };
      if (!response.ok || !data.job) {
        setError(data.reason ?? `export shuru nahi hua (${response.status})`);
        return;
      }

      onStarted(data.job.id);

      /*
       * ⚠️ Dispatch fail hone par dialog **band nahi hota**, aur ye jaan-boojhkar
       * hai. Job ban chuki hai, isliye ye error nahi hai — par agar hum chup-chaap
       * band kar dete to user ko "queue me hai" dikhta aur wo ghanton wahi dekhta
       * rehta. Queue me hona aur kaam shuru hona do alag baatein hain; jab doosri
       * na hui ho, wo saaf bolna chahiye — waise hi jaise "worker offline" bolte hain.
       */
      if (data.dispatched === false) {
        setNotice(
          "Job queue me chali gayi, par cloud worker jagaya nahi ja saka (GitHub dispatch fail). " +
            "Repo ke Actions tab me \"reel-render\" workflow ko \"Run workflow\" se chala do — " +
            "job wahin se uth jaayegi.",
        );
        return;
      }

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

        {check.errors.length > 0 ? <IssueList issues={check.errors} level="error" /> : null}
        {check.warnings.length > 0 ? <IssueList issues={check.warnings} level="warning" /> : null}
        {check.recommendations.length > 0 ? (
          <IssueList issues={check.recommendations} level="info" />
        ) : null}

        {/*
         * Strict me warnings bhi rokti hain (20.6). Ye baat **pehle se** likhi
         * honi chahiye — warna user Export dabata hai, kuch nahi hota, aur wo
         * sochta hai button toota hua hai.
         */}
        {preset.tier === "strict" && check.warnings.length > 0 ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            <strong>Strict Quality</strong> me har chetavni bhi export rok deti hai. Upar wali{" "}
            {check.warnings.length} baat theek karo, ya koi doosra preset chuno.
          </p>
        ) : null}

        {/*
          Do alag baatein, do alag rang — kyunki inka matlab hi alag hai (25.3).

          Cloud par worker ka so raha hona **normal** hai: runner job aane par
          uthta hai. Wahan sirf itna batana hai ki pehli reel me 2-3 minute extra
          lagenge (checkout + npm ci + Chrome), taaki "atak gaya kya" wala shak
          na ho. Local par offline hona **galti** hai — koi worker chala hi nahi,
          aur job hamesha ke liye queue me padi rahegi.
        */}
        {worker && !worker.online ? (
          mode === "cloud" ? (
            <p className="rounded border border-ink-600 bg-ink-800/60 px-2 py-1.5 text-[11px] text-ink-200">
              <strong>Render cloud par hoga.</strong> Export dabate hi GitHub ka runner uthta hai —
              pehli reel me setup ka ~2-3 minute extra lagta hai, uske baad ki turant.
            </p>
          ) : (
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
          )
        ) : null}

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
            {notice}
          </p>
        ) : null}

        {/*
          ⚠️ Button ka band hona **dikhna** chahiye, sirf tooltip me nahi.

          Live par ye halat aayi thi: Export dabao, kuch nahi hota. Wajah upar
          error list me likhi thi, par button ke paas kuch nahi tha — aur aadmi
          button dabata hai, list nahi padhta. Bina wajah band button "toota hua"
          padha jaata hai, aur user reload karke dobara wahi karta hai.
        */}
        {!allowed ? (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            <strong>Export abhi band hai.</strong>{" "}
            {preset.tier === "strict" && check.errors.length === 0
              ? `Strict preset me ${check.warnings.length} chetavni bhi rokti hai — ya wo theek karo, ya doosra preset chuno.`
              : `Upar wali ${check.errors.length} error theek karni hongi.`}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Download size={14} />}
            disabled={busy || !allowed}
            title={
              allowed
                ? undefined
                : preset.tier === "strict"
                  ? "Strict me har chetavni bhi rokti hai — ya sab theek karo, ya doosra preset chuno"
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

function IssueList({
  issues,
  level,
}: {
  issues: ValidationIssue[];
  level: "error" | "warning" | "info";
}) {
  const isError = level === "error";
  /*
   * `info` ka apna rang hai (halka), aur ye zaroori hai. Use amber me dikhane
   * par wo chetavni ki tarah padha jaata hai — aur "4K se quality nahi badhegi"
   * ek jaankari hai, galti nahi. Sab kuch amber karne se do-teen baar me har
   * amber cheez anadekhi hone lagti hai.
   */
  return (
    <ul
      className={clsx(
        "space-y-1 rounded border px-2 py-1.5 text-[11px]",
        isError
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : level === "warning"
            ? "border-amber/40 bg-amber/10 text-amber"
            : "border-ink-600 bg-ink-900 text-chalk-400",
      )}
    >
      {issues.map((issue, index) => (
        <li key={`${issue.ruleId}-${index}`} className="flex items-start gap-1.5">
          {isError ? (
            <XCircle size={12} className="mt-0.5 shrink-0" />
          ) : level === "warning" ? (
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={12} className="mt-0.5 shrink-0" />
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
