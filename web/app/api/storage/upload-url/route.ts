import { NextResponse } from "next/server";
import { appUserId } from "@/lib/app-auth";
import { presignUpload, r2Key, R2NotConfigured, r2Configured } from "@/lib/r2";
import {
  documentBelongsTo,
  documentFileName,
  extFor,
  parseVersion,
  rulesFor,
  storageDbConfigured,
  type UploadKind,
} from "@/lib/storage-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * App yahan se upload ka presigned URL leti hai.
 *
 *   POST { kind: "avatar" }                      -> avatars/<uid>/avatar.jpg
 *   POST { kind: "document", docId, contentType } -> documents/<uid>/<docId>.<ext>
 *   POST { …, version: 2 }                        -> documents/<uid>/<docId>-v2.<ext>
 *
 * `version` renew ke liye hai: uske bina nayi photo purani ke UPAR chadh jaati
 * thi aur purana document hamesha ke liye mit jaata tha. Poori wajah
 * `supabase/document-versions.sql` ke upar likhi hai. Field na aaye to purana
 * raasta chalta hai — isliye purani app aur purane document bilkul nahi hilte.
 *
 * ⚠️ `uid` HAMESHA token se aata hai, kabhi body se. Body me uid maan lena
 * matlab koi bhi kisi ke bhi folder me file rakh sakta hai — aur R2 me RLS
 * jaisi koi doosri deewar hai hi nahi, ye hi ek deewar hai.
 *
 * Extension bhi hum tay karte hain (contentType se), client ke bheje naam se
 * nahi — warna `x.jpg/../../y` jaisi cheezein key me ghus sakti hain.
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
  /**
   * Kaunsa version chadh raha hai — renew par app `snapshot_document_version()`
   * ka lautaya hua number + 1 bhejti hai. Na aaye to purana raasta
   * (`<docId>.<ext>`), taaki purani app aur har purana document waise ka waisa
   * chalta rahe.
   */
  let version: number | undefined;
  try {
    const body = await request.json();
    kind = body?.kind === "avatar" ? "avatar" : "document";
    docId = String(body?.docId ?? "").trim();
    contentType = String(body?.contentType ?? "").split(";")[0].trim().toLowerCase();
    version = parseVersion(body?.version);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { types } = rulesFor(kind);
  if (!types.includes(contentType)) {
    return NextResponse.json(
      { error: `is tarah ki file allowed nahi (${contentType || "?"})` },
      { status: 415 },
    );
  }

  const ext = extFor(contentType);
  if (!ext) return NextResponse.json({ error: "unknown type" }, { status: 415 });

  let key: string;
  let path: string; // DB me jo jaata hai

  if (kind === "avatar") {
    key = r2Key.avatar(uid);
    path = `${uid}/avatar.jpg`;
  } else {
    if (!storageDbConfigured()) {
      return NextResponse.json({ error: "supabase env missing" }, { status: 503 });
    }
    // Document row pehle se honi chahiye, aur isi user ki.
    if (!(await documentBelongsTo(docId, uid))) {
      return NextResponse.json({ error: "document nahi mila" }, { status: 404 });
    }
    // Naam ek hi jagah se banta hai — `commit` bhi bilkul yahi bulata hai.
    path = `${uid}/${documentFileName(docId, ext, version)}`;
    key = r2Key.documentPath(path);
  }

  try {
    // 5 minute — upload shuru karne ke liye kaafi, aur URL leak ho jaye to
    // uski umar utni hi.
    const url = presignUpload(key, contentType, 300);
    return NextResponse.json({ url, key, path, contentType });
  } catch (err) {
    console.error("[storage/upload-url]", err);
    return NextResponse.json({ error: "presign failed" }, { status: 500 });
  }
}
