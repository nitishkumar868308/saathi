import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { dispatchConfigured, dispatchRenderWorker } from "@/lib/dispatch";
import { WORKER_OFFLINE_AFTER_SECONDS, workerStatus } from "@/lib/renders";
import { restJson } from "@/lib/supabase";

/**
 * `POST /api/cron/reel-dispatch` — atki hui job ka safety net (25.5).
 *
 * ⚠️ **Ye asli raasta nahi hai.** Asli raasta seedha hai: Export dabao → job DB
 * me → studio wahin `repository_dispatch` bhej deti hai → runner uth jaata hai
 * (`studio/lib/dispatch.ts`). Wo turant hota hai aur 99% baar wahi kaafi hai.
 *
 * Ye file us 1% ke liye hai jise nazarandaz karna sabse mehnga padta:
 *
 *   * dispatch ke lamhe GitHub down tha, ya PAT expire ho gaya tha
 *   * job `reel_requeue_stale_jobs` se wapas queue me aayi (runner beech me mar
 *     gaya tha) — us waqt koi Export nahi dab raha, isliye jagane wala koi nahi
 *   * kisi ne SQL/script se seedha queue me job daal di
 *
 * In teeno me job queue me **hamesha ke liye** padi rehti hai. Koi error kahin
 * nahi dikhta, kyunki galti kisi se hui hi nahi — bas ghanti bajane wala koi
 * nahi tha. Isi shakl ki khaami sabse buri hoti hai: sab kuch theek dikhta hai.
 *
 * ── Kharcha ─────────────────────────────────────────────────────────────
 *
 * ⚠️ Ye route **khud** ghanti nahi bajata jab tak kaam na ho. Queue khaali ho to
 * ek DB query par khatam. Private repo par Actions ke 2000 minute/month hain aur
 * har khaali runner bhi ~1 minute khaata hai — isliye "har 5 minute par ek run"
 * jaisa kuch yahan nahi ho sakta.
 *
 * ⚠️ Aur worker chal raha ho to bhi dispatch nahi jaata. Drain mode wala worker
 * queue ki **saari** job nipta kar hi rukta hai, isliye chalte runner ke upar
 * dobara bulana sirf paisa jalata hai (concurrency guard use waise bhi rok deta,
 * par tab tak ek runner utha kar).
 *
 * ── Chalu kaise karein ──────────────────────────────────────────────────
 *
 * `supabase/cron-reel-dispatch.sql` — wahi pg_cron + pg_net wala pattern jo
 * baaki cron ka hai. 15 minute kaafi hai; ye jaal hai, ghadi nahi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Value ka naap aur nishaan — value khud kabhi nahi. */
function fingerprint(value: string | null | undefined) {
  const text = value ?? "";
  return { len: text.length, md5: text ? createHash("md5").update(text).digest("hex") : null };
}

interface QueuedJob {
  id: string;
  kind: string | null;
  input: { text?: string } | null;
}

async function run(request: Request): Promise<NextResponse> {
  /*
   * Wahi pehra jo baaki cron routes ka hai (`web/lib/cron-auth.ts`), aur wahi
   * 401 jo apni wajah saath le kar jaata hai. Sirf "unauthorized" likhna hi wo
   * halat banata hai jisme secret dono taraf "sahi" dikhta hai aur call phir bhi
   * chup-chaap fail hoti rehti hai.
   */
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  const got = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!secret || got !== secret) {
    return NextResponse.json(
      {
        error: "unauthorized",
        expected: fingerprint(secret),
        got: fingerprint(got),
        hint: !secret
          ? "Studio ke Vercel project me CRON_SECRET set nahi hai (ya deploy purana hai)"
          : !got
            ? "Authorization header aaya hi nahi — cron job ka command dekho"
            : "Dono taraf secret hai par alag — md5/len milao (space ya newline to nahi?)",
      },
      { status: 401 },
    );
  }

  if (!dispatchConfigured()) {
    return NextResponse.json({
      ok: true,
      dispatched: false,
      reason: "REEL_DISPATCH_REPO / REEL_DISPATCH_TOKEN set nahi hai — cloud worker band hai",
    });
  }

  const queued = await restJson<QueuedJob>(
    "/reel_render_jobs?status=eq.queued&select=id,kind,input&order=created_at&limit=50",
  );

  if (queued.length === 0) {
    return NextResponse.json({ ok: true, queued: 0, dispatched: false, reason: "queue khaali" });
  }

  /*
   * Worker pehle se chal raha ho to kuch mat karo. Drain mode wala worker queue
   * ki saari job nipta kar hi rukta hai — ye jobs use waise bhi mil jaayengi.
   */
  const worker = await workerStatus();
  if (worker.online) {
    return NextResponse.json({
      ok: true,
      queued: queued.length,
      dispatched: false,
      reason: `worker pehle se chal raha hai (${worker.workerId}, ${worker.secondsAgo}s pehle)`,
    });
  }

  /*
   * ⚠️ Whisper sirf tab, jab queue me aisi transcribe job ho jiska text pata
   * nahi hai. Ye paise ka faisla hai: `true` par runner har baar pip install +
   * model download karta hai (~1-2 minute). TTS wali awaaz me text pehle se
   * hota hai — wahan sirf ffmpeg chahiye, jo runner me maujood hai.
   */
  const whisper = queued.some(
    (job) => job.kind === "transcribe" && !(job.input?.text ?? "").trim(),
  );

  const result = await dispatchRenderWorker({
    reason: `safety net — ${queued.length} job queue me, worker ${worker.lastSeen ?? "kabhi nahi"} se chup`,
    whisper,
  });

  if (!result.ok) console.error(`[reel-dispatch cron] ⚠️ ${result.detail}`);

  return NextResponse.json(
    {
      ok: result.ok,
      queued: queued.length,
      dispatched: result.ok,
      whisper,
      detail: result.detail,
      /** UI ke "offline" ki hadd — jaanch ke waqt saamne rehna chahiye. */
      offlineAfterSeconds: WORKER_OFFLINE_AFTER_SECONDS,
    },
    // 200 hi — cron ko fail dikhana tab chahiye jab hum galat hon, GitHub nahi.
    { status: 200 },
  );
}

/**
 * pg_net `net.http_post` bhejta hai — isliye asli darwaza POST hai (baaki saare
 * cron routes bhi wahi hain, `web/app/api/cron/*`).
 *
 * ⚠️ GET bhi wahi kaam karta hai, aur wo soch kar hai: jaanch ke waqt `curl -H
 * "Authorization: Bearer …"` likhna hi kaafi ho, `-X POST` yaad rakhna na pade.
 * Dono par pehra ek hi hai, isliye ye khidki nahi — sirf ek seedha handle.
 */
export const POST = run;
export const GET = run;
