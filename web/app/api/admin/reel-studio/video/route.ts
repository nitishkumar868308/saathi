import { createReadStream } from "node:fs";
import { readFileSync, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bani hui reel (aur uski thumbnail) admin ko parosna.
 *
 * ⚠️ **Sirf do folder, aur wo list yahin likhi hai** (`ALLOWED_PREFIXES`).
 * Ye route ek key leta hai aur disk se file deta hai — yaani galti se ye poore
 * computer ka file-reader ban sakta hai. Isliye do taale hain, aur dono chahiye:
 *   1. Key ko `permanent/reels/` ya `permanent/thumbs/` se shuru hona hi hoga.
 *   2. Poora path resolve karke dobara jaancha jaata hai ki wo root ke andar hi
 *      hai — kyunki `..` aur symlink pehle taale se nikal sakte hain.
 * Ek bhi taala hatane par baaki wala akela kaafi nahi hai.
 *
 * ⚠️ **Range** sambhala jaata hai. Iske bina `<video>` chal to jaati hai par
 * seek karte hi ruk jaati hai — aur wo "player toota hua hai" jaisa dikhta hai,
 * jabki galat sirf jawab ka status code hota hai.
 *
 * ⚠️ R2 par ye route file nahi deta, saaf mana kar deta hai. Bucket ka signed
 * URL banana yahan bhi ho sakta tha, par wo studio me pehle se hai — do jagah
 * signing likhne ka matlab hai ek din ek jagah ki expiry badalna aur doosri ka
 * chhoot jaana.
 */

const ALLOWED_PREFIXES = ["permanent/reels/", "permanent/thumbs/"];

/**
 * Monorepo ka root — wahi package.json jisme `workspaces` likha hai.
 *
 * ⚠️ `REEL_OUTPUT_DIR=./render-out` har process ke apne cwd se resolve hota hai.
 * Worker repo root se chalta hai (`d:/my-app/render-out`) par ye Next app
 * `web/` se (`d:/my-app/web/render-out`) — aur wo folder hai hi nahi. Yahi
 * galti `@reel/storage` me pehle pakdi ja chuki hai; wahan bhi ilaaj yahi hai.
 */
function findRepoRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  for (let depth = 0; depth < 12; depth += 1) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        // Toota package.json — ignore karke upar chalte raho.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Local driver ka media root: `<repo>/render-out/media` (storage package jaisa hi). */
function mediaRoot(): string | null {
  const root = findRepoRoot(process.cwd());
  if (!root) return null;
  const outDir = process.env.REEL_OUTPUT_DIR?.trim() || "./render-out";
  return resolve(root, outDir, "media");
}

function bad(reason: string, status = 400): NextResponse {
  return NextResponse.json({ error: reason }, { status });
}

export async function GET(request: Request) {
  const gate = await guard("reelStudio");
  if (!gate.ok) return gate.res;

  const driver = (process.env.REEL_STORAGE_DRIVER ?? "local").trim();
  if (driver !== "local") {
    return bad(`storage driver "${driver}" hai — video studio se hi khulegi`, 501);
  }

  const key = new URL(request.url).searchParams.get("key") ?? "";
  // Taala #1 — sirf ye do folder. Baaki har key yahin ruk jaati hai.
  if (!ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return bad("ye key is route se nahi khulti");
  }
  if (key.includes("\\") || key.split("/").includes("..")) {
    return bad("key me raasta ulta hai");
  }

  const root = mediaRoot();
  if (!root) return bad("repo root nahi mila — REEL_OUTPUT_DIR set karo", 500);

  const path = resolve(root, key);
  // Taala #2 — resolve ke BAAD. `..` aur symlink pehle taale se nikal sakte hain.
  if (path !== root && !path.startsWith(root + sep)) {
    return bad("key root ke bahar jaati hai");
  }

  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile()) return bad("file nahi hai", 404);
    size = info.size;
  } catch {
    return bad("file disk par nahi mili — shayad cleanup le gaya", 404);
  }

  const mime = key.endsWith(".jpg") ? "image/jpeg" : "video/mp4";
  const range = request.headers.get("range");

  if (range) {
    /*
     * "bytes=START-END" — END aksar khaali hota hai (player kehta hai "yahan se
     * aage jo bhi hai"). Ise poora file bhej dena galat nahi lagta par seek bar
     * tab tak kaam nahi karti jab tak 206 na aaye.
     */
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (Number.isFinite(start) && start <= end && start < size) {
        const stream = createReadStream(path, { start, end });
        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            "content-type": mime,
            "content-length": String(end - start + 1),
            "content-range": `bytes ${start}-${end}/${size}`,
            "accept-ranges": "bytes",
            "cache-control": "no-store",
          },
        });
      }
      // Galat range par 416 — warna player poori file dobara maangta rehta hai.
      return new NextResponse(null, {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
  }

  const stream = createReadStream(path);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "content-type": mime,
      "content-length": String(size),
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}
