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

// fs chahiye, isliye edge nahi. Aur har request par taaza — media cache karke
// baasi dena yahan sabse chidhane wali baat hoti.
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

  const headers = new Headers({
    "content-type": mimeFromKey(resolved.key),
    "content-length": String(size),
    "cache-control": "no-store",
  });

  const downloadName = new URL(request.url).searchParams.get("download");
  if (downloadName) {
    headers.set(
      "content-disposition",
      `attachment; filename="${downloadName.replace(/["\\\r\n]/g, "")}"`,
    );
  }

  // Stream — 200MB ka video poora memory me kheenchne ka koi matlab nahi.
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
