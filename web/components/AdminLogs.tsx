"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Send,
  Smartphone,
  Globe,
  XCircle,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

type DeliveryHealth = {
  config: {
    twilio: boolean;
    smtp: boolean;
    waReminder: "exact" | "fallback" | "none";
    waDocument: "exact" | "fallback" | "none";
    cronSecret: boolean;
  };
  cron: { overdueUntouched: number; oldestOverdueAt: string | null; lastNotifiedAt: string | null };
  verdict: { level: "ok" | "warn" | "down"; title: string; detail: string };
};

type AppError = {
  id: string;
  source: string;
  level: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  platform: string | null;
  appVersion: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
};

// Range ke labels dictionary se aate hain (neeche component me), yahan sirf din.
const RANGE_DAYS = [1, 2, 7, 30] as const;

/**
 * "Aaj" / "Kal se" ka ASLI matlab — aadhi raat se, 24 ghante peeche se nahi.
 *
 * ── ⚠️ Ye shikayat ki jad thi ───────────────────────────────────────────
 *
 * Shikayat: "aaj ya kal pe click karte h to nhi chalta h".
 *
 * Button par likha tha "Aaj", par server ko sirf `days=1` jaata tha aur wo
 * `now - 24 ghante` se filter karta tha. Do bilkul alag cheezein hain:
 *
 *   • Subah 9 baje "Aaj" dabao -> KAL SHAAM 6 baje wali errors bhi aa jaati
 *     thi (wo 24 ghante ke andar hain). Button jhooth bol raha tha.
 *   • Aur raat 11 baje "Aaj" dabao -> aaj subah ki error to aati thi, par
 *     agar aaj kuch hua hi nahi to list khaali — jabki "7 din" bhari hui.
 *     User ke liye iska matlab seedha "Aaj wala button kaam nahi karta" tha.
 *
 * Ab hisaab CLIENT par hota hai, aur yahi sahi jagah hai: aadhi raat admin ke
 * apne timezone ki hoti hai (India me IST), jabki server UTC par chalta hai.
 * Server par IST hardcode karna ek naya jhooth hota — wahan se 5:30 ka farq
 * hamesha galat din deta.
 *
 * `days = 1` -> aaj ki aadhi raat se. `2` -> kal ki aadhi raat se. `7` -> aaj
 * milaake 7 din. Yaani jo likha hai, wahi hota hai.
 */
function sinceFor(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminLogs() {
  const t = useAdminT();
  const d = t.data.logs;
  const sh = t.data.shared;
  // "Aaj / Kal se / 7 din / 30 din" — pehle ye ek module-level array me hardcoded
  // the, isliye bhasha badalne par bhi angrezi/hinglish hi dikhte the.
  const rangeLabel = (n: number) =>
    n === 1 ? d.today : n === 2 ? d.sinceYesterday : `${n} ${t.time.d}`;

  const [errors, setErrors] = useState<AppError[] | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState<number>(7);
  /**
   * ⚠️ `delivery` ab ek alag source hai.
   *
   * WhatsApp/email ki chhooti hui khabar app/web ki asli crashes ke saath ghul
   * jaati to dono taraf nuksan hota: crash dhoondhna mushkil, aur delivery ki
   * dikkat crash ke shor me dabi hui. (Poori wajah `lib/delivery-log.ts` par.)
   */
  const [source, setSource] = useState<"all" | "app" | "web" | "delivery">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<DeliveryHealth | null>(null);

  const load = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      // `since` client se — aadhi raat admin ke apne timezone ki (upar wajah
      // likhi hai). `days` bhi bhejte hain taaki purane deploy par bhi kuch na
      // toote: server `since` na samjhe to wahi purana hisaab laga lega.
      const res = await fetch(
        `/api/admin/errors?days=${days}&since=${encodeURIComponent(sinceFor(days))}` +
          `&source=${source}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as { errors?: AppError[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setErrors(body.errors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setErrors([]);
    } finally {
      setBusy(false);
    }
  }, [days, source]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Delivery ki sehat — errors se ALAG call.
   *
   * ⚠️ Jaan-boojh ke alag: ye filters (`days`/`source`) se nahi badalti, aur
   * agar `app_errors` ki query fail ho jaye (table hi na bani ho) to bhi ye card
   * dikhna chahiye — aksar wahi ek jawab hota hai jiske liye admin yahan aaya
   * hai. Ise usi call me jodne par ek ka fail doosre ko bhi le doobta.
   */
  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/delivery", { cache: "no-store" });
      if (!res.ok) return;
      setHealth((await res.json()) as DeliveryHealth);
    } catch {
      /* card na dikhe to bhi baaki page chalta rahe */
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  /** Ek jaisa message = ek group (kitni baar aaya). */
  const groups = useMemo(() => {
    const map = new Map<string, { sample: AppError; count: number }>();
    for (const e of errors ?? []) {
      const key = `${e.source}|${e.message}`;
      const g = map.get(key);
      if (g) g.count++;
      else map.set(key, { sample: e, count: 1 });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.count - a.count ||
        new Date(b.sample.createdAt).getTime() - new Date(a.sample.createdAt).getTime(),
    );
  }, [errors]);

  const pager = usePagination(groups, 10, `${days}|${source}`);

  if (!errors) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      {/* ⚠️ Sabse UPAR — kyunki "WhatsApp/email kyun nahi gaya" wo sawaal hai
          jiske liye admin sabse zyada baar yahan aata hai, aur uska jawab
          error-list me kabhi tha hi nahi. */}
      {health && <DeliveryCard h={health} onRefresh={loadHealth} />}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat label={d.totalErrors} value={errors.length} />
        <Stat label={d.distinct} value={groups.length} />
        <Stat label={d.fromApp} value={errors.filter((e) => e.source === "app").length} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {RANGE_DAYS.map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                days === n ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {rangeLabel(n)}
            </button>
          ))}
        </div>
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {(["all", "app", "web", "delivery"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold capitalize transition ${
                source === s ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {t.common.refresh}
        </button>
      </div>

      {!groups.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/15 text-sage">
            <Bug size={24} />
          </span>
          <p className="text-sm font-semibold text-ink">{d.noneTitle}</p>
          <p className="text-sm text-ink-soft">{d.noneSub}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pager.pageItems.map(({ sample, count }) => {
            const open = openId === sample.id;
            return (
              <div key={sample.id} className="rounded-3xl border border-line bg-surface shadow-soft">
                <button
                  onClick={() => setOpenId(open ? null : sample.id)}
                  className="w-full p-4 text-left"
                  aria-expanded={open}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        sample.source === "web"
                          ? "bg-cream-deep text-ink-soft"
                          : "bg-terracotta/12 text-terracotta-dark"
                      }`}
                    >
                      {sample.source === "web" ? <Globe size={14} /> : <Smartphone size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-ink">{sample.message}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {sample.source} · {sample.platform ?? "—"} · v{sample.appVersion ?? "—"} ·{" "}
                        {fmt(sample.createdAt)}
                        {sample.email ? ` · ${sample.email}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cream-deep px-2.5 py-1 text-xs font-bold text-ink-soft">
                      ×{count}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`mt-1 shrink-0 text-ink-soft transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-line p-4">
                    {sample.context && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Context
                        </p>
                        <pre className="mt-1.5 overflow-x-auto rounded-xl bg-cream-deep/40 p-3 text-xs text-ink">
                          {JSON.stringify(sample.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {sample.stack && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Stack
                        </p>
                        <pre className="mt-1.5 max-h-72 overflow-auto rounded-xl bg-cream-deep/40 p-3 text-[11px] leading-relaxed text-ink-soft">
                          {sample.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            from={pager.from}
            to={pager.to}
            onPage={pager.setPage}
            label="errors"
          />
        </div>
      )}

      <p className="text-xs text-ink-soft">
        Ek jaisi error ek hi row me hai (×N = kitni baar aayi). Naye errors ka email har
        30 min me <b>saathi8683@gmail.com</b> pe jaata hai.
      </p>
    </div>
  );
}

/**
 * "WhatsApp/email chal raha hai ya nahi" — ek nazar me.
 *
 * ⚠️ Ye card isliye bana ki asli sawaal ("env to set hai, phir kyun nahi chal
 * raha?") ka jawab kahin dikhta hi nahi tha. Vercel ka env poori zanjeer ka
 * sirf AAKHRI kadam hai; usse pehle Supabase ka cron job aur uska CRON_SECRET
 * aate hain, aur wahi sabse zyada toote milte hain. Poori soch
 * `lib/delivery-health.ts` par likhi hai.
 *
 * Sabse upar ek line ka nateeja — kyunki har cheez ka haal alag-alag dikhana
 * wahi kaam admin par daal dena hai jo ye card kar sakta hai.
 */
function DeliveryCard({ h, onRefresh }: { h: DeliveryHealth; onRefresh: () => void }) {
  const tone =
    h.verdict.level === "ok"
      ? { box: "border-sage/35 bg-sage/10", icon: "text-sage", Icon: CheckCircle2 }
      : h.verdict.level === "warn"
        ? { box: "border-amber/45 bg-amber/10", icon: "text-ink", Icon: AlertTriangle }
        : { box: "border-terracotta/35 bg-terracotta/10", icon: "text-terracotta-dark", Icon: XCircle };

  return (
    <div className={`rounded-3xl border p-4 shadow-soft ${tone.box}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
          <tone.Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Send size={13} className="shrink-0 text-ink-soft" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              WhatsApp &amp; email
            </p>
          </div>
          <p className="mt-1 font-semibold leading-snug text-ink">{h.verdict.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{h.verdict.detail}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip ok={h.config.cronSecret} label="CRON_SECRET" />
            <Chip ok={h.config.smtp} label="SMTP" />
            <Chip ok={h.config.twilio} label="Twilio" />
            {/* `fallback` = us bhasha ka template nahi hai, Hinglish wala
                jaayega. Pahunchta hai — par galat bhasha me, aur wo chup-chaap
                nikal jaata hai. Isliye wo bhi ek haal hai, chhupana nahi. */}
            <Chip
              ok={h.config.waReminder !== "none"}
              warn={h.config.waReminder === "fallback"}
              label="WA template · reminder"
            />
            <Chip
              ok={h.config.waDocument !== "none"}
              warn={h.config.waDocument === "fallback"}
              label="WA template · document"
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Cron ne aakhri baar kaam kiya:{" "}
            <b className="text-ink">
              {h.cron.lastNotifiedAt ? fmt(h.cron.lastNotifiedAt) : "kabhi nahi"}
            </b>
            {h.cron.overdueUntouched > 0 && (
              <>
                {" · "}atke hue reminder:{" "}
                <b className="text-terracotta-dark">{h.cron.overdueUntouched}</b>
              </>
            )}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 rounded-xl border border-line bg-surface p-2 text-ink-soft transition hover:text-terracotta"
          aria-label="refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

function Chip({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const cls = !ok
    ? "border-terracotta/40 bg-terracotta/10 text-terracotta-dark"
    : warn
      ? "border-amber/50 bg-amber/15 text-ink"
      : "border-sage/40 bg-sage/12 text-sage";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {ok ? (warn ? "△" : "✓") : "✕"} {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 text-center shadow-soft sm:p-4">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}
