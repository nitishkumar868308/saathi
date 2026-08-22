import { WHISPER_MODELS, DEFAULT_WHISPER_MODEL, whisperAvailable } from "@reel/media";
import { NextResponse } from "next/server";

import { dispatchConfigured, wakeWorker } from "@/lib/dispatch";
import { createTranscribeJob, getTranscribeJob } from "@/lib/transcribe";

/**
 * Auto captions ka darwaza (23.3 / 23.10).
 *
 * `GET  /api/transcribe`            — setup hai ya nahi (UI isse tay karti hai)
 * `GET  /api/transcribe?jobId=…`    — job ka haal aur nateeja
 * `POST /api/transcribe`            — job queue me daalo
 *
 * ⚠️ Transcription **yahan chalti nahi**. Ye route sirf job banata hai; kaam
 * worker karta hai. 30 second ki awaaz par whisper (small, CPU) aadha-ek minute
 * le leta hai — utni der ek Next route ko roke rakhna matlab poori UI ka atak
 * jaana, aur Vercel jaisi jagah par to timeout bhi.
 *
 * ⚠️ Aur `whisperAvailable()` **poochha** jaata hai, maan nahi liya jaata. UI is
 * jawab se hi tay karti hai ki button dikhana hai ya "setup chahiye" (23.3).
 *
 * ⚠️ **Par wo sawaal is machine se poochha jaata hai, aur wahi ek chupa hua bug
 * tha (25.4).** Studio ab Vercel par bhi chalti hai; wahan `python` hi nahi
 * hota, isliye `whisperAvailable()` hamesha `false` deta — aur UI auto-captions
 * ko "setup chahiye" keh kar band rakhti, jabki kaam to worker ko karna hai, is
 * route ko nahi. Sawaal galat machine se poochha ja raha tha.
 *
 * Isliye ab do jawab hain: cloud worker set ho (`REEL_DISPATCH_*`) to whisper
 * runner par install hota hai aur ye route apni machine ki taraf dekhta hi nahi.
 * Warna purana wala hi sach hai — worker isi PC par hai, whisper bhi yahin
 * chahiye.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const jobId = new URL(request.url).searchParams.get("jobId");

  if (jobId) {
    const job = await getTranscribeJob(jobId);
    if (!job) return NextResponse.json({ error: "aisi koi job nahi" }, { status: 404 });
    return NextResponse.json({ job });
  }

  // Cloud worker ho to whisper runner par install hota hai — is machine par
  // dekhna bekaar hai, aur wahi dekhna Vercel par sab band kar deta tha.
  if (dispatchConfigured()) {
    return NextResponse.json({
      available: true,
      where: "cloud",
      detail: "faster-whisper GitHub runner par install hota hai (job ke waqt).",
      models: WHISPER_MODELS,
      defaultModel: DEFAULT_WHISPER_MODEL,
      install: "pip install faster-whisper",
    });
  }

  const check = await whisperAvailable();
  return NextResponse.json({
    available: check.ok,
    where: "local",
    detail: check.detail.split("\n")[0] ?? "",
    models: WHISPER_MODELS,
    defaultModel: DEFAULT_WHISPER_MODEL,
    install: "pip install faster-whisper",
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    projectId?: string;
    assetId?: string;
    language?: string;
    model?: string;
    text?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON nahi thi" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const assetId = body.assetId?.trim();
  if (!projectId || !assetId) {
    return NextResponse.json({ error: "projectId aur assetId dono chahiye" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";

  /*
   * ⚠️ Text pata ho to whisper ki zaroorat hi nahi (23.5) — isliye ye jaanch
   * sirf tab lagti hai jab sach me whisper chalna hai. Warna TTS wali awaaz par
   * bhi "setup chahiye" aata, jabki wahan uska koi kaam hi nahi.
   */
  const cloud = dispatchConfigured();

  if (text.length === 0 && !cloud) {
    const check = await whisperAvailable();
    if (!check.ok) {
      return NextResponse.json(
        {
          error: "faster-whisper is machine par nahi hai — auto captions band hain.",
          install: "pip install faster-whisper",
          detail: check.detail.split("\n")[0] ?? "",
        },
        { status: 503 },
      );
    }
  }

  const job = await createTranscribeJob({
    projectId,
    assetId,
    language: body.language ?? "auto",
    model: body.model ?? DEFAULT_WHISPER_MODEL,
    ...(text ? { text } : {}),
  });

  /*
   * Cloud worker ko jagao (25.2).
   *
   * ⚠️ `whisper` sirf tab `true` hai jab text pata **nahi** hai. Ye ek switch
   * nahi, paise ka faisla hai: uske sach hone par runner pip install + model
   * download karta hai (~1-2 minute har run). TTS se bani awaaz me text pehle se
   * hota hai — wahan sirf ffmpeg ka kaam hai (`alignWords`), aur wo runner me
   * pehle se maujood hai.
   */
  const dispatched = cloud
    ? (await wakeWorker({ reason: `transcribe ${job.id}`, whisper: text.length === 0 })).ok
    : null;

  return NextResponse.json({ job, dispatched }, { status: 201 });
}
