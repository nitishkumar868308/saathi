import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";

import { mimeFromKey, localMediaRoot, readStorageConfig, resolveLocalMediaPath } from "@reel/storage";

/**
 * Local storage driver ka "signed URL" — yahi wo route hai.
 *
 * R2 par browser seedha bucket se baat karta hai (presigned URL). Local driver
 * ke paas aisa kuch nahi hai, isliye files studio ke through parosi jaati hain.
 *
 * ⚠️ TEEN DEEWAAREIN, aur teeno zaroori hain:
 *  1. Production build me ye route sirf 404 deta hai. Local driver dev ke liye
 *     hai; hosted studio par disk se file parosna galat hi hoga.
 *  2. `REEL_STORAGE_DRIVER` local na ho to bhi 404 — warna R2 mode me bhi ek
 *     khula file-reader ghoomta rehta.
 *  3. Key `resolveLocalMediaPath` se guzarti hai, jo `..` / backslash / root ke
 *     bahar jaane wala har path rok deta hai. Wahi function driver bhi use karta
 *     hai, isliye dono jagah ki safety kabhi alag nahi ho sakti.
 */

/*
 * fs chahiye, isliye edge nahi.
 *
 * ⚠️ `force-dynamic` **Next ke apne cache** ke liye hai (route ka jawab build par
 * jam na jaaye). Browser ka cache alag baat hai aur wo neeche har key ke hisaab se
 * tay hota hai — jis key ka maal kabhi badalta hi nahi (upload ki hui file), use
 * cache karna hi sahi hai. Dono ko ek samajh kar yahan `no-store` thop dena hi wo
 * galti thi jiski wajah se preview me har video har baar dobara utarti thi.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { key: string[] };
}

function guard(): { ok: true; root: string } | { ok: false; response: Response } {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, response: notFound("local-media route sirf dev me chalta hai") };
  }
  const config = readStorageConfig();
  if (config.driver !== "local") {
    return {
      ok: false,
      response: notFound(`REEL_STORAGE_DRIVER "${config.driver}" hai, local nahi`),
    };
  }
  return { ok: true, root: localMediaRoot(config.local) };
}

function notFound(reason: string): Response {
  return Response.json({ error: "not found", reason }, { status: 404 });
}

function resolveOr400(
  root: string,
  segments: readonly string[],
): { ok: true; path: string; key: string } | { ok: false; response: Response } {
  const key = segments.join("/");
  try {
    return { ok: true, path: resolveLocalMediaPath(root, key), key };
  } catch (error) {
    return {
      ok: false,
      response: Response.json(
        { error: "bad key", reason: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      ),
    };
  }
}

/**
 * Ek key ka maal kabhi badalta hai ya nahi.
 *
 * ⚠️ Ye caching ka faisla hai, aur wo key ke layout par tika hai:
 * `permanent/assets/<assetId>.<ext>` me assetId har upload par nayi banti hai,
 * aur usi id par doosri file kabhi nahi likhi jaati (duplicate par purani hi id
 * lauta di jaati hai). Yahi baat `temp/tts/<id>` aur `permanent/thumbs/<jobId>`
 * ki hai. Yaani in keys ka jawab hamesha wahi rahega — inhe cache karna
 * surakshit hai.
 *
 * `temp/render/<jobId>/…` iske bahar hai: ek hi job dobara chal sakti hai aur
 * wahi naam dobara likha ja sakta hai. Wahan purana jawab dena galat hoga.
 */
function immutableKey(key: string): boolean {
  return (
    key.startsWith("permanent/assets/") ||
    key.startsWith("permanent/thumbs/") ||
    key.startsWith("permanent/reels/") ||
    key.startsWith("temp/tts/")
  );
}

/**
 * `Range: bytes=…` ko padho.
 *
 * ⚠️ Sirf ek hi range chalti hai (`bytes=start-end`) — multipart wali shakl
 * yahan jaan-boojhkar nahi hai. Media element kabhi multipart nahi maangte, aur
 * uska jawab banane ka matlab ek aisa raasta likhna hota jo kabhi chala hi nahi,
 * yaani kabhi jaancha bhi nahi gaya.
 *
 * `null` = header hai hi nahi (poori file bhejo). `"invalid"` = header hai par
 * samajh nahi aaya — wahan 416 dena hi sahi hai, chup-chaap poori file dena
 * nahi: player ko lagta hai ki uska seek maan liya gaya aur wo galat waqt par
 * frame dikhata hai.
 */
function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const [, rawStart, rawEnd] = match;

  // "bytes=-500" — aakhri 500 bytes.
  if (rawStart === "") {
    if (rawEnd === "") return "invalid";
    const length = Number(rawEnd);
    if (length <= 0) return "invalid";
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const gate = guard();
  if (!gate.ok) return gate.response;

  const resolved = resolveOr400(gate.root, context.params.key);
  if (!resolved.ok) return resolved.response;

  let size: number;
  try {
    const info = await stat(resolved.path);
    if (!info.isFile()) return notFound("file nahi hai");
    size = info.size;
  } catch {
    return notFound(`disk par "${resolved.key}" nahi mili`);
  }

  /*
   * ⚠️ **`accept-ranges` aur cache — dono video ke "atak kar chalne" ka ilaaj
   * hain** (26.24).
   *
   * Pehle yahan `cache-control: no-store` tha aur range ka koi jawab nahi. Uska
   * nateeja preview me saaf dikhta tha: har baar jab video wala scene aata,
   * player ruk jaata aur video der se shuru hoti. Do wajah thi, aur dono yahan
   * thi —
   *
   *  1. Range ke bina browser file ke beech se padh hi nahi sakta. Har seek par
   *     (aur har baar scene par lautne par) wo **poori file shuru se** utaarta
   *     hai. 40MB ki recording par wo har baar ka intezaar hai.
   *  2. `no-store` ka matlab hai ki utari hui file rakhi bhi nahi jaati — yaani
   *     wahi kaam har baar dobara.
   *
   * Key ka jawab kabhi badalta nahi (dekho `immutableKey`), isliye use lambe waqt
   * ke liye cache karna surakshit hai — aur wo bilkul wahi cheez hai jo preview ko
   * doosri baar smooth banati hai.
   */
  const headers = new Headers({
    "content-type": mimeFromKey(resolved.key),
    "accept-ranges": "bytes",
    "cache-control": immutableKey(resolved.key)
      ? "private, max-age=31536000, immutable"
      : "no-store",
  });

  const downloadName = new URL(request.url).searchParams.get("download");
  if (downloadName) {
    headers.set(
      "content-disposition",
      `attachment; filename="${downloadName.replace(/["\\\r\n]/g, "")}"`,
    );
  }

  const range = parseRange(request.headers.get("range"), size);

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { "content-range": `bytes */${size}`, "accept-ranges": "bytes" },
    });
  }

  // Stream — 200MB ka video poora memory me kheenchne ka koi matlab nahi.
  if (range) {
    headers.set("content-length", String(range.end - range.start + 1));
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    const partial = Readable.toWeb(
      createReadStream(resolved.path, { start: range.start, end: range.end }),
    ) as ReadableStream<Uint8Array>;
    return new Response(partial, { status: 206, headers });
  }

  headers.set("content-length", String(size));
  const stream = Readable.toWeb(createReadStream(resolved.path)) as ReadableStream<Uint8Array>;
  return new Response(stream, { headers });
}

/** Local driver ka `putSigned()` isi par PUT karta hai. */
export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const gate = guard();
  if (!gate.ok) return gate.response;

  const resolved = resolveOr400(gate.root, context.params.key);
  if (!resolved.ok) return resolved.response;

  const bytes = new Uint8Array(await request.arrayBuffer());
  await mkdir(dirname(resolved.path), { recursive: true });
  await writeFile(resolved.path, bytes);

  return Response.json({ ok: true, key: resolved.key, bytes: bytes.length }, { status: 201 });
}

export async function HEAD(_request: Request, context: RouteContext): Promise<Response> {
  const gate = guard();
  if (!gate.ok) return new Response(null, { status: 404 });

  const resolved = resolveOr400(gate.root, context.params.key);
  if (!resolved.ok) return new Response(null, { status: 400 });

  try {
    const info = await stat(resolved.path);
    if (!info.isFile()) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 200,
      headers: {
        "content-type": mimeFromKey(resolved.key),
        "content-length": String(info.size),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
