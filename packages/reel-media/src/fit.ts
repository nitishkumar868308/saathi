import { existsSync } from "node:fs";

import type { FitPlan } from "@reel/core";

import { ffmpegPath, run } from "./ffmpeg";

/**
 * Tasveer/video ko frame ke naap par kaat kar ek nayi file banana (26.25).
 *
 * ⚠️ Yahan **koi faisla nahi hota**. Kya banana hai — kitna bada, cover ya
 * contain, kinare dhundhle ya nahi — wo poora hisaab `@reel/core` ke `planFit()`
 * me hai. Yahan sirf us plan ko ffmpeg ki zubaan me likha jaata hai. Faisla wahan
 * hone ki wajah seedhi hai: wahi hisaab UI ko bhi chahiye (chetavni dikhane ke
 * liye, file banne se pehle), aur do jagah likhne par wo ek din alag ho jaate
 * hain.
 *
 * ⚠️ **Lanczos** — Section 3A ka scaling rule, yahan bhi. ffmpeg ka default
 * (bicubic) chhoti tasveer ko phailane par narm kar deta hai, aur wo narmi thumb
 * me nahi dikhti — sirf poore frame par dikhti hai, yaani reel ban jaane ke baad.
 *
 * ⚠️ Video ka fit ek **dobara encode** hai, aur ye Section 3A ke "single encode"
 * niyam ka jaan-boojhkar liya gaya apwaad hai. Kaatne aur naap badalne ka koi
 * aisa raasta hai hi nahi jisme dobara encode na ho. Isliye do cheezein bandhi
 * gayi hain: CRF 18 (aankh se farak pakadna mushkil) aur ye ki asli file kabhi
 * mitti nahi — fit hatate hi wo wapas lag jaati hai.
 */

const QUIET = ["-hide_banner", "-loglevel", "error", "-y"] as const;

/**
 * `cover` ka filter — bada karke frame bhar do, phir kinare kaat do.
 *
 * `force_original_aspect_ratio=increase` ke baad `crop` — dono ek saath zaroori
 * hain. Sirf `scale=W:H` likhne par aspect toot jaata hai aur chehre khinche hue
 * lagte hain; wo galti frame me dikhti to hai par wajah kabhi samajh nahi aati.
 */
function coverFilter(width: number, height: number): string {
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${width}:${height}`
  );
}

/**
 * `contain` ka filter — poori tasveer beech me, kinare uski hi dhundhli copy se.
 *
 * ⚠️ Kinare kaale nahi chhode jaate, aur ye farak asli hai. Kaali patti reel me
 * "galat file lag gayi" jaisi dikhti hai; usi tasveer ka dhundhla roop peeche
 * hone par frame bhara hua aur jaan-boojhkar bana hua lagta hai. Yahi tarika
 * render me `blurred-asset` background pehle se lagata hai — file me bhi wahi
 * hona chahiye, warna fit ki hui aur bina fit wali reel do alag dikhengi.
 *
 * ⚠️ `overlay` me `(main_w-overlay_w)/2` likha hai, `(W-w)/2` nahi. `W`/`H`
 * ffmpeg ke apne naam hain aur upar wale filters me bhi maujood hote hain —
 * dono jagah ek jaisa dikhne wala expression alag matlab rakhta hai.
 */
function containFilter(width: number, height: number): string {
  // Sigma frame ki chaudai ke hisaab se — 1080 par ~20, taaki har naap par ek jaisa lage.
  const sigma = Math.max(8, Math.round(width / 54));
  return (
    `[0:v]split=2[bg][fg];` +
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${width}:${height},gblur=sigma=${sigma}[bgb];` +
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos[fgs];` +
    `[bgb][fgs]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2`
  );
}

export interface FitImageArgs {
  input: string;
  /** `.jpg` — neeche wajah likhi hai. */
  output: string;
  plan: FitPlan;
}

/**
 * Tasveer ko fit karo.
 *
 * ⚠️ Nateeja JPEG hai, PNG nahi. Reel me ye tasveer **background** hai — frame
 * poora bhara hua hai (contain par bhi, dhundhli copy se), isliye transparency ka
 * koi kaam hi nahi bachta. 1080x1920 ka PNG 5-6 MB ka hota hai aur wahi JPEG
 * q=2 par ~300 KB — wo farak har scene par lagta hai, aur R2 se utaarne ke waqt
 * par bhi.
 */
export async function fitImage(args: FitImageArgs): Promise<void> {
  const { width, height } = args.plan.target;
  const filter = args.plan.mode === "cover" ? coverFilter(width, height) : containFilter(width, height);

  await run(ffmpegPath(), [
    ...QUIET,
    "-i",
    args.input,
    args.plan.mode === "cover" ? "-vf" : "-filter_complex",
    filter,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    args.output,
  ]);

  if (!existsSync(args.output)) {
    throw new Error("ffmpeg chala par fit ki hui tasveer nahi bani.");
  }
}

export interface FitVideoArgs {
  input: string;
  /** `.mp4`. */
  output: string;
  plan: FitPlan;
  /** Video ka chuna hua hissa — `null` = poori file. */
  trim?: { startSeconds: number; endSeconds: number } | null;
}

/**
 * Video ko fit karo — aur chuna hua hissa **isi me** kaat do.
 *
 * ⚠️ Trim yahin lagta hai, baad me nahi. Poori do minute ki recording ko frame ke
 * naap par encode karke phir usme se 4 second lena matlab wo poora encode bekaar
 * gaya — 2 minute ka kaam 4 second ke liye. Yahan `-ss`/`-to` input se pehle
 * lagte hain, isliye ffmpeg baaki file decode hi nahi karta.
 */
export async function fitVideo(args: FitVideoArgs): Promise<void> {
  const { width, height } = args.plan.target;
  const filter = args.plan.mode === "cover" ? coverFilter(width, height) : containFilter(width, height);

  const seek: string[] = [];
  if (args.trim) {
    const start = Math.max(0, args.trim.startSeconds);
    const end = Math.max(start + 0.1, args.trim.endSeconds);
    seek.push("-ss", start.toFixed(3), "-to", end.toFixed(3));
  }

  await run(ffmpegPath(), [
    ...QUIET,
    ...seek,
    "-i",
    args.input,
    args.plan.mode === "cover" ? "-vf" : "-filter_complex",
    filter,
    "-c:v",
    "libx264",
    /*
     * CRF 18 — is dobara encode ki poori keemat yahi ek number hai. Isse upar
     * (23 jaisa aam default) par kinare aur halki chaal wale hisse me farak aankh
     * se dikhne lagta hai, aur wo farak reel ban jaane ke baad hi pakda jaata hai.
     */
    "-crf",
    "18",
    "-preset",
    "medium",
    /*
     * ⚠️ `yuv420p` — bina iske kuch phone aur browser video kholte hi nahi
     * (khaas kar screen recording, jo aksar yuv444p hoti hai). Wo file yahan
     * bilkul theek chalti hai aur user ke phone par kaali rehti hai.
     */
    "-pix_fmt",
    "yuv420p",
    /*
     * Awaaz jaisi hai waisi. Video ka apna sound aksar chahiye nahi hota (reel ki
     * awaaz alag banti hai), par use yahan girana galat hoga — wo faisla timeline
     * par hota hai aur wapas bhi ho jaata hai. File se hata dene par wapas laane
     * ka koi raasta hi nahi bachta.
     */
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    args.output,
  ]);

  if (!existsSync(args.output)) {
    throw new Error("ffmpeg chala par fit ki hui video nahi bani.");
  }
}
