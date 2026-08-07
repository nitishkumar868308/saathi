import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { deleteObject, r2Configured, r2Key, R2NotConfigured } from "@/lib/r2";
import { documentKeyFor } from "@/lib/storage-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apni file R2 se hata do.
 *
 *   POST { path: "<uid>/<docId>.jpg" }   -> document
 *   POST { kind: "avatar" }              -> apni profile photo
 *
 * ⚠️ Ye chalta rehna zaroori hai. Document DB se delete ho jaye aur R2 ki file
 * padi rah jaye to wo "deleted" document hamesha ke liye bucket me pada rehta
 * hai — user ke liye gaya hua, bill me zinda, aur kisi purane signed URL se
 * padha bhi ja sakta hai.
 */
export async function POST(request: Request) {
  if (!r2Configured()) {
    return NextResponse.json({ error: new R2NotConfigured().message }, { status: 503 });
  }

  const uid = await appUserId(request);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let path = "";
  let kind = "document";
  try {
    const body = await request.json();
    kind = body?.kind === "avatar" ? "avatar" : "document";
    path = String(body?.path ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const key = kind === "avatar" ? r2Key.avatar(uid) : documentKeyFor(path, uid);
  if (!key) return NextResponse.json({ error: "bad path" }, { status: 400 });

  const ok = await deleteObject(key);
  if (!ok) return NextResponse.json({ error: "delete fail" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
