"use client";

import { formatBytes } from "@reel/core";
import clsx from "clsx";
import { Download, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import type { RenderJob } from "@/lib/renders";
import { useEditorStore } from "@/lib/store";

/**
 * Render history + live progress (11.10 / 11.11).
 *
 * ⚠️ Polling ka antaraal **haalat ke hisaab se** badalta hai: kuch chal raha ho
 * to 1.5 second, warna 10 second. Hamesha 1.5s par poll karna DB par bekaar bojh
 * hai (studio ghanton khula rehta hai), aur hamesha 10s par progress bar jhatke
 * se chalta hai — dono se bachne ka yahi seedha tarika hai.
 *
 * ⚠️ Har number **worker ka naapa hua** hai (`job.meta`), UI ka andaaza nahi:
 * codec, profile, sample rate, aur loudness sab render ke baad ffprobe/ebur128
 * se aaye hain. Export dialog ke andaaze aur yahan ke numbers me farak dikhna
 * bilkul theek hai — isi liye dono jagah saaf likha hai ki kaunsa kya hai.
 */

/**
 * Batti ke saath ka text.
 *
 * ⚠️ Cloud me "Worker offline" likhna sach hote hue bhi gumraah karta hai — wo
 * padha "kuch toota hai" jaata hai, jabki runner ka so raha hona bilkul normal
 * haal hai. Isliye wahan wahi likha hai jo sach me ho raha hai: worker so raha
 * hai, aur job aate hi jaag jaayega.
 */
function workerLabel(online: boolean, mode: "cloud" | "local"): string {
  if (online) return mode === "cloud" ? "Cloud worker chal raha hai" : "Worker chal raha hai";
  return mode === "cloud" ? "Cloud worker so raha hai (job par jaagega)" : "Worker offline";
}

export function RendersPanel() {
  const projectId = useEditorStore((state) => state.projectId);

  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [worker, setWorker] = useState<{ online: boolean; secondsAgo: number | null } | null>(null);
  /** Worker kahan chalta hai — is PC par ya GitHub ke runner par (25.3). */
  const [mode, setMode] = useState<"cloud" | "local">("local");
  /** Cloud worker + local storage — ek aisi galti jo khud kabhi nahi dikhti (25.6). */
  const [storageMismatch, setStorageMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [jobsResponse, workerResponse] = await Promise.all([
        fetch(`/api/render?projectId=${projectId}`),
        fetch("/api/worker"),
      ]);

      const jobsData = (await jobsResponse.json()) as { jobs?: RenderJob[]; reason?: string };
      if (!jobsResponse.ok) {
        setError(jobsData.reason ?? `${jobsResponse.status}`);
      } else {
        setJobs(jobsData.jobs ?? []);
        setError(null);
      }

      const workerData = (await workerResponse.json()) as {
        worker?: { online: boolean; secondsAgo: number | null };
        mode?: "cloud" | "local";
        storageMismatch?: boolean;
      };
      if (workerData.worker) setWorker(workerData.worker);
      if (workerData.mode) setMode(workerData.mode);
      setStorageMismatch(workerData.storageMismatch === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const busy = jobs.some((job) => job.status === "queued" || job.status === "processing");

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), busy ? 1500 : 10_000);
    return () => clearInterval(timer);
  }, [load, busy]);

  async function cancel(jobId: string): Promise<void> {
    await fetch(`/api/render/${jobId}`, { method: "DELETE" });
    void load();
  }

  async function download(jobId: string): Promise<void> {
    const response = await fetch(`/api/render/${jobId}/url?download=1`);
    const data = (await response.json()) as { url?: string; reason?: string };
    if (!response.ok || !data.url) {
      setError(data.reason ?? "download link nahi mila");
      return;
    }
    window.open(data.url, "_blank", "noopener");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-ink-600 px-3 py-1.5">
        <span
          className={clsx(
            "h-2 w-2 shrink-0 rounded-full",
            worker?.online ? "bg-emerald-400" : "bg-ink-500",
          )}
          title={workerLabel(worker?.online === true, mode)}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-500">
          {workerLabel(worker?.online === true, mode)}
        </span>
        <IconButton className="h-6 w-6" title="Refresh" aria-label="Refresh" onClick={() => void load()}>
          <RefreshCw size={11} />
        </IconButton>
      </div>

      {/*
        ⚠️ Ye laal hai, peeli nahi — kyunki ye "shayad" nahi, "pakka" hai. Cloud
        worker GitHub ke runner par chalta hai; wo tumhare disk ko kabhi nahi dekh
        sakta. Is haalat me har render ya to "asset nahi mili" par marega, ya ban
        kar runner ki us disk par chala jaayega jo run khatam hote hi mit jaati
        hai. Dono soorat me galti do minute ka setup jala kar dikhti hai.
      */}
      {storageMismatch ? (
        <p className="border-b border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-300">
          <strong>Cloud worker hai, par storage local hai.</strong> Runner tumhare disk ko nahi
          dekh sakta — render fail hoga. Pehle purani media R2 par chadhao:
          <br />
          <code className="font-mono text-[11px]">
            npm run migrate:r2 --workspace @reel/worker
          </code>
          <br />
          phir studio ka <code className="font-mono text-[11px]">REEL_STORAGE_DRIVER=r2</code> karo
          (R2 ki chaaron keys ke saath).
        </p>
      ) : null}

      {worker && !worker.online && mode === "local" ? (
        /*
         * 11.13 — "jhooth nahi". Ye line heartbeat par tiki hai, andaaze par
         * nahi, aur usme wahi command hai jo sach me chalani hai.
         *
         * ⚠️ Cloud mode me ye line **nahi** dikhti, aur ye zaroori hai (25.3):
         * wahan worker ka so raha hona normal haal hai (runner job aane par
         * uthta hai), aur `npm run dev:worker` ka koi matlab hi nahi. Har baar
         * dikhne wali chetavni kuch dinon me anpadhi ho jaati hai — aur uske
         * saath wo bhi jo sach me zaroori thi.
         */
        <p className="border-b border-amber/30 bg-amber/10 px-3 py-2 text-[11px] leading-snug text-amber">
          Render tab tak shuru nahi hoga. Ek doosre terminal me chalao:
          <br />
          <code className="font-mono text-[11px]">npm run dev:worker</code>
        </p>
      ) : null}

      {error ? (
        <p className="border-b border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <p className="p-3 text-xs text-chalk-500">load ho raha hai…</p>
        ) : jobs.length === 0 ? (
          <p className="p-3 text-xs text-chalk-500">
            Abhi tak koi export nahi. Upar TopBar se Export dabao.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onCancel={cancel} onDownload={download} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<RenderJob["status"], string> = {
  queued: "line me",
  processing: "chal raha hai",
  completed: "ho gaya",
  failed: "fail",
  cancelled: "cancel",
};

function JobRow({
  job,
  onCancel,
  onDownload,
}: {
  job: RenderJob;
  onCancel(jobId: string): Promise<void>;
  onDownload(jobId: string): Promise<void>;
}) {
  const running = job.status === "queued" || job.status === "processing";
  const meta = job.meta as {
    video?: { codec?: string; profile?: string; pixelFormat?: string; width?: number; height?: number };
    audio?: { codec?: string; sampleRate?: number; channels?: number };
    loudness?: { integratedLufs?: number | null; truePeakDb?: number | null; normalized?: boolean };
    stage?: string;
  };

  return (
    <li className="space-y-1 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase",
            job.status === "completed" && "bg-emerald-500/20 text-emerald-300",
            job.status === "failed" && "bg-red-500/20 text-red-300",
            job.status === "cancelled" && "bg-ink-700 text-chalk-500",
            running && "bg-terracotta/20 text-amber",
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-300">
          {job.preset}
          {job.attempts > 1 ? ` · koshish ${job.attempts}` : ""}
        </span>

        {running ? (
          <IconButton className="h-6 w-6" variant="danger" title="Cancel" aria-label="Cancel" onClick={() => void onCancel(job.id)}>
            <X size={11} />
          </IconButton>
        ) : null}
        {job.status === "completed" ? (
          <Button
            className="px-1.5 py-0.5 text-[11px]"
            icon={<Download size={11} />}
            onClick={() => void onDownload(job.id)}
          >
            Download
          </Button>
        ) : null}
      </div>

      {running ? (
        <div className="flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded bg-ink-700">
            <span
              className="block h-full bg-terracotta transition-[width]"
              style={{ width: `${job.progress}%` }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] text-chalk-500">
            {job.progress}%{meta.stage ? ` · ${meta.stage}` : ""}
          </span>
        </div>
      ) : null}

      {job.error ? <p className="text-[11px] text-red-300">{job.error}</p> : null}

      {job.status === "completed" ? (
        <div className="space-y-0.5 font-mono text-[10px] text-chalk-500">
          <p>
            {meta.video?.width}×{meta.video?.height} · {meta.video?.codec}
            {meta.video?.profile ? ` ${meta.video.profile}` : ""} · {meta.video?.pixelFormat}
          </p>
          <p>
            {meta.audio?.codec} {meta.audio?.sampleRate}Hz {meta.audio?.channels}ch ·{" "}
            {job.bytes === null ? "?" : formatBytes(job.bytes)} ·{" "}
            {job.durationMs === null ? "?" : `${(job.durationMs / 1000).toFixed(1)}s me bani`}
          </p>
          {meta.loudness?.integratedLufs !== null && meta.loudness?.integratedLufs !== undefined ? (
            <p className={clsx(Math.abs(meta.loudness.integratedLufs + 14) > 2 && "text-amber")}>
              {meta.loudness.integratedLufs.toFixed(1)} LUFS · peak{" "}
              {meta.loudness.truePeakDb?.toFixed(1) ?? "?"} dBTP
              {meta.loudness.normalized ? "" : " (normalize nahi hui)"}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
