"use client";

import { useEffect, useState } from "react";
import { Gift, Save, UserPlus, SlidersHorizontal, MessageSquare } from "lucide-react";
import Loader from "@/components/Loader";
import { useAdminT, atpl } from "@/lib/i18n/admin";

// Plus ka daam ab Pricing section me (country-wise). Yahan referral + free
// limits + SMS OTP ki haddein.
type Config = {
  referrals_enabled: boolean;
  referral_days: number;
  free_reminders: number;
  free_documents: number;

  /**
   * SMS OTP ki haddein — `supabase/phone-otp.sql` inhe `app_config` se padhta
   * hai, isliye yahan badalte hi live lag jaati hain.
   *
   * ⚠️ Ye number seedha paise se jude hain: har OTP ek SMS hai. Badhane se
   * pehle Admin > Spend dekh lena. Aur inhe bahut chhota rakhne par asli users
   * phans jaate hain (naya phone, purana number, do-teen galat try) — us soorat
   * ke liye har user ka apna reset Support ticket ke saath maujood hai.
   */
  otp_cooldown_seconds: number;
  otp_ttl_seconds: number;
  otp_per_hour: number;
  otp_per_day: number;
  otp_ip_per_day: number;
  otp_max_attempts: number;
};

type Stats = {
  totalUsers: number;
  referralsTotal: number;
  referralsRewarded: number;
};

const DEFAULTS: Config = {
  referrals_enabled: true,
  referral_days: 15,
  free_reminders: 5,
  free_documents: 3,
  // Yahi default SQL me bhi hain (`otp_limits()`) — dono jagah ek jaise rakhna.
  otp_cooldown_seconds: 30,
  otp_ttl_seconds: 600,
  otp_per_hour: 5,
  otp_per_day: 15,
  otp_ip_per_day: 40,
  otp_max_attempts: 5,
};

const label = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";
const input =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";

export default function AdminRewards() {
  const t = useAdminT();
  const d = t.data.rewards;
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" });
        const d = await res.json();
        // 503/500 pe bhi asli wajah dikhao — pehle chup-chaap defaults dikhte the.
        if (!res.ok) throw new Error(d?.error || `load failed (${res.status})`);
        if (d?.config) setCfg({ ...DEFAULTS, ...d.config });
        if (d?.stats) setStats(d.stats);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : t.data.shared.loadFailed);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "save failed");
      setCfg({ ...DEFAULTS, ...d.config });
      setMsg(d.saved);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : d.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function grant() {
    setGranting(true);
    setGrantMsg("");
    try {
      const res = await fetch("/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: grantEmail.trim(), days: grantDays }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "grant failed");
      setGrantMsg(atpl(d.granted, { days: grantDays }));
      setGrantEmail("");
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : d.grantFailed);
    } finally {
      setGranting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-6 text-ink-soft">
        <Loader size={20} /> {t.common.loading}
      </div>
    );
  }

  const isError = Boolean(msg) && !msg.includes("✓");

  return (
    <div className="space-y-5">
      {isError && (
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4 text-sm text-ink">
          <strong className="font-semibold text-terracotta-dark">{d.failedPrefix}</strong> {msg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            [d.totalUsers, stats.totalUsers],
            [d.referrals, stats.referralsTotal],
            [d.rewarded, stats.referralsRewarded],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-2xl font-bold text-ink">{v as number}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{k as string}</p>
            </div>
          ))}
        </div>
      )}

      {/* Plans & Limits — Free limits aur Plus price */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-terracotta" />
          <h3 className="font-display text-lg font-semibold">{d.limitsTitle}</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">{d.limitsSub}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{d.freeReminders}</label>
            <input
              type="number"
              className={input}
              value={cfg.free_reminders}
              onChange={(e) => setCfg({ ...cfg, free_reminders: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={label}>{d.freeDocuments}</label>
            <input
              type="number"
              className={input}
              value={cfg.free_documents}
              onChange={(e) => setCfg({ ...cfg, free_documents: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {saving ? <Loader size={18} /> : <Save size={15} />}
            {saving ? t.common.saving : t.common.save}
          </button>
          {msg && <span className="text-sm text-ink-soft">{msg}</span>}
        </div>
      </div>

      {/* SMS OTP ki haddein.
          Har OTP ek SMS hai, yaani seedha paisa — isliye ye admin ke haath me
          hain, code me nahi. Pehle ye SQL me hardcoded the aur badalne ke liye
          har baar migration chalani padti thi. */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <MessageSquare size={17} className="text-terracotta" />
          <h3 className="font-display text-lg font-semibold">{d.otpTitle}</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">{d.otpSub}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["otp_cooldown_seconds", d.otpCooldown],
              ["otp_ttl_seconds", d.otpTtl],
              ["otp_per_hour", d.otpPerHour],
              ["otp_per_day", d.otpPerDay],
              ["otp_ip_per_day", d.otpIpPerDay],
              ["otp_max_attempts", d.otpMaxAttempts],
            ] as const
          ).map(([key, text]) => (
            <div key={key}>
              <label className={label}>{text}</label>
              <input
                type="number"
                min={1}
                className={input}
                value={cfg[key]}
                onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {saving ? <Loader size={18} /> : <Save size={15} />}
            {saving ? t.common.saving : t.common.save}
          </button>
          {msg && <span className="text-sm text-ink-soft">{msg}</span>}
        </div>
      </div>

      {/* Config */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Gift size={17} className="text-terracotta" />
          <h3 className="font-display text-lg font-semibold">{d.referralsTitle}</h3>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>{d.referralDays}</label>
            <input
              type="number"
              className={input}
              value={cfg.referral_days}
              onChange={(e) => setCfg({ ...cfg, referral_days: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={cfg.referrals_enabled}
                onChange={(e) => setCfg({ ...cfg, referrals_enabled: e.target.checked })}
              />
              {d.referralsOn}
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {saving ? <Loader size={18} /> : <Save size={15} />}
            {saving ? t.common.saving : t.common.save}
          </button>
          {msg && <span className="text-sm text-ink-soft">{msg}</span>}
        </div>
      </div>

      {/* Manual grant */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <UserPlus size={17} className="text-sage" />
          <h3 className="font-display text-lg font-semibold">{d.grantTitle}</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">{d.grantSub}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="email"
            placeholder="user@email.com"
            className={input}
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
          />
          <input
            type="number"
            placeholder={d.grantDaysPh}
            className={input}
            value={grantDays}
            onChange={(e) => setGrantDays(Number(e.target.value))}
          />
          <button
            onClick={grant}
            disabled={granting || !grantEmail.trim()}
            className="mt-1.5 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:opacity-90 disabled:opacity-50"
          >
            {granting ? "…" : d.grantBtn}
          </button>
        </div>
        {grantMsg && <p className="mt-3 text-sm text-ink-soft">{grantMsg}</p>}
      </div>
    </div>
  );
}
