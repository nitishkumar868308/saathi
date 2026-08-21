import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Bundle ka cache — **fingerprint par, waqt par nahi**.
 *
 * ⚠️ Pehle har render par `bundle()` chalta tha, aur wo jaan-boojhkar tha. Purana
 * bundle chupchaap chalte rehna sabse chidhane wali cheez banta hai: "maine to
 * theek kar diya tha, video me kyun nahi aaya". Wo dar bilkul sahi hai.
 *
 * Par uski keemat naapi gayi: **12.5 second ki reel me 36.4s lage, aur usme se
 * ~13.6s sirf bundling thi** — har baar, chahe ek line bhi na badli ho.
 *
 * Ilaaj "cache kar do" nahi hai — ilaaj ye hai ki cache **sach bole**. Yahan
 * bundle ki chaabi un saari source files se banti hai jo bundle me jaati hain
 * (`@reel/remotion` aur `@reel/core` ka `src/`, aur entry file). Har file ka
 * path + size + mtime hash me jaata hai. Ek line badli → chaabi badli → naya
 * bundle. Kuch na badla → wahi bundle, 0 second me.
 *
 * ⚠️ **`publicDir` chaabi me nahi hai, aur ye zaroori hai.** Har job ka apna
 * publicDir hota hai (assets wahan utarte hain), isliye use chaabi me daalne par
 * cache kabhi lagta hi nahi. Assets bundle me jaate bhi nahi — wo `staticFile()`
 * se **render ke waqt** padhe jaate hain. Isi wajah se ek hi bundle alag-alag
 * assets ke saath chal sakta hai.
 */

/** Jin folders ka code bundle me jaata hai. */
const WATCHED = [
  "packages/reel-remotion/src",
  "packages/reel-core/src",
] as const;

/**
 * Source ka fingerprint — path + size + mtime ka hash.
 *
 * ⚠️ Sirf mtime kaafi nahi (do file ek hi second me badal sakti hain) aur sirf
 * size bhi nahi (ek akshar badalne par size wahi rehta hai). Dono saath me wo
 * har aam badlav pakad lete hain — aur ye poori file padhne se bahut sasta hai.
 */
export function sourceFingerprint(root: string, entryPoint: string): string {
  const hash = createHash("sha1");

  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        walk(full);
        continue;
      }
      // Sirf wahi files jo bundle me ja sakti hain.
      if (!/\.(tsx?|jsx?|css|json)$/.test(name)) continue;
      hash.update(`${full}:${info.size}:${info.mtimeMs}\n`);
    }
  };

  for (const rel of WATCHED) walk(join(root, rel));
  if (existsSync(entryPoint)) {
    const info = statSync(entryPoint);
    hash.update(`${entryPoint}:${info.size}:${info.mtimeMs}\n`);
  }

  return hash.digest("hex");
}

interface CacheEntry {
  fingerprint: string;
  serveUrl: string;
}

let cached: CacheEntry | null = null;

/** Is fingerprint ka bundle pehle se hai? */
export function cachedBundle(fingerprint: string): string | null {
  return cached && cached.fingerprint === fingerprint ? cached.serveUrl : null;
}

export function rememberBundle(fingerprint: string, serveUrl: string): void {
  cached = { fingerprint, serveUrl };
}

/** Test ke liye — aur agar kabhi haath se saaf karna pade. */
export function forgetBundle(): void {
  cached = null;
}
