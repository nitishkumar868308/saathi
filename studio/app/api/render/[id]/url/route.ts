import { fail, handle, ok } from "@/lib/api";
import { getRenderJob } from "@/lib/renders";
import { storage } from "@/lib/storage";

/**
 * `GET /api/render/[id]/url` — bani hui video ka download link (11.10).
 *
 * ⚠️ URL har baar naya banta hai aur DB me kabhi save nahi hota — bilkul assets
 * ki tarah (Phase 1 ka locked rule). Signed URL minaton me marte hain; history
 * me save kar dene par kal wahi link toota hua milta.
 *
 * `?thumb=1` par poster ka URL.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

const URL_TTL_SECONDS = 15 * 60;

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const job = await getRenderJob(context.params.id);
    if (!job) return fail("not found", 404, "aisi koi render job nahi hai");

    const params = new URL(request.url).searchParams;
    const wantThumb = params.get("thumb") === "1";
    const key = wantThumb ? job.thumbKey : job.outputKey;

    if (!key) {
      return fail(
        "not found",
        404,
        wantThumb ? "is render ka thumbnail nahi bana" : "ye render abhi poora nahi hua",
      );
    }

    const url = await storage().getSignedUrl(key, {
      expiresIn: URL_TTL_SECONDS,
      ...(params.get("download") === "1"
        ? { downloadName: `reel-${job.id.slice(0, 8)}.mp4` }
        : {}),
    });

    return ok({ url, expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString() });
  });
}
