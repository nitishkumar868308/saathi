/**
 * Storage key layout — ek hi jagah se banti hain, haath se kabhi nahi.
 *
 * ```
 * permanent/assets/<assetId>.<ext>      user ka upload — uski marzi ke bina kabhi delete nahi
 * permanent/reels/<jobId>.mp4           final render
 * permanent/thumbs/<jobId>.jpg          render ka thumbnail
 * temp/tts/<id>.wav                     TTS ki awaaz (Phase 22)
 * temp/render/<jobId>/<name>            render ke beech ka maal
 * temp/probe/<id>.<ext>                 ffprobe ke liye utara hua tukda
 * ```
 *
 * `permanent/` banaam `temp/` ka bantwara hi cleanup ko likhne layak banata hai:
 * script sirf `temp/` ko chhoo sakti hai, isliye "kahin kisi ki asli file to
 * nahi mit rahi" wala dar hi khatam ho jaata hai (Phase 20).
 *
 * Ye file pure TypeScript hai — koi fs, koi path module. Local driver aur R2
 * driver dono yahi keys istemal karte hain, isliye driver badalne par DB me
 * rakhi keys waisi ki waisi chalti rehti hain.
 */

export const KEY_PREFIX = {
  permanentAssets: "permanent/assets",
  permanentReels: "permanent/reels",
  permanentThumbs: "permanent/thumbs",
  tempTts: "temp/tts",
  tempRender: "temp/render",
  tempProbe: "temp/probe",
} as const;

/** Key ki upper limit — S3/R2 ki apni chhat 1024 bytes hai. */
export const MAX_KEY_LENGTH = 512;

export class InvalidStorageKey extends Error {
  constructor(key: string, reason: string) {
    super(`Storage key "${key}" theek nahi: ${reason}`);
    this.name = "InvalidStorageKey";
  }
}

/**
 * Key ko jaancho.
 *
 * ⚠️ Ye sirf safai nahi hai — **security boundary** hai. Local driver ye keys
 * seedha disk path banane me lagata hai aur studio ka `/api/local-media/[...key]`
 * unhe URL se leta hai. Ek `..` chhoot jaaye aur koi bhi file padhi ja sakti hai.
 * Isliye whitelist chalti hai (kya allowed hai), blacklist nahi (kya mana hai).
 */
export function assertValidKey(key: string): void {
  if (!key) throw new InvalidStorageKey(key, "khaali hai");
  if (key.length > MAX_KEY_LENGTH) {
    throw new InvalidStorageKey(key, `${MAX_KEY_LENGTH} akshar se lamba hai`);
  }
  if (key.startsWith("/") || key.endsWith("/")) {
    throw new InvalidStorageKey(key, "slash se shuru ya khatam nahi ho sakti");
  }
  if (key.includes("\\")) throw new InvalidStorageKey(key, "backslash allowed nahi");
  if (key.includes("//")) throw new InvalidStorageKey(key, "khaali hissa (//) hai");

  for (const segment of key.split("/")) {
    if (segment === "." || segment === "..") {
      throw new InvalidStorageKey(key, `"${segment}" se path traversal ho sakta hai`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
      throw new InvalidStorageKey(
        key,
        `"${segment}" me sirf A-Z a-z 0-9 . _ - chal sakte hain`,
      );
    }
  }
}

export function isValidKey(key: string): boolean {
  try {
    assertValidKey(key);
    return true;
  } catch {
    return false;
  }
}

/** Filename se saaf extension. Dot ke bina, lowercase, bina extension par null. */
export function extensionOf(filename: string): string | null {
  const at = filename.lastIndexOf(".");
  if (at <= 0 || at === filename.length - 1) return null;
  const ext = filename.slice(at + 1).toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(ext) ? ext : null;
}

function join(prefix: string, name: string): string {
  const key = `${prefix}/${name}`;
  assertValidKey(key);
  return key;
}

/**
 * Keys banane ka ekmatra raasta.
 *
 * Har jagah string jodne se hi wo galti hoti hai jisme upload ek key par jaata
 * hai aur DB me doosri likhi jaati hai — file "kho jaati" hai jabki wo bucket me
 * baithi hoti hai.
 */
export const storageKey = {
  asset: (assetId: string, ext: string | null): string =>
    join(KEY_PREFIX.permanentAssets, ext ? `${assetId}.${ext}` : assetId),

  reel: (jobId: string): string => join(KEY_PREFIX.permanentReels, `${jobId}.mp4`),

  thumbnail: (jobId: string): string => join(KEY_PREFIX.permanentThumbs, `${jobId}.jpg`),

  tts: (id: string): string => join(KEY_PREFIX.tempTts, `${id}.wav`),

  renderScratch: (jobId: string, name: string): string =>
    join(`${KEY_PREFIX.tempRender}/${jobId}`, name),

  probe: (id: string, ext: string): string => join(KEY_PREFIX.tempProbe, `${id}.${ext}`),
};

/** `temp/` me hai? Cleanup sirf inhe chhoo sakta hai. */
export function isTemporaryKey(key: string): boolean {
  return key.startsWith("temp/");
}

export function isPermanentKey(key: string): boolean {
  return key.startsWith("permanent/");
}
