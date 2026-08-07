import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { presignDownload, r2Configured, R2NotConfigured } from "@/lib/r2";
import { documentKeyFor } from "@/lib/storage-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * App apni document file padhne ke liye yahan se short-lived URL leti hai.
 *
 *   POST { path: "<uid>/<docId>.jpg" }  ->  { url }
 *
 * ⚠️ `path` request se aata hai, isliye uski jaanch hi sab kuch hai:
 * `documentKeyFor` sirf tab key deta hai jab path bilkul `<uid>/<file>` ho AUR
 * wo uid token wala ho. `..`, absolute path, teen hisse — sab wahin ruk jaate
 * hain. Ek dheeli jaanch = kisi ka bhi passport khul jaana.
 */
export async function POST(request: Request) {
  if (!r2Configured()) {
    return NextResponse.json({ error: new R2NotConfigured().message }, { status: 503 });
  }

  const uid = await appUserId(request);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let path = "";
  let downloadName: string | undefined;
  try {
    const body = await request.json();
    path = String(body?.path ?? "").trim();
    const n = String(body?.downloadName ?? "").trim();
    if (n) downloadName = n.slice(0, 100);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const key = documentKeyFor(path, uid);
  if (!key) return NextResponse.json({ error: "bad path" }, { status: 400 });

  try {
    // 10 minute — badi file dheeme net par utarne ke liye kaafi.
    return NextResponse.json({ url: presignDownload(key, 600, downloadName) });
  } catch (err) {
    console.error("[storage/download-url]", err);
    return NextResponse.json({ error: "presign failed" }, { status: 500 });
  }
}
