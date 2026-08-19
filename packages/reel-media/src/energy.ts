import { ffmpegPath, run } from "./ffmpeg";

/**
 * Audio ki energy, thode-thode window me (24.7).
 *
 * ⚠️ Ye beat detection **nahi** hai — ye uska kachcha maal hai. Yahan sirf naap
 * hoti hai (kis waqt awaaz kitni tez thi); usme se beat nikalna pure ganit hai
 * aur wo `@reel/core` me hai (`detectBeats`). Do hisse alag isliye hain ki ganit
 * ko test karne ke liye har baar ffmpeg chalana na pade.
 *
 * ⚠️ Koi model, koi download, koi library nahi — sirf ffmpeg ka `astats`. Beat
 * detection ke liye Python libraries (librosa/aubio) behtar hain, par unka
 * matlab hai ek aur install jo user ko karna padega, aur ek aur cheez jo kisi
 * din toot sakti hai. Energy-flux wala tarika 80% kaam kar deta hai — aur music
 * ke beat par cut lagane ke liye 80% kaafi hai.
 */

export interface EnergyWindow {
  timeSeconds: number;
  /** dBFS — chuppi ke liye bahut neeche (jaise -91). */
  db: number;
}

/**
 * Har window ki RMS energy.
 *
 * `windowSeconds` 0.02–0.05 ke beech rakhna theek hai. Bahut chhota rakhne par
 * har chhoti si hilchal beat lagne lagti hai; bahut bada rakhne par do paas-paas
 * beat ek me mil jaate hain.
 */
export async function audioEnergy(
  audioPath: string,
  options: { windowSeconds?: number; sampleRate?: number } = {},
): Promise<EnergyWindow[]> {
  const windowSeconds = options.windowSeconds ?? 0.025;
  const sampleRate = options.sampleRate ?? 48000;
  const samples = Math.max(64, Math.round(windowSeconds * sampleRate));

  /*
   * ⚠️ `asetnsamples` zaroori hai. `astats` ka `reset=1` "har audio frame ke
   * baad" reset karta hai, aur frame ka size decoder tay karta hai — mp3 me
   * 1152, wav me 1024, opus me kuch aur. Uspar bharosa karne par window ka
   * size file ke hisaab se badalta rehta aur beat ka waqt har format me thoda
   * alag nikalta.
   */
  const filter = [
    `aresample=${sampleRate}`,
    `asetnsamples=n=${samples}:p=0`,
    "astats=metadata=1:reset=1",
    "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
  ].join(",");

  // `-f null -` — bina output ke ffmpeg exit 1 deta hai, chahe file theek ho.
  const { stdout } = await run(ffmpegPath(), [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    audioPath,
    "-af",
    filter,
    "-f",
    "null",
    "-",
  ]);

  const out: EnergyWindow[] = [];
  let at = 0;

  for (const line of stdout.split(/\r?\n/)) {
    const time = /pts_time:([\d.]+)/.exec(line);
    if (time) {
      at = Number(time[1]);
      continue;
    }
    const value = /RMS_level=(-?[\d.]+|-inf)/.exec(line);
    if (value) {
      // Poori chuppi par ffmpeg `-inf` deta hai — usse ganit me le jaana har
      // hisaab ko NaN bana deta hai.
      const raw = value[1] as string;
      out.push({ timeSeconds: at, db: raw === "-inf" ? -120 : Number(raw) });
    }
  }

  return out;
}
