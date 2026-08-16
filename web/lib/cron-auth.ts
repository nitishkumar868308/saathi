import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { beatCron, type CronJobName } from "@/lib/cron-heartbeat";

/**
 * Cron routes ka ek hi darwaza — aur ek 401 jo KHUD apni wajah batata hai.
 *
 * ── Ye kyun bana ──────────────────────────────────────────────────────
 *
 * ⚠️ Pehle chaaron cron routes me ek hi check ki chaar copies thi, aur teenon
 * jawab ek jaise the: `{"error":"unauthorized"}`. Wo jawab sach to bolta tha par
 * kuch batata nahi tha — aur yahi is poore feature ka sabse mehnga andhera hai.
 *
 * Us ek line se ye teen bilkul alag halaat alag nahi kiye ja sakte:
 *
 *   1. **Server par secret hai hi nahi** — Vercel me env set nahi, ya deploy me
 *      chadha hi nahi (env badalne ke baad NAYA deploy chahiye; purana chalta
 *      rehta hai).
 *   2. **Header aaya hi nahi** — job ka command galat ban gaya, ya beech me koi
 *      proxy/redirect header gira raha hai.
 *   3. **Dono taraf secret hai par ALAG hai** — paste me space/newline aa gaya,
 *      ya do jagah do value pad gayi.
 *
 * Teenon ka ilaaj bilkul alag hai, aur teenon par `{"error":"unauthorized"}`
 * dikhta tha. Isi wajah se "sab to sahi daala hai, phir 401 kyun" wala chakkar
 * ghanton chalta tha.
 *
 * Ab 401 ke saath dono taraf ka **naap aur nishaan** jaata hai:
 *
 *   • `len`  — kitne akshar ka hai (space/newline yahin pakda jaata hai)
 *   • `md5`  — poori value ka nishaan
 *
 * ⚠️ Secret KHUD kabhi nahi jaata — na poora, na uska koi hissa. `md5` sirf
 * milaan ke liye hai: Postgres me `md5()` pehle se maujood hai (bina kisi
 * extension ke), isliye job ka apna secret bhi wahi nishaan bana ke SQL Editor
 * me seedha compare kiya ja sakta hai:
 *
 *     select jobname,
 *            md5(substring(command from 'Bearer ([^"]+)')) as job_md5,
 *            length(substring(command from 'Bearer ([^"]+)')) as job_len
 *     from cron.job where command like '%/api/cron/%';
 *
 * Dono `md5` ek = value ek hai (galti kahin aur hai). Alag = value alag hai.
 * `got.len = 0` = header pahunch hi nahi raha. `expected.len = 0` = Vercel par
 * env hi nahi (ya deploy purana hai).
 *
 * md5 yahan surakhsha ke liye nahi, sirf MILAAN ke liye hai — aur wo iske liye
 * bilkul theek hai. (Postgres me sha256 ke liye pgcrypto chahiye hota, jo har
 * project me enabled nahi hota; md5 hamesha hota hai.)
 */

const CRON_SECRET = process.env.CRON_SECRET;

/** Value ka naap aur nishaan — value khud kabhi nahi. */
function fingerprint(v: string | null | undefined) {
  const s = v ?? "";
  return {
    len: s.length,
    md5: s ? createHash("md5").update(s).digest("hex") : null,
  };
}

/**
 * Cron ka pehra.
 *
 *     const denied = requireCron(request, "send-reminders");
 *     if (denied) return denied;
 *
 * `null` laute to call asli hai aur nabz bhi chhod di gayi hai (`beatCron`) —
 * yaani caller ko kuch aur nahi karna. Warna seedha wahi 401 laut jaata hai jo
 * apni wajah saath le kar jaata hai.
 */
export function requireCron(request: Request, job: CronJobName): NextResponse | null {
  const header = request.headers.get("authorization");
  // `Bearer ` hata ke sirf value — naap aur nishaan usi ka lena hai, warna har
  // taraf 7 akshar extra ginte aur milaan bekaar ho jaata.
  const got = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!CRON_SECRET || got !== CRON_SECRET) {
    return NextResponse.json(
      {
        error: "unauthorized",
        // ⚠️ Ye do object hi is 401 ka poora maqsad hain. Inhe hataane se wahi
        // purana andhera wapas aa jaata hai (upar poori wajah likhi hai).
        expected: fingerprint(CRON_SECRET),
        got: fingerprint(got),
        hint: !CRON_SECRET
          ? "Vercel par CRON_SECRET set hi nahi hai (ya deploy purana hai — env badalne ke baad naya deploy chahiye)"
          : !got
            ? "Authorization header aaya hi nahi — cron job ka command dekho"
            : "Dono taraf secret hai par alag hai — md5/len milao (space ya newline to nahi aa gaya?)",
      },
      { status: 401 },
    );
  }

  /**
   * Auth paar — yaani call sach me aayi AUR secret bhi sahi tha.
   *
   * Nabz yahin chhodte hain, har route me alag se nahi: wo ek hi baat ka saboot
   * hai, aur use is gate se bahar rakhne par ek route me chhoot jaana bahut
   * aasan tha (wajah `lib/cron-heartbeat.ts` par likhi hai).
   */
  beatCron(job);
  return null;
}
