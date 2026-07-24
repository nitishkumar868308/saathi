import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin";
import { getDocumentSignedUrl, RewardsNotConfigured } from "@/lib/rewards-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ?path=<uid>/<docId>.jpg -> private documents bucket ka short-lived signed URL.
 * Sirf admin (isAuthed). Path documents/<uid>/... ke bahar nahi ja sakta.
 */
export async function GET(request: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
      { status: err instanceof RewardsNotConfigured ? 503 : 500 },
    );
  }
}
