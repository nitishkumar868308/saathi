import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { r2Configured, r2Key, R2NotConfigured } from "@/lib/r2";
import {
  commitUpload,
  documentBelongsTo,
  extFor,
  saveDocumentFile,
  storageDbConfigured,
  type UploadKind,
} from "@/lib/storage-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload ho jaane ke baad ka doosra kadam.
 *
 *   POST { kind: "document", docId, contentType }  -> size jaanchi, DB me likha
 *   POST { kind: "avatar" }                        -> size jaanchi, URL wapas
 *
 * Ye do kaam karta hai jo pehle kadam me ho hi nahi sakte the:
 *   1. R2 se HEAD maar kar ASLI size leta hai (presigned PUT size rok nahi
 *      sakta — hadd se badi file yahin par mit jaati hai).
 *   2. `documents` row ko service_role se khud bharta hai, taaki `file_size`
 *      wahi ho jo sach me pada hai, app ki batayi hui nahi.
 */
export async function POST(request: Request) {
  if (!r2Configured()) {
    return NextResponse.json({ error: new R2NotConfigured().message }, { status: 503 });
  }

  const uid = await appUserId(request);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let kind: UploadKind = "document";
  let docId = "";
  let contentType = "";
  try {
    const body = await request.json();
    kind = body?.kind === "avatar" ? "avatar" : "document";
    docId = String(body?.docId ?? "").trim();
    contentType = String(body?.contentType ?? "").split(";")[0].trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (kind === "avatar") {
    const key = r2Key.avatar(uid);
    const res = await commitUpload(key, "avatar");
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, size: res.size, path: `${uid}/avatar.jpg` });
  }

  if (!storageDbConfigured()) {
    return NextResponse.json({ error: "supabase env missing" }, { status: 503 });
  }

  const ext = extFor(contentType);
  if (!ext) return NextResponse.json({ error: "unknown type" }, { status: 415 });

  if (!(await documentBelongsTo(docId, uid))) {
    return NextResponse.json({ error: "document nahi mila" }, { status: 404 });
  }

  const path = `${uid}/${docId}.${ext}`;
  const res = await commitUpload(r2Key.document(uid, docId, ext), "document");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const saved = await saveDocumentFile(docId, uid, path, res.size, contentType);
  if (!saved) {
    return NextResponse.json({ error: "document save nahi hua" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, size: res.size });
}
