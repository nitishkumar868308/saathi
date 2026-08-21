"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Film, Loader2, Play, RefreshCw } from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * "Video" — jo reel ban chuki hai, aur jo abhi ban rahi hai.
 *
 * ⚠️ Queue wali jobs bhi yahin dikhti hain, alag screen par nahi. "Kaun si bani"
 * aur "kaun si atki hai" asal me ek hi sawaal ke do sire hain — do jagah baant
 * dene par atki hui job wahan padi rehti hai jahan koi dekhta hi nahi.
 *
 * ⚠️ Jab tak koi render chal raha hai, list **apne aap** taaza hoti hai — par
 * uske baad ruk jaati hai. Hamesha poll karte rehna dev server par har 5 second
 * ek query maarta rehta, bina kisi wajah ke; aur na karne par progress bar ek
 * hi jagah jama rehta aur wo "atak gaya" jaisa dikhta.
 */

type Job = {
  id: string;
  name: string;
  status: string;
  progress: number;
  preset: string;
  bytes: number | null;
  durationMs: number | null;
  key: string | null;
  thumbKey: string | null;
  error: string | null;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

/** Jin haalaton me kaam abhi chal raha hai — inhi par list khud taaza hoti hai. */
const LIVE = new Set(["queued", "processing"]);
const POLL_MS = 5000;

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusTint(status: string): string {
  if (status === "completed") return "bg-sage/15 text-sage";
  if (status === "failed") return "bg-terracotta/10 text-terracotta";
  if (status === "processing") return "bg-amber-warm/15 text-amber-warm";
  return "bg-ink/5 text-ink-soft";
}

function mediaUrl(key: string): string {
  return `/api/admin/reel-studio/video?key=${encodeURIComponent(key)}`;
}

export default function AdminReelVideos() {
  const at = useAdminT();
  const t = at.data.reelStudio;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  // ⚠️ Ref me rakha hai, state me nahi. State me rakhne par har poll ek naya
  // interval banata aur purana chalta rehta — teen minute me dus query ek saath.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/admin/reel-studio/jobs?limit=40", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "read failed");
      setJobs((data.jobs ?? []) as Job[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "read failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useMemo(() => jobs.filter((j) => LIVE.has(j.status)), [jobs]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (live.length === 0) return;
    // `quiet` — skeleton dobara nahi dikhta, warna har 5 second poori list
    // jhilmilati hai aur padhna hi mushkil ho jaata hai.
    timer.current = setTimeout(() => void load(true), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [live.length, jobs, load]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {live.length > 0 && (
            <span className="inline-flex items-center gap-2 font-semibold text-amber-warm">
              <Loader2 size={14} className="animate-spin" />
              {atpl(t.liveNote, { n: String(live.length) })}
            </span>
          )}
        </p>
        <button
          onClick={() => void load()}
          className="inline-flex h-10 min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {at.common.refresh}
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta" />
          <p className="text-sm leading-relaxed text-ink">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-5 rounded-3xl border border-line bg-surface p-5">
          <SkeletonRows rows={4} />
        </div>
      ) : jobs.length === 0 ? (
        <p className="mt-5 rounded-3xl border border-line bg-surface p-6 text-sm text-ink-soft">
          {t.videosNone}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {jobs.map((job) => {
            const ready = job.status === "completed" && job.key;
            const open = playing === job.id;
            return (
              <div key={job.id} className="overflow-hidden rounded-3xl border border-line bg-surface">
                {/* Tasveer / player */}
                {/*
                  ⚠️ Sirf `aspect-[9/16]` — pehle iske saath `max-h` bhi tha aur
                  wo ek asli gadbad thi: aspect-ratio wala box oonchai ki rok
                  lagne par **chaudai** ghata deta hai (420 x 9/16 = 236px), aur
                  card ke daayein safed patti chhod deta hai. Card chhota rakhna
                  ho to column badhao, oonchai mat baandho.
                */}
                <div className="relative aspect-[9/16] bg-ink/5">
                  {open && job.key ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={mediaUrl(job.key)}
                      controls
                      autoPlay
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : job.thumbKey && job.status === "completed" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(job.thumbKey)}
                      alt={job.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-soft">
                      {LIVE.has(job.status) ? (
                        <Loader2 size={28} className="animate-spin" />
                      ) : (
                        <Film size={28} />
                      )}
                    </div>
                  )}

                  {ready && !open && (
                    <button
                      onClick={() => setPlaying(job.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition hover:opacity-100"
                      aria-label={job.name}
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-ink shadow-warm">
                        <Play size={22} className="ml-1" />
                      </span>
                    </button>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{job.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTint(
                        job.status,
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Chal rahi job — progress hi asli khabar hai */}
                  {LIVE.has(job.status) && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="h-full rounded-full bg-amber-warm transition-all"
                          style={{ width: `${Math.max(2, job.progress)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-soft">
                        {job.status === "queued" ? t.inQueue : `${job.progress}%`}
                        {job.workerId ? ` · ${job.workerId}` : ""}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
                    <span>{job.preset}</span>
                    {job.durationMs !== null && (
                      <span>
                        {t.length}: {fmtDuration(job.durationMs)}
                      </span>
                    )}
                    {job.bytes !== null && <span>{fmtBytes(job.bytes)}</span>}
                    <span className="ml-auto">{fmtWhen(job.finishedAt ?? job.createdAt)}</span>
                  </div>

                  {/* ⚠️ Fail hui job ki wajah yahin dikhti hai. Ise chhupa dena
                      matlab har baar server ke log tak jaana — jabki wajah row
                      me likhi padi hai. */}
                  {job.error && (
                    <p className="mt-3 rounded-2xl bg-terracotta/5 px-3 py-2 text-xs leading-relaxed text-terracotta">
                      <b>{t.why}:</b> {job.error}
                    </p>
                  )}

                  {ready && job.key && (
                    <a
                      href={mediaUrl(job.key)}
                      download={`${job.name}.mp4`}
                      className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-ink-soft transition hover:text-terracotta"
                    >
                      <Download size={14} />
                      {t.download}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
