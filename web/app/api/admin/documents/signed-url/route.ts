import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";
import { getDocumentSignedUrl, RewardsNotConfigured } from "@/lib/rewards-server";
import { R2NotConfigured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ?path=<uid>/<docId>.jpg -> R2 ke private bucket ka short-lived signed URL.
 * Sirf wo admin jiske paas "documents" menu ho. Path documents/<uid>/… ke
 * bahar nahi ja sakta.
 */
export async function GET(request: Request) {
  const g = await guard("documents");
  if (!g.ok) return g.res;
  const path = new URL(request.url).searchParams.get("path") ?? "";
  // Traversal / absolute path block.
  if (!path || path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }

  try {
    const signedUrl = await getDocumentSignedUrl(path);
    if (!signedUrl) {
      return NextResponse.json({ error: "not found / file storage me nahi" }, { status: 404 });
    }
    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("[admin/documents/signed-url]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sign failed" },
      {
        status:
          err instanceof RewardsNotConfigured || err instanceof R2NotConfigured ? 503 : 500,
      },
    );
  }
}
