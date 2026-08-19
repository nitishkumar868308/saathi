import { WHISPER_MODELS, DEFAULT_WHISPER_MODEL, whisperAvailable } from "@reel/media";
import { NextResponse } from "next/server";

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

  const check = await whisperAvailable();
  return NextResponse.json({
    available: check.ok,
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
  if (text.length === 0) {
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

  return NextResponse.json({ job }, { status: 201 });
}
