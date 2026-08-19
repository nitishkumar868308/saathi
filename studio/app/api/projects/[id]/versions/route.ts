import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { createProjectVersion, listProjectVersions } from "@/lib/projects";

/**
 * `GET  /api/projects/[id]/versions` — snapshot list (doc ke bina, sirf label + time)
 * `POST /api/projects/[id]/versions` — naya snapshot
 *
 * ⚠️ Snapshot **DB ka maujooda doc** leta hai, client ka bheja hua nahi. Isliye
 * har snapshot ek aisi haalat hai jo sach me save hui thi — restore karne par
 * kabhi koi aisi cheez wapas nahi aati jo kabhi thi hi nahi.
 *
 * Ye undo/redo ki jagah nahi hai. Undo browser me patches se chalta hai; ye
 * "kal shaam wali reel wapas chahiye" wali cheez hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

const CreateVersionSchema = z.object({
  label: z.string().trim().min(1).max(120).default("manual"),
});

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => ok({ versions: await listProjectVersions(context.params.id) }));
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, CreateVersionSchema);
    if (!body.ok) return body.response;

    const version = await createProjectVersion(context.params.id, body.data.label);
    if (!version) return fail("not found", 404, "aisa koi project nahi hai");
    return ok({ version }, 201);
  });
}
