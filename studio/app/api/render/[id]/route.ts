import { fail, handle, ok } from "@/lib/api";
import { cancelRenderJob, getRenderJob } from "@/lib/renders";

/**
 * `GET    /api/render/[id]` — job ka abhi ka haal (UI 1-2s me poll karta hai)
 * `DELETE /api/render/[id]` — cancel (11.9)
 *
 * ⚠️ Cancel ke liye worker ko koi alag channel nahi chahiye. Wo har do second me
 * DB dekhta hai; status badalte hi Remotion ka abort signal chal jaata hai aur
 * scratch saaf ho jaata hai. Ek aur channel (websocket/queue) rakhne ka matlab
 * hota ek aur cheez jo alag se toot sakti — aur cancel wo cheez hai jise tab
 * chahiye hota hai jab pehle hi kuch galat ho chuka ho.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const job = await getRenderJob(context.params.id);
    if (!job) return fail("not found", 404, "aisi koi render job nahi hai");
    return ok({ job });
  });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const job = await cancelRenderJob(context.params.id);
    if (!job) {
      // Ho sakta hai job poori ho chuki ho — us par "cancel nahi hua" kehna
      // theek hai, par error nahi. Wo ek asli halat hai, galti nahi.
      const current = await getRenderJob(context.params.id);
      if (!current) return fail("not found", 404, "aisi koi render job nahi hai");
      return ok({ job: current, cancelled: false });
    }
    return ok({ job, cancelled: true });
  });
}
