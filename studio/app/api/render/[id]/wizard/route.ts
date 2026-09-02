import { readWizardMemory } from "@reel/core";

import { fail, handle, ok } from "@/lib/api";
import { getRenderJobDoc } from "@/lib/renders";

/**
 * `GET /api/render/[id]/wizard` — is video ke wizard ka draft (26.30).
 *
 * ⚠️ Poora doc **kabhi nahi** jaata, sirf yaadgaar aur scene ki id. Doc 100KB+
 * ka hota hai; use browser tak bhejna sirf isliye ki usme se do cheezein
 * chahiye thi, wo har baar wizard kholne par ek bekaar ka bojh hai — `renders.ts`
 * me isi wajah se job ki list me bhi `doc` nahi aata.
 *
 * ⚠️ Job ka doc **frozen** hai (export ke waqt ka). Yahi is poore raaste ka
 * aadhaar hai: project uske baad kitna bhi badal chuka ho, us video ke apne
 * chunav yahin surakshit hain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const doc = await getRenderJobDoc(context.params.id);
    if (!doc) return fail("not found", 404, "aisi koi render job nahi hai");

    const memory = readWizardMemory(doc.meta.wizard);
    if (!memory) {
      return fail(
        "wizard ki yaad nahi hai",
        404,
        "ye reel wizard se nahi bani thi (ya us waqt ye jaankari jama hoti hi nahi thi).",
      );
    }

    return ok({ memory, docSceneIds: doc.scenes.map((scene) => scene.id) });
  });
}
