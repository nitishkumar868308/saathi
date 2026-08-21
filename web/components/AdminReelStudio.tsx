"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Film,
  HardDrive,
  Mic,
  RefreshCw,
  Server,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import AdminReelVideos from "@/components/AdminReelVideos";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * "Reel Studio" — AI se reel banane ka apna hisaab (21.11).
 *
 * `Spend` tab se alag sawaal hai. Wo poore product ka bill hai (Gemini chat,
 * WhatsApp, email); ye sirf reel ka: AI ne kitne token khaaye, voice ne kitne
 * akshar bole, kitne render bane aur kitni jagah ghere baithe hain.
 *
 * ⚠️ Kharche ki jagah "rate set nahi" likhna jaan-boojh ke hai. Rate provider
 * tay karta hai aur model ke saath badalti hai — koi default number chhaap dena
 * sabse aasan hota, par usi number ke bharose plan banta hai. Jis din asli bill
 * teen guna aata hai, us din wo number sirf galat nahi, dhokha nikalta hai.
 * Token ki ginti hamesha dikhti hai kyunki wo sach me naapi gayi hai.
 *
 * ⚠️ Cache se aayi calls alag se dikhti hain. TTS me wahi seedha bacha hua paisa
 * hai — aur agar wo ginti kabhi 0 par chipak jaye to samajh lo cache key toot
 * gayi, jo warna mahino tak kisi ko dikhta hi nahi.
 */

type UsageRow = {
  kind: string;
  calls: number;
  units: number;
  failures: number;
  cached: number;
  cost: number | null;
  costUnknownCalls: number;
  avgMs: number | null;
  last_at: string | null;
};

type Data = {
  usage: UsageRow[];
  renders: { status: string; count: number; bytes: number }[];
  assets: { lifecycle: string; count: number; bytes: number }[];
  workers: { id: string; last_seen: string; current_job: string | null; version: string | null }[];
  daily: { day: string; kind: string; units: number; calls: number }[];
  ratesConfigured: boolean;
};

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const EMPTY: Data = {
  usage: [],
  renders: [],
  assets: [],
  workers: [],
  daily: [],
  ratesConfigured: false,
};

/** Worker itni der se chup ho to use "zinda" nahi maana jaata (heartbeat 30s ka hai). */
const WORKER_STALE_MS = 2 * 60 * 1000;

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
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

function Overview() {
  const at = useAdminT();
  const t = at.data.reelStudio;
  const [data, setData] = useState<Data>(EMPTY);
  const [range, setRange] = useState<Range>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reel-studio?days=${range}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "read failed");
      setData({ ...EMPTY, ...(json as Data) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "read failed");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const scenes = useMemo(() => data.usage.find((r) => r.kind === "scenes"), [data.usage]);
  const tts = useMemo(() => data.usage.find((r) => r.kind === "tts"), [data.usage]);

  const done = useMemo(
    () => data.renders.find((r) => r.status === "completed"),
    [data.renders],
  );
  const renderFailed = useMemo(
    () => data.renders.filter((r) => r.status === "failed").reduce((a, r) => a + r.count, 0),
    [data.renders],
  );

  const storage = useMemo(() => {
    const perm = data.assets.find((a) => a.lifecycle === "permanent");
    const temp = data.assets.find((a) => a.lifecycle === "temporary");
    return { perm, temp, total: data.assets.reduce((a, x) => a + x.bytes, 0) };
  }, [data.assets]);

  /** Roz ka jod — sab kind milakar. Chart ek hi lakeer rakhta hai, warna do bar
   *  ki oonchai alag paimane par hoti aur wo dhokha deti. */
  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data.daily) map.set(d.day, (map.get(d.day) ?? 0) + d.units);
    const rows = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const peak = rows.reduce((m, r) => Math.max(m, r[1]), 0);
    return { rows, peak };
  }, [data.daily]);

  /** Kuch bhi ho to hi rate wali salah dikhti hai — khaali screen par wo bekaar shor hai. */
  const hasAny = data.usage.length > 0 || data.renders.length > 0;

  /*
   * ⚠️ "Zinda" ka faisla `last_seen` se hota hai, row ke hone se nahi. Worker
   * crash ho jaye to uski row wahin padi rehti hai — usse "chal raha hai" samajh
   * lena hi wo galti hai jisme render queue chup-chaap rukti rehti hai aur kisi
   * ko hafton pata nahi chalta.
   */
  const alive = useMemo(
    () => data.workers.filter((w) => Date.now() - new Date(w.last_seen).getTime() < WORKER_STALE_MS),
    [data.workers],
  );

  return (
    <div className="mt-6">
      {/* Range + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition ${
                range === key
                  ? "bg-terracotta text-white shadow-warm"
                  : "border border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {key === 7 ? t.days7 : key === 30 ? t.days30 : t.days90}
            </button>
          ))}
        </div>
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

      {/* Teen bade card — AI, awaaz, render */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* AI */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
              <Bot size={18} />
            </span>
            <span className="text-sm font-semibold text-ink">{t.aiLabel}</span>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
            {loading ? "—" : fmtNum(scenes?.units ?? 0)}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.tokens}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
            <span>
              <b className="text-ink">{fmtNum(scenes?.calls ?? 0)}</b> {t.calls}
            </span>
            {!!scenes?.failures && (
              <span className="font-semibold text-terracotta">
                {scenes.failures} {t.failed}
              </span>
            )}
            <span className="ml-auto">{fmtMs(scenes?.avgMs ?? null)}</span>
          </div>
          {/* ⚠️ Kharcha na hone par "₹0" NAHI — "rate set nahi". Dekho file ka top. */}
          <div className="mt-2 text-xs">
            <span className="text-ink-soft">{t.cost}: </span>
            {scenes?.cost === null || scenes?.cost === undefined ? (
              <span className="font-semibold text-ink-soft">{t.costUnknown}</span>
            ) : (
              <span className="font-semibold text-ink tabular-nums">
                {scenes.cost.toFixed(4)}
                {scenes.costUnknownCalls > 0 && (
                  <span className="ml-2 font-normal text-ink-soft">
                    ({atpl(t.costPartial, { n: String(scenes.costUnknownCalls) })})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Awaaz */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/15 text-sage">
              <Mic size={18} />
            </span>
            <span className="text-sm font-semibold text-ink">{t.voiceLabel}</span>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
            {loading ? "—" : fmtNum(tts?.units ?? 0)}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.letters}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
            <span>
              <b className="text-ink">{fmtNum(tts?.calls ?? 0)}</b> {t.calls}
            </span>
            {/* Cache ki ginti — bacha hua paisa, aur cache tootne ka pehla ishaara. */}
            {!!tts?.cached && (
              <span className="font-semibold text-sage">
                {tts.cached} {t.cached}
              </span>
            )}
            {!!tts?.failures && (
              <span className="font-semibold text-terracotta">
                {tts.failures} {t.failed}
              </span>
            )}
            <span className="ml-auto">{fmtMs(tts?.avgMs ?? null)}</span>
          </div>
          <div className="mt-2 text-xs text-ink-soft">{fmtWhen(tts?.last_at ?? null)}</div>
        </div>

        {/* Render */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-warm/15 text-amber-warm">
              <Film size={18} />
            </span>
            <span className="text-sm font-semibold text-ink">{t.renderLabel}</span>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
            {loading ? "—" : fmtNum(done?.count ?? 0)}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.videos}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
            <span>
              <b className="text-ink">{fmtBytes(done?.bytes ?? 0)}</b>
            </span>
            {renderFailed > 0 && (
              <span className="font-semibold text-terracotta">
                {renderFailed} {t.failed}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rate set nahi hai — kahan set karni hai wo yahin bata dete hain, warna
          "rate set nahi" padhkar agla sawaal hamesha yahi hota hai. */}
      {!loading && !data.ratesConfigured && hasAny && (
        <p className="mt-4 rounded-2xl border border-line bg-surface px-5 py-3 text-xs leading-relaxed text-ink-soft">
          {atpl(t.costHint, { file: "web/.env.local" })}
        </p>
      )}

      {/* Worker — render queue ka dil */}
      <h2 className="mt-9 font-display text-lg font-semibold">{t.workers}</h2>
      <div className="mt-3 rounded-3xl border border-line bg-surface p-5">
        {loading ? (
          <SkeletonRows rows={2} />
        ) : data.workers.length === 0 ? (
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-warm" />
            <p className="text-sm leading-relaxed text-ink-soft">
              {t.noWorker}{" "}
              <span className="text-ink">
                {atpl(t.noWorkerHint, { file: "npm run dev:worker" })}
              </span>
            </p>
          </div>
        ) : alive.length === 0 ? (
          /*
           * Rows hain par sab purani — matlab worker kabhi chala tha, abhi nahi.
           * ⚠️ Inhe laal card banakar ginn dena galat padha jaata: worker ka id
           * har process ke saath naya banta hai, isliye purani rows "toote hue
           * worker" nahi, bas itihaas hain. Kaam ki baat ek hi hai — abhi koi
           * nahi chal raha, aur render queue me pade rahenge.
           */
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-warm" />
            <p className="text-sm leading-relaxed text-ink-soft">
              {atpl(t.workerStale, { when: fmtWhen(data.workers[0].last_seen) })}{" "}
              <span className="text-ink">
                {atpl(t.noWorkerHint, { file: "npm run dev:worker" })}
              </span>
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {alive.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sage/15 text-sage">
                  <Server size={16} />
                </span>
                <span className="font-semibold text-ink">{w.id}</span>
                {w.version && <span className="text-xs text-ink-soft">{w.version}</span>}
                <span className="text-xs font-semibold text-sage">
                  {w.current_job ? t.workerBusy : t.workerIdle}
                </span>
                <span className="ml-auto text-xs text-ink-soft">{fmtWhen(w.last_seen)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Roz ka istemaal */}
      {/*
        ⚠️ AI/voice ki ginti aur render ki ginti alag table me hain, jaan-boojh
        ke. Pehle dono ek hi table me thin aur wahan "scenes | 2 | 166 Units"
        wali row ek render status ki tarah padhi jaati thi — heading "Render
        jobs" jo thi. Ek table me do alag paimane rakhne par har row ka matlab
        padhne wale ko khud jodna padta hai.
      */}
      <h2 className="mt-9 font-display text-lg font-semibold">{t.breakdown}</h2>
      <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : data.usage.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">{t.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-3">{t.what}</th>
                  <th className="px-5 py-3 text-right">{t.calls}</th>
                  <th className="px-5 py-3 text-right">{t.units}</th>
                  <th className="px-5 py-3 text-right">{t.cached}</th>
                  <th className="px-5 py-3 text-right">{t.failed}</th>
                  <th className="px-5 py-3 text-right">{t.last}</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((r) => (
                  <tr key={r.kind} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-ink">{r.kind}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.calls)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.units)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-sage">
                      {r.cached || "—"}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${
                        r.failures > 0 ? "font-semibold text-terracotta" : "text-ink-soft"
                      }`}
                    >
                      {r.failures || "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-soft">
                      {fmtWhen(r.last_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {chart.rows.length > 1 && (
        <>
          <div className="mt-3 rounded-3xl border border-line bg-surface p-5">
            <div className="flex h-24 items-end gap-1">
              {chart.rows.map(([day, units]) => (
                <div
                  key={day}
                  title={`${day} — ${fmtNum(units)} ${t.units}`}
                  className="flex-1 rounded-t bg-terracotta/70"
                  // peak 0 ho hi nahi sakta yahan (rows.length > 1 aur units jama
                  // hue hain), par 1 ka floor rakha hai — divide-by-zero se bachne
                  // ke liye, jo warna poori row gayab kar deta.
                  style={{ height: `${Math.max(2, (units / Math.max(1, chart.peak)) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-ink-soft">
              <span>{chart.rows[0][0]}</span>
              <span>{chart.rows[chart.rows.length - 1][0]}</span>
            </div>
          </div>
        </>
      )}

      {/* Tod-ke + storage */}
      <div className="mt-9 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-lg font-semibold">{t.renders}</h2>
          <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
            {loading ? (
              <div className="p-5">
                <SkeletonRows rows={4} />
              </div>
            ) : data.renders.length === 0 ? (
              <p className="p-6 text-sm text-ink-soft">{t.videosNone}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="px-5 py-3">{t.status}</th>
                      <th className="px-5 py-3 text-right">{t.count}</th>
                      <th className="px-5 py-3 text-right">{t.size}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.renders.map((r) => (
                      <tr key={r.status} className="border-b border-line/60 last:border-0">
                        <td
                          className={`px-5 py-3 font-semibold ${
                            r.status === "failed" ? "text-terracotta" : "text-ink"
                          }`}
                        >
                          {r.status}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{r.count}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                          {r.bytes ? fmtBytes(r.bytes) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold">{t.storage}</h2>
          <div className="mt-3 rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink/5 text-ink-soft">
                <HardDrive size={18} />
              </span>
              <span className="font-display text-2xl font-semibold tracking-tight">
                {loading ? "—" : fmtBytes(storage.total)}
              </span>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs text-ink-soft">
              <div className="flex items-center justify-between">
                <span>{t.permanent}</span>
                <span className="tabular-nums text-ink">
                  {storage.perm?.count ?? 0} {t.files} · {fmtBytes(storage.perm?.bytes ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.temporary}</span>
                <span className="tabular-nums text-ink">
                  {storage.temp?.count ?? 0} {t.files} · {fmtBytes(storage.temp?.bytes ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Do sub-tab — "Haal" aur "Video".
 *
 * ⚠️ Video ki list apne menu me nahi, isi menu ke andar hai. Permission ek hi
 * hai (`reelStudio`), aur sidebar me do entry rakhne par wo ek permission do
 * jagah dikhti — jo dekhne wale ko lagta hai ki dono alag se di ja sakti hain.
 *
 * ⚠️ Tab badalne par `Overview` unmount hota hai aur wapas aane par dobara
 * fetch karta hai. Ye jaan-boojh ke hai: hisaab wali screen par baasi number
 * dikhana usse bura hai ki ek chhota loader dobara dikh jaye.
 */
export default function AdminReelStudio() {
  const at = useAdminT();
  const t = at.data.reelStudio;
  const [tab, setTab] = useState<"overview" | "videos">("overview");

  const tabs: { key: "overview" | "videos"; label: string }[] = [
    { key: "overview", label: t.tabOverview },
    { key: "videos", label: t.tabVideos },
  ];

  return (
    <div>
      <div className="mt-6 flex gap-1 border-b border-line">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`-mb-px min-h-[44px] border-b-2 px-4 py-2.5 text-sm font-semibold transition [@media(pointer:coarse)]:px-5 ${
              tab === entry.key
                ? "border-terracotta text-terracotta"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <Overview /> : <AdminReelVideos />}
    </div>
  );
}
