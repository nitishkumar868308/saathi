"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Save, UserPlus, SlidersHorizontal } from "lucide-react";

// Plus ka daam ab Pricing section me (country-wise). Yahan sirf referral + free limits.
type Config = {
  referrals_enabled: boolean;
  referral_days: number;
  free_reminders: number;
  free_documents: number;
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
};

const label = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";
const input =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";

export default function AdminRewards() {
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
        setMsg(e instanceof Error ? e.message : "Config load nahi hua");
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
      setMsg("Save ho gaya ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save nahi hua");
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
      setGrantMsg(`${grantDays} din de diye ✓`);
      setGrantEmail("");
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : "Grant nahi hua");
    } finally {
      setGranting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-6 text-ink-soft">
        <Loader2 size={16} className="animate-spin" /> Load ho raha hai…
      </div>
    );
  }

  const isError = Boolean(msg) && !msg.includes("✓");

  return (
    <div className="space-y-5">
      {isError && (
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4 text-sm text-ink">
          <strong className="font-semibold text-terracotta-dark">Nahi ho paya:</strong> {msg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Total users", stats.totalUsers],
            ["Referrals", stats.referralsTotal],
            ["Rewarded", stats.referralsRewarded],
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
          <h3 className="font-display text-lg font-semibold">Free plan limits</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">
          Free plan ki limit yahin se badlo. Plus ka daam ab{" "}
          <strong>Pricing</strong> section me (country-wise) hai.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Free reminders</label>
            <input
              type="number"
              className={input}
              value={cfg.free_reminders}
              onChange={(e) => setCfg({ ...cfg, free_reminders: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={label}>Free documents</label>
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
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save
          </button>
          {msg && <span className="text-sm text-ink-soft">{msg}</span>}
        </div>
      </div>

      {/* Config */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Gift size={17} className="text-terracotta" />
          <h3 className="font-display text-lg font-semibold">Referrals</h3>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Referral din (dono ko)</label>
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
              Referrals chalu
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save
          </button>
          {msg && <span className="text-sm text-ink-soft">{msg}</span>}
        </div>
      </div>

      {/* Manual grant */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <UserPlus size={17} className="text-sage" />
          <h3 className="font-display text-lg font-semibold">Manually Plus din do</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-soft">
          Din user ke maujooda plan me <strong>add</strong> honge (paid plan bhi extend hoga).
        </p>

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
            placeholder="Din"
            className={input}
            value={grantDays}
            onChange={(e) => setGrantDays(Number(e.target.value))}
          />
          <button
            onClick={grant}
            disabled={granting || !grantEmail.trim()}
            className="mt-1.5 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition hover:opacity-90 disabled:opacity-50"
          >
            {granting ? "…" : "Do"}
          </button>
        </div>
        {grantMsg && <p className="mt-3 text-sm text-ink-soft">{grantMsg}</p>}
      </div>
    </div>
  );
}
