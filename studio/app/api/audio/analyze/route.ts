import { extensionOf, detectBeats, speechTrimRange } from "@reel/core";
import { audioEnergy, detectSpeechSegments } from "@reel/media";
import { NextResponse } from "next/server";

import { getAsset } from "@/lib/assets";
import { scratchDir, storage, withLocalFile } from "@/lib/storage";

/**
 * `POST /api/audio/analyze` — beat aur chuppi ka naksha (24.7).
 *
 * ⚠️ Ye job queue me **nahi** jaata, aur ye Phase 23 ki transcription se ulta
 * faisla hai. Wajah waqt ki hai: yahan koi model nahi chalta, sirf ffmpeg ek
 * baar file padhta hai — 30 second ki audio par ye ek second se kam leta hai.
 * Utni der ke liye job, polling aur progress khada karna sirf jhanjhat hai.
 * Whisper wahan minute bhar leta hai, isliye wahan job zaroori tha.
 *
 * ⚠️ Yahan doc ko haath nahi lagta. Ye route sirf **batata** hai ki beat kahan
 * hain; unpar cut lagana ya na lagana UI ka (yaani user ka) faisla hai, aur wo
 * normal undo-hone-layak op se hota hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: { assetId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON nahi thi" }, { status: 400 });
  }

  const assetId = body.assetId?.trim();
  if (!assetId) return NextResponse.json({ error: "assetId chahiye" }, { status: 400 });

  const asset = await getAsset(assetId);
  if (!asset) return NextResponse.json({ error: "aisi koi asset nahi" }, { status: 404 });

  const extension = extensionOf(asset.filename) ?? extensionOf(asset.key);

  try {
    const result = await withLocalFile(
      storage(),
      asset.key,
      { extension, scratchDir: scratchDir() },
      async (path) => {
        const [energy, speech] = await Promise.all([
          audioEnergy(path),
          detectSpeechSegments(path),
        ]);

        const beats = detectBeats(energy);
        const trim = speechTrimRange(speech.segments, {
          durationSeconds: speech.durationSeconds,
        });

        return {
          beats: beats.times,
          bpm: beats.bpm,
          durationSeconds: speech.durationSeconds,
          speechSegments: speech.segments.length,
          trim,
        };
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    /*
     * ffmpeg ka na milna aur file ka kharab hona — dono yahin girte hain, aur
     * dono ka jawab user ke liye ek hi kaam ka hai: kya hua. Chupchaap khaali
     * jawab bhejna sabse bura hota — UI "koi beat nahi mila" dikhati aur user
     * doosri file dhoondhne lagta.
     */
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
