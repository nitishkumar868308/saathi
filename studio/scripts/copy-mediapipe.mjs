import { createRequire } from "node:module";
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * MediaPipe ka WASM `node_modules` se `public/` me le aao.
 *
 * ```
 * npm run copy:mediapipe --workspace @reel/studio
 * ```
 * (`dev` aur `build` dono se apne aap chalta hai — yaani Vercel par bhi.)
 *
 * ⚠️ **CDN se kabhi nahi.** MediaPipe ka aam tarika ye hai ki
 * `FilesetResolver.forVisionTasks()` ko jsdelivr ka URL de do. Wo yahan do wajah
 * se galat hai: is project ka niyam hai ki kuch bahar na jaaye, aur CDN ke band
 * hone par feature chup-chaap mar jaata hai — screen par sirf "kuch nahi hua"
 * dikhta hai, koi error nahi.
 *
 * ⚠️ Ye files **repo me nahi** rakhi jaatin (34MB), aur wo jaan-boojhkar hai. Wo
 * npm package ke andar pehle se hain, yaani `npm ci` ke baad har machine par —
 * tumhare PC par bhi aur Vercel ke build par bhi. Repo me daalne se har clone
 * 34MB bhaari hota, bina kisi faayde ke.
 *
 * ⚠️ Model file (`face_landmarker.task`) is script se **nahi** aati — wo repo me
 * committed hai. Wajah alag hai: wo npm par hai hi nahi, aur use build ke waqt
 * download karne ka matlab hota ki har deploy Google ke ek URL par tika ho.
 */

const here = dirname(fileURLToPath(import.meta.url));
const studio = resolve(here, "..");
const to = resolve(studio, "public", "models", "wasm");

/**
 * Package kahan pada hai — **`require.resolve` se, haath ke raaste se nahi**.
 *
 * ⚠️ Pehle yahan seedha `../node_modules/@mediapipe/...` likha tha, aur wo ek
 * chhupi hui gadbad thi: npm workspaces package ko kabhi root ke `node_modules`
 * me rakhta hai aur kabhi `studio/node_modules` me (nirbhar karta hai ki kaunsi
 * doosri dependency kya maangti hai). Ek raasta maan lene par wo is machine par
 * chalta aur Vercel ke build par "nahi mila" bolta — aur wo galti sirf deploy ke
 * baad dikhti.
 */
const require = createRequire(import.meta.url);
/*
 * ⚠️ `package.json` se nahi — wo package apne `exports` me use kholta hi nahi
 * (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Par WASM ki file wo khud kholta hai, aur
 * uske folder se poora raasta mil jaata hai. Yaani hum package ke apne bataye
 * hue raaste par chal rahe hain, apne andaaze par nahi.
 */
const from = dirname(require.resolve("@mediapipe/tasks-vision/vision_wasm_internal.js"));

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(from))) {
  /*
   * ⚠️ Yahan saaf mana, chup-chaap nikal jaana nahi. Bina WASM ke "Bolti Tasveer"
   * wala tab khulta to hai par chehra kabhi nahi milta — aur us halat me galti
   * MediaPipe ke andar se aati hai, jahan se wajah dhoondhna bahut mushkil hai.
   */
  console.error(`[copy-mediapipe] ${from} nahi mila — pehle "npm ci" chalao.`);
  process.exit(1);
}

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });

/*
 * ⚠️ Copy ke baad jaanch, sirf "cp chal gaya" par bharosa nahi. `cp` khaali
 * folder par bhi khushi se poora ho jaata hai, aur tab galti browser me hi
 * dikhti hai — jahan se wajah tak pahunchna sabse mushkil hai.
 */
const needed = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];
for (const file of needed) {
  if (!(await exists(resolve(to, file)))) {
    console.error(`[copy-mediapipe] copy ke baad bhi ${file} nahi mila — kuch galat hai.`);
    process.exit(1);
  }
}

console.log(`[copy-mediapipe] WASM taiyaar -> ${to}`);
