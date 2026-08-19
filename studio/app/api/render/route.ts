import { preflight, requireExportPreset, type Doc } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { listAssets } from "@/lib/assets";
import { loadProject } from "@/lib/projects";
import { createRenderJob, listRenderJobs } from "@/lib/renders";

/**
 * `POST /api/render` — export shuru karo (11.6)
 * `GET  /api/render?projectId=…` — us project ke pichhle renders (11.11)
 *
 * ⚠️ **Doc yahan se jama hota hai, client se nahi aata.** Client apna doc bhej
 * sakta tha (wo pehle se uske paas hai), par tab ek chupchaap chalne wali galti
 * banti: browser ka doc autosave se thoda peeche ho sakta hai, aur render us
 * purane doc ka ho jaata. Server DB se padhta hai — wahi ek sach hai.
 *
 * ⚠️ Preflight **yahan bhi** chalti hai, sirf dialog me nahi. Dialog ki jaanch
 * soojh-boojh hai, deewar nahi: AI patch, script ya purana tab seedha yahan aa
 * sakta hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StartSchema = z.object({
  projectId: z.string().min(1),
  preset: z.string().min(1),
  /** Warnings dekh kar bhi aage badhna hai (11.4 ka "Export anyway"). */
  force: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, StartSchema);
    if (!body.ok) return body.response;

    const { projectId, preset } = body.data;
    requireExportPreset(preset);

    const project = await loadProject(projectId);
    if (!project) return fail("not found", 404, "aisa koi project nahi hai");

    const assets = await listAssets({ kinds: [], tag: null, search: null, sort: "recent" });
    const assetMap: Record<string, { width: number | null; height: number | null; durationMs: number | null }> = {};
    for (const asset of assets) {
      assetMap[asset.id] = {
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
      };
    }

    const check = preflight({ doc: project.doc as Doc, presetId: preset, assets: assetMap });
    if (!check.canExport) {
      return Response.json(
        {
          error: "export nahi ho sakta",
          reason: check.errors.map((issue) => issue.message).join(" "),
          issues: check.issues,
        },
        { status: 422 },
      );
    }

    const job = await createRenderJob({ projectId, preset, doc: project.doc as Doc });
    return ok({ job, warnings: check.warnings }, 201);
  });
}

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return fail("bad request", 400, "projectId chahiye");

    return ok({ jobs: await listRenderJobs(projectId) });
  });
}
