"use client";

import { useMemo, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";

/**
 * Rozana ka chart — App aur Web ek doosre ke upar (stacked columns).
 *
 * ⚠️ Pehle yahan sirf terracotta ki patli lakeerein thi: na koi paimana (y-axis),
 * na ye pata chalta tha ki kitna hissa app ka hai aur kitna web ka, aur ginti
 * sirf browser ke `title` tooltip me chhupi thi. "Aaj kitne log aaye" jaise
 * seedhe sawaal ka jawab dekh ke nahi milta tha — sirf oonchai ka andaza hota tha.
 *
 * Ab: paimana, gridlines, dono source ka alag rang, har din par hover karke poora
 * hisaab, aur ek "table" button un logon ke liye jinhe ginti padhni hai (aur
 * screen reader ke liye bhi).
 *
 * ── Rang kyun yahi ──────────────────────────────────────────────────────────
 * App = terracotta (#C25A37, brand ka apna rang), Web = neela (#2A6FC4).
 *
 * Pehla soch sage (#7C8A6B) ka tha — brand me wahi doosra rang hai — par wo
 * jaanch me fail hota hai: uska chroma itna kam hai ki chart me wo bhoora-sletee
 * dikhta hai, aur terracotta ke saath colour-blind (deutan) aankh ke liye dono ka
 * fark sirf ΔE 6.4 rehta hai — yaani laal-hara na dekh paane wale ke liye dono
 * bar ek jaise. Neele ke saath wahi fark 21.6 hai. Teal bhi try kiya tha; sRGB me
 * is lightness par teal itna saturated ho hi nahi sakta ki gray na lage.
 */

export type DayRow = {
  day: string;
  events: number;
  sessions: number;
  users: number;
  web: number;
  app: number;
};

/** App ka hissa — brand ka apna rang. */
const APP_COLOR = "#C25A37";
/** Web ka hissa — colour-blind aankh ke liye bhi saaf alag. */
const WEB_COLOR = "#2A6FC4";
/**
 * Bar ke peeche ki surface — 2px ka gap isi rang ka hota hai.
 *
 * ⚠️ Ye pehle hardcoded "#FFFCF6" tha. Dark theme me wo safed lakeer har bar ke
 * beech chamakti thi, jabki baaki poora card gehra hota hai. CSS variable se ye
 * apne aap dono theme me card ke rang jaisa rehta hai.
 */
const SURFACE = "rgb(var(--c-surface))";

export type DayChartLabels = {
  app: string;
  web: string;
  total: string;
  sessions: string;
  users: string;
  tableView: string;
  chartView: string;
  day: string;
  empty: string;
};

function fmtDay(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Y-axis ke liye seedha-saada sabse ooncha aankda.
 *
 * 1/2/5 ke gunak par hi rukte hain — "0, 250, 500, 750, 1000" padhne me aata hai,
 * "0, 237, 474…" nahi. Bina iske har din chart ka paimana ajeeb dikhta.
 */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function DayChart({
  rows,
  labels,
}: {
  rows: DayRow[];
  labels: DayChartLabels;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = useMemo(
    () => niceMax(Math.max(1, ...rows.map((r) => Number(r.events)))),
    [rows],
  );

  // 5 lakeerein: 0 se max tak. Isse zyada par chart shor lagne lagta hai.
  const ticks = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)),
    [max],
  );

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-ink-soft">{labels.empty}</p>;
  }

  const Toggle = (
    <button
      type="button"
      onClick={() => setAsTable((v) => !v)}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-terracotta/40 hover:text-ink"
    >
      {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
      {asTable ? labels.chartView : labels.tableView}
    </button>
  );

  /* --------------------------------- table --------------------------------- */

  if (asTable) {
    return (
      <div className="mt-4">
        <div className="flex justify-end">{Toggle}</div>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-3 pb-2 font-bold">{labels.day}</th>
                <th className="px-3 pb-2 text-right font-bold">{labels.app}</th>
                <th className="px-3 pb-2 text-right font-bold">{labels.web}</th>
                <th className="px-3 pb-2 text-right font-bold">{labels.total}</th>
                <th className="px-3 pb-2 text-right font-bold">{labels.sessions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className="border-t border-line/60">
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{fmtDay(r.day)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r.app}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r.web}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                    {r.events}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {r.sessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* --------------------------------- chart --------------------------------- */

  const active = hover !== null ? rows[hover] : null;

  return (
    <div className="mt-3">
      {/* Legend hamesha — do series me rang akela pehchaan nahi ban sakta. */}
      <div className="flex flex-wrap items-center gap-4">
        <Key color={APP_COLOR} label={labels.app} />
        <Key color={WEB_COLOR} label={labels.web} />
        <div className="ml-auto">{Toggle}</div>
      </div>

      <div className="relative mt-4 pl-9">
        {/* Gridlines + y ticks. Hairline, solid, recessive — ye data nahi hai. */}
        <div className="pointer-events-none absolute inset-0 left-9">
          {ticks
            .slice()
            .reverse()
            .map((v, i) => (
              <div
                key={v + "-" + i}
                className="absolute left-0 right-0 border-t border-line/70"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              >
                <span className="absolute -left-9 -top-2 w-8 text-right text-[10px] tabular-nums text-ink-soft">
                  {v.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
        </div>

        {/* Columns. `gap-[2px]` hi wo surface-gap hai jo padosi bars ko alag
            karta hai — koi border nahi, warna wo bhi ink ban jaata hai. */}
        <div className="relative flex h-44 items-end gap-[2px]">
          {rows.map((r, i) => {
            const appN = Number(r.app);
            const webN = Number(r.web);
            const total = Math.max(0, Number(r.events));
            const appPct = (appN / max) * 100;
            const webPct = (webN / max) * 100;
            const on = hover === i;
            return (
              <div
                key={r.day}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                // Poora slot hit-target hai, sirf bar nahi — 3px chaudi bar par
                // hover karna 90 din wale chart me lagbhag namumkin hota.
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
              >
                <div
                  className="mx-auto flex w-full max-w-[24px] flex-col justify-end"
                  style={{ height: "100%" }}
                >
                  {webN > 0 && (
                    <div
                      className="w-full rounded-t-[4px] transition-opacity"
                      style={{
                        height: `${webPct}%`,
                        minHeight: 2,
                        background: WEB_COLOR,
                        opacity: hover === null || on ? 1 : 0.45,
                        // Stack ke do hisson ke beech bhi wahi 2px surface gap.
                        marginBottom: appN > 0 ? 2 : 0,
                      }}
                    />
                  )}
                  {appN > 0 && (
                    <div
                      className={`w-full transition-opacity ${webN > 0 ? "" : "rounded-t-[4px]"}`}
                      style={{
                        height: `${appPct}%`,
                        minHeight: 2,
                        background: APP_COLOR,
                        opacity: hover === null || on ? 1 : 0.45,
                      }}
                    />
                  )}
                  {total === 0 && (
                    // Khaali din bhi ek halki lakeer chhodta hai — warna chart me
                    // "us din data nahi tha" aur "us din kuch hua hi nahi" ek
                    // jaise dikhte hain.
                    <div className="h-[2px] w-full rounded-full bg-line" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Tooltip — hovered column ke upar. */}
          {active && hover !== null && (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 shadow-soft"
              style={{
                // Column ke beech par. Kinare wale din ke liye 6%–94% par rok
                // dete hain, warna tooltip card se bahar nikal jaata hai.
                left: `${Math.min(94, Math.max(6, ((hover + 0.5) / rows.length) * 100))}%`,
              }}
            >
              <p className="text-xs font-bold text-ink">{fmtDay(active.day)}</p>
              <dl className="mt-1.5 space-y-1">
                <Row color={APP_COLOR} label={labels.app} value={Number(active.app)} />
                <Row color={WEB_COLOR} label={labels.web} value={Number(active.web)} />
                <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
                  <dt className="text-[11px] font-semibold text-ink-soft">{labels.total}</dt>
                  <dd className="text-[11px] font-bold tabular-nums text-ink">
                    {Number(active.events).toLocaleString("en-IN")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[11px] text-ink-soft">{labels.sessions}</dt>
                  <dd className="text-[11px] tabular-nums text-ink-soft">
                    {Number(active.sessions).toLocaleString("en-IN")}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* X labels — har din ka naam likhne par 30/90 din me sab gud-mud ho
            jaata hai, isliye beech ke kuch hi chhodte hain. */}
        <div className="mt-2 flex gap-[2px]">
          {rows.map((r, i) => {
            const every = Math.ceil(rows.length / 8);
            const show = i % every === 0 || i === rows.length - 1;
            return (
              <span
                key={r.day}
                className="flex-1 truncate text-center text-[10px] leading-none text-ink-soft"
              >
                {show ? fmtDay(r.day) : ""}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- bits -------------------------------- */

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {/* Text kabhi series ka rang nahi pehenta — pehchaan bagal wale nishaan se. */}
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
        <span
          className="h-2 w-2 rounded-[2px] ring-2"
          style={{ background: color, boxShadow: `0 0 0 2px ${SURFACE}` }}
        />
        {label}
      </dt>
      <dd className="text-[11px] font-semibold tabular-nums text-ink">
        {value.toLocaleString("en-IN")}
      </dd>
    </div>
  );
}
