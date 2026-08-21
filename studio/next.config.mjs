import path from "node:path";
import { fileURLToPath } from "node:url";

/** Is file ka apna folder — `studio/`. `@/` isi par tika hai. */
const studioDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Ye workspace packages source TypeScript me rehte hain (koi build step nahi),
  // isliye Next inhe khud compile kare.
  transpilePackages: ["@reel/core", "@reel/media", "@reel/remotion", "@reel/storage"],

  /**
   * `@/` ka rasta yahan **khud** likha hai, jabki tsconfig ke `paths` me bhi
   * wahi likha hai. Ye dohraav jaan-boojhkar hai.
   *
   * Next `@/` sirf tab samajhta hai jab wo `tsconfig.json` ko theek se padh le.
   * Wo padhna kai wajahon se chup-chaap fail ho sakta hai — aur tab har
   * `@/...` import "Module not found" ban jaata hai, jaise file hi na ho.
   * (Neeche ka lamba note dekho: ek baar comments ki wajah se yahi ho chuka hai.)
   *
   * Webpack ka alias us poori nirbharta ko kaat deta hai: tsconfig padhi jaaye
   * ya na jaaye, `@/` ka matlab hamesha `studio/` hi rahega.
   *
   * `"@"` sirf `@` aur `@/...` se milta hai — `@reel/core` ko chhoota nahi.
   */
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@": studioDir };
    return config;
  },
};

export default nextConfig;

/*
 * ⚠️ **`studio/tsconfig.json` me kabhi comment mat likhna — wo saada JSON rehni
 * chahiye.** Ye baat yahan likhi hai kyunki usi file me nahi likhi ja sakti.
 *
 * Ye ek asli, bahut chupi hui gadbad se aayi hai (2026-08-21, Vercel deploy).
 * TypeScript `tsconfig.json` me `//` comments padh leta hai, isliye local par
 * sab theek chalta hai. Par Next ka build jab apne saade `JSON.parse` par girta
 * hai, tab comment wali file **poori** fail ho jaati hai — aur wo chup-chaap
 * fail hoti hai: koi "tsconfig padha nahi ja saka" nahi aata, bas `paths` gayab
 * ho jaate hain. Nateeja screen par aisa dikhta hai:
 *
 *     Module not found: Can't resolve '@/lib/api'
 *
 * ...yaani aisa lagta hai jaise file hi missing ho. Ghanton us file ko dhoondte
 * raho, jabki wo apni jagah maujood hai.
 *
 * Pehchan ka tarika: agar **sirf `@/...` toot rahe hain aur `@reel/...` theek
 * hain**, to samajh lo tsconfig padha hi nahi gaya — kyunki `@reel/*` package
 * `node_modules` se aate hain (tsconfig se nahi), aur `@/` sirf tsconfig ke
 * `paths` se aata hai.
 *
 * ⚠️ Isi wajah se `tsconfig.json` `extends` bhi nahi karti. Pehle wo
 * `../tsconfig.base.json` uthati thi — repo ke andar theek, par deploy par ek
 * aur chhupi hui nirbharta. Ab studio ki build apne folder ke bahar sirf
 * `packages/` maangti hai, aur wo npm workspaces se link ho jaate hain.
 */
