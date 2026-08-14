import { adminGet } from "@/lib/support-server";
import { emailConfigured } from "@/lib/email";
import { twilioConfigured, waTemplateState, type WaTemplateState } from "@/lib/twilio";

/**
 * "WhatsApp/email chal raha hai ya nahi — aur nahi, to KAHAN atka hai?"
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Sawaal seedha tha: "env saare set kiye hue hain Vercel pe, phir bhi kyun
 * nahi chal raha?"
 *
 * Aur wo sawaal isliye nahi bana tha ki jawab mushkil hai — balki isliye ki
 * jawab KAHIN DIKHTA HI NAHI tha. Env sirf ek kadam hai; delivery ki poori
 * zanjeer paanch kadam ki hai, aur inme se koi bhi toota ho to nateeja bilkul
 * ek jaisa dikhta hai — "kuch nahi aaya":
 *
 *   1. **pg_cron ka job** — Supabase har minute web ko call karta hai?
 *   2. **CRON_SECRET** — call 401 to nahi ho rahi?
 *   3. **Plan** — user Plus par hai?
 *   4. **Raasta** — email hai / number verify hua?
 *   5. **Env + template** — Twilio/SMTP set hain, aur WhatsApp ka Meta-approved
 *      template maujood hai?
 *
 * Vercel ka env sirf (5) hai. (1) aur (2) Supabase me hain — aur wahi sabse
 * zyada toote milte hain, kyunki `supabase/cron-reminders.sql` me
 * `<CRON_SECRET>` ek PLACEHOLDER hai jise haath se badalna padta hai. Bina
 * badle chalane par har call 401 hoti hai aur ek bhi message kabhi nahi jaata —
 * bina kisi error ke, kyunki us 401 ko dekhne wala koi hai hi nahi.
 *
 * ── Cron chal raha hai ya nahi — ye PAKKA kaise pata chalta hai ─────────
 *
 * ⚠️ Yahi is file ka dil hai, aur ye andaza nahi, saboot hai.
 *
 * Cron har due reminder par `advance_reminder()` chalata hai, aur wo `plan`
 * dekhe BINA `notified_at` bhar deta hai (ya repeat wale ko aage sarka deta
 * hai). Yaani wo har reminder ko CHHOOTA hai — free user ka bhi, Plus ka bhi,
 * chahe koi message jaye ya na jaye.
 *
 * Isliye agar koi reminder aisa mile jiska waqt beet chuka hai aur `notified_at`
 * abhi bhi khaali hai, to uska ek hi matlab hai: **cron us row tak pahuncha hi
 * nahi.** Ye env, plan, Twilio, SMTP — kisi se bhi nahi badalta. Ek hi saboot,
 * aur poori tarah bharosemand.
 */

export type DeliveryHealth = {
  /** Vercel ke env — yahi wo hissa hai jo user ne set kiya hai. */
  config: {
    twilio: boolean;
    smtp: boolean;
    /** Reminder ka WhatsApp template (Hinglish default). */
    waReminder: WaTemplateState;
    /** Document expiry ka WhatsApp template. */
    waDocument: WaTemplateState;
    /** `CRON_SECRET` server par set hai? (Value kabhi nahi bhejte.) */
    cronSecret: boolean;
  };
  /** Cron sach me chal raha hai ya nahi — upar poori wajah likhi hai. */
  cron: {
    /**
     * Beet chuke, chalu, par abhi tak na chhue gaye reminder.
     *
     * 0 = cron chal raha hai. 0 se zyada = cron un tak pahuncha hi nahi.
     */
    overdueUntouched: number;
    /** Sabse purana aisa reminder kab ka hai — "kab se band hai" ka jawab. */
    oldestOverdueAt: string | null;
    /**
     * Aakhri baar cron ne kisi reminder ko kab nipatt aaya.
     *
     * `null` = aaj tak kabhi nahi (yaani cron kabhi chala hi nahi).
     */
    lastNotifiedAt: string | null;
  };
  /**
   * Ek line ka nateeja — admin ko yahi padhna hai.
   *
   * ⚠️ Tarteeb maayne rakhti hai: pehle wo cheez jo baaki sab ko bekaar kar
   * deti hai. Cron hi na chale to "SMTP set hai" batana seedha bhataka deta hai.
   */
  verdict: {
    level: "ok" | "warn" | "down";
    title: string;
    detail: string;
  };
};

/**
 * Sirf GINTI — rows nahi.
 *
 * PostgREST ka `Prefer: count=exact` + `Range: 0-0` ginti `Content-Range` header
 * me deta hai (`0-0/42`). `adminGet` ye nahi karta (wo rows lauta ta hai),
 * isliye yahan seedha fetch — warna 5000 overdue reminder wali soorat me hum
 * poori table utaar ke sirf uski lambai ginte.
 */
async function countOf(query: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const n = Number(res.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}

export async function getDeliveryHealth(): Promise<DeliveryHealth> {
  const nowIso = new Date().toISOString();
  /**
   * 5 minute ka jhol jaan-boojh ke.
   *
   * Cron har minute chalta hai; abhi-abhi due hue reminder ka abhi tak na chhua
   * jaana bilkul normal hai. Bina is jhol ke ye jaanch har baar ek-do row par
   * jhootha alarm deti.
   */
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();

  const base =
    `reminders?is_on=eq.true&is_paused=eq.false&notified_at=is.null` +
    `&remind_at=lte.${cutoff}`;

  const [overdue, oldest, lastDone] = await Promise.all([
    countOf(`${base}&select=id`).catch(() => 0),
    adminGet<{ remind_at: string }>(`${base}&select=remind_at&order=remind_at.asc&limit=1`).catch(
      () => [],
    ),
    adminGet<{ notified_at: string }>(
      `reminders?notified_at=not.is.null&select=notified_at&order=notified_at.desc&limit=1`,
    ).catch(() => []),
  ]);

  const config = {
    twilio: twilioConfigured(),
    smtp: emailConfigured(),
    waReminder: waTemplateState("reminder", "hinglish"),
    waDocument: waTemplateState("document", "hinglish"),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

  const cron = {
    overdueUntouched: overdue,
    oldestOverdueAt: oldest[0]?.remind_at ?? null,
    lastNotifiedAt: lastDone[0]?.notified_at ?? null,
  };

  return { config, cron, verdict: verdictFor(config, cron, nowIso) };
}

function verdictFor(
  config: DeliveryHealth["config"],
  cron: DeliveryHealth["cron"],
  nowIso: string,
): DeliveryHealth["verdict"] {
  /**
   * ⚠️ Cron sabse pehle. Wo band ho to na email jaata hai na WhatsApp — chahe
   * Vercel par ek-ek env sahi set ho. Yahi wo soorat hai jise "env to set hai,
   * phir kyun nahi chal raha" wala sawaal describe karta hai.
   */
  if (cron.overdueUntouched > 0) {
    const since = cron.oldestOverdueAt
      ? `${Math.max(1, Math.round((Date.parse(nowIso) - Date.parse(cron.oldestOverdueAt)) / 60000))} min`
      : "kuch der";
    return {
      level: "down",
      title: `Cron chal hi nahi raha — ${cron.overdueUntouched} reminder ka waqt beet chuka hai par unhe kisi ne chhua nahi`,
      detail:
        `Sabse purana ${since} se atka hai. Ye env se nahi judta: cron har reminder ko chhoota hai, ` +
        `chahe user free ho ya Plus. Supabase > SQL Editor me \`select * from cron.job;\` chala ke dekho ` +
        `ki job hai ya nahi, aur uske command me \`<CRON_SECRET>\` placeholder ki jagah asli value padi hai ` +
        `ya nahi — bina badle har call 401 hoti hai aur ek bhi message nahi jaata.`,
    };
  }

  if (!config.cronSecret) {
    return {
      level: "down",
      title: "CRON_SECRET server par set nahi hai",
      detail:
        "Iske bina cron ki har call 401 ho jaati hai. Vercel ke env me CRON_SECRET daalo, " +
        "aur wahi value Supabase ke cron job ke Authorization header me bhi honi chahiye.",
    };
  }

  if (!config.smtp && !config.twilio) {
    return {
      level: "down",
      title: "Na SMTP set hai, na Twilio",
      detail: "Cron chal raha hai par bhejne ka koi raasta hi nahi hai. Vercel ke env dekho.",
    };
  }

  const gaps: string[] = [];
  if (!config.smtp) gaps.push("SMTP set nahi hai — email nahi jaayega");
  if (!config.twilio) gaps.push("Twilio set nahi hai — WhatsApp nahi jaayega");
  /**
   * ⚠️ Template ki kami sabse chupa hua kaatil hai. Twilio ka env poora sahi ho
   * sakta hai aur call bhi chali jaati hai — par production me Meta bina
   * approved template ke message REJECT kar deta hai. Sab kuch theek dikhta hai
   * aur user tak kabhi kuch nahi pahunchta.
   */
  if (config.twilio && config.waReminder === "none") {
    gaps.push("reminder ka WhatsApp template nahi hai — Meta free-form reject kar dega");
  }
  if (config.twilio && config.waDocument === "none") {
    gaps.push("document ka WhatsApp template nahi hai — Meta free-form reject kar dega");
  }

  if (gaps.length) {
    return {
      level: "warn",
      title: "Cron chal raha hai, par ek raasta band hai",
      detail: gaps.join(" · "),
    };
  }

  return {
    level: "ok",
    title: "Cron chal raha hai aur dono raaste khule hain",
    detail:
      cron.lastNotifiedAt
        ? "Kisi ek user ko na mile to neeche wali list me uski wajah dikhegi (Plus? number verify hua?)."
        : "Abhi tak koi reminder due hi nahi hua — pehle reminder ke waqt par phir dekhna.",
  };
}
