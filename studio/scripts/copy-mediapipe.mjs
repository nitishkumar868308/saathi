import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * MediaPipe ka WASM `node_modules` se `public/` me le aao.
 *
 * ```
 * npm run copy:mediapipe --workspace @reel/studio
 * ```
 * (`dev` aur `build` dono se apne aap chalta hai.)
 *
 * ⚠️ **CDN se kabhi nahi.** MediaPipe ka aam tarika ye hai ki
 * `FilesetResolver.forVisionTasks()` ko jsdelivr ka URL de do. Wo yahan do wajah
 * se galat hai: is project ka niyam hai ki kuch bahar na jaaye, aur CDN ke band
 * hone par feature chup-chaap mar jaata hai — screen par sirf "kuch nahi hua"
 * dikhta hai, koi error nahi.
 *
 * ⚠️ Ye files **repo me nahi** rakhi jaatin (34MB), aur wo jaan-boojhkar hai.
 * Wo npm package ke andar pehle se hain, yaani `npm ci` ke baad har machine par
 * maujood. Repo me daalne se har clone 34MB bhaari hota — bina kisi faayde ke,
 * kyunki wahi bytes `node_modules` me bhi utar rahe hote hain.
 *
 * ⚠️ Model file (`face_landmarker.task`) is script se **nahi** aati — wo repo me
 * committed hai. Wajah alag hai: wo npm par hai hi nahi, aur use build ke waqt
 * download karne ka matlab hota ki har deploy Google ke ek URL par tika ho.
 */

const here = dirname(fileURLToPath(import.meta.url));
const studio = resolve(here, "..");
const from = resolve(studio, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = resolve(studio, "public", "models", "wasm");

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
console.log(`[copy-mediapipe] WASM copy ho gaya -> ${to}`);
