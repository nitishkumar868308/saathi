/**
 * Cron ki nabz — "call sach me aayi thi ya nahi".
 *
 * ⚠️ Ye admin ke `delivery-health.ts` ki ek asli khaali jagah bharta hai. Wahan
 * cron ka haal REMINDERS se lagaya jaata hai (beet chuke par na chhue gaye
 * reminder ginta hai), aur wo saboot pakka hai — par wo do bilkul alag halaat
 * ko alag nahi kar paata:
 *
 *   • **Kisi ka koi reminder due hi nahi tha** — ginti 0, yaani "sab theek hai",
 *     chahe cron mahine se band pada ho. Nayi app me ye bilkul aam soorat hai.
 *   • **Call aa rahi hai par 401 par lauT rahi hai** — reminder atke dikhte
 *     hain (sahi), par ye pata nahi chalta ki call aayi bhi thi ya nahi.
 *
 * Aur in dono ka ilaaj bilkul ulta hai: pehle me job hi maujood nahi (Supabase
 * me `cron-setup.sql` chalao), doosre me job hai par secret purana hai (wahi
 * file dobara chalao). Nabz ke bina admin ko ye faisla karne ka koi raasta hi
 * nahi tha.
 *
 * Nishaan auth PAAR karne ke baad padta hai — yaani nabz ka hona hi saabit kar
 * deta hai ki secret bhi sahi tha.
 *
 * Fail hone par kuch nahi hota (aur ye jaan-boojh ke hai): ye sirf jaanch ka
 * saboot hai. Iski wajah se ek bhi reminder ruk jaana bilkul ulta sauda hoga.
 * Table na bani ho (`cron-heartbeat.sql` nahi chalaya) to bhi sab pehle jaisa
 * chalta rehta hai.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type CronJobName =
  | "send-reminders"
  | "document-expiry"
  | "error-digest"
  | "sync-play-prices";

export function beatCron(job: CronJobName): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  /**
   * Jaan-boojh ke `await` nahi.
   *
   * ⚠️ `send-reminders` har MINUTE chalta hai aur uske andar pehle se do-do
   * network call per reminder hoti hain. Nabz ke liye us poori chain me ek aur
   * intezaar jodna — sirf ek jaanch ke liye — theek nahi. Fail ho to bhi kuch
   * nahi bigadta (upar wajah likhi hai), isliye iska nateeja kisi ko chahiye hi
   * nahi.
   */
  void fetch(`${SUPABASE_URL}/rest/v1/cron_health?on_conflict=job`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      // Upsert — pehli baar row banti hai, uske baad wahi row aage badhti hai.
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ job, last_ok_at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => {
    /* nabz ek jaanch hai, kaam nahi — iske liye kuch nahi rukta */
  });
}

/** Kis job ne aakhri baar kab nabz chhodi. Table na ho to khaali map. */
export async function readCronBeats(): Promise<Record<string, string>> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return {};
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cron_health?select=job,last_ok_at`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as { job: string; last_ok_at: string }[];
    return Object.fromEntries(rows.map((r) => [r.job, r.last_ok_at]));
  } catch {
    return {};
  }
}
