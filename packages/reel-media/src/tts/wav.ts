/**
 * Kaccha PCM se WAV — **bina ffmpeg ke** (26.19).
 *
 * ⚠️ Ye file ek asli deewar todne ke liye bani. Gemini ki awaaz kaccha PCM hoti
 * hai, aur use WAV banane ke liye pehle ffmpeg chalta tha. Nateeja ye tha ki
 * **Vercel par "Awaaz banao" kabhi kaam kar hi nahi sakta tha** — wahan ffmpeg
 * hota hi nahi. Yaani ek feature jo studio me dikhta tha, deployed studio par
 * hamesha marta.
 *
 * Aur wo deewar zaroori thi hi nahi. WAV koi encoding nahi hai — wo **wahi PCM
 * hai jiske aage 44 byte ka header laga hota hai**. Us header me chaar hi baatein
 * likhi jaati hain: kitne channel, kaunsa rate, kitne bit, kitna data. Uske liye
 * ek poora media toolchain maangna us kaam se bahut bada hai jitna wo kaam hai.
 *
 * ⚠️ **Yahan resampling jaan-boojhkar nahi hoti.** Purana ffmpeg wala raasta
 * 48kHz stereo par le jaata tha (soxr se). Wo JS me "theek se" karna ek chhota
 * DSP likhna hai; "jaise-taise" karna (har sample do baar likh dena) sunai deta
 * hai — halki dhaatu jaisi awaaz. Aur uski zaroorat bhi nahi: WAV har rate par
 * bilkul jaayaz hai, preview use waise hi bajata hai, aur render ke waqt ffmpeg
 * (worker par, jahan wo hai) apne aap sahi rate par le aata hai.
 *
 * Isliye file wahi rate aur channel rakhti hai jo source ne diya — aur us baat
 * ka koi nuksaan kahin nahi hai.
 */

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;

export interface PcmFormat {
  sampleRate: number;
  channels: number;
}

/**
 * PCM (signed 16-bit little-endian) ko WAV bana do.
 *
 * ⚠️ 16-bit LE hi maana jaata hai, aur ye andaaza nahi hai: Gemini ka mime
 * `audio/L16;codec=pcm;rate=24000` khud yahi kehta hai (`L16` = linear 16-bit).
 * Kisi din koi provider kuch aur de to wo mime me dikhega, aur `requirePcmMime`
 * wahin saaf mana kar dega — chup-chaap galat header likhne se behtar.
 */
export function pcmToWav(pcm: Uint8Array, format: PcmFormat): Uint8Array {
  const { sampleRate, channels } = format;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`WAV nahi ban sakti: rate "${sampleRate}" theek nahi hai.`);
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new Error(`WAV nahi ban sakti: channels "${channels}" theek nahi hain.`);
  }

  const bytesPerFrame = (channels * BITS_PER_SAMPLE) / 8;
  const out = new Uint8Array(HEADER_BYTES + pcm.length);
  const view = new DataView(out.buffer);

  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) out[offset + i] = text.charCodeAt(i);
  };

  ascii(0, "RIFF");
  // Poori file ka naap, pehle 8 byte chhod kar — RIFF ka apna niyam.
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");

  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk ka naap (PCM me hamesha 16)
  view.setUint16(20, 1, true); // 1 = PCM, bina kisi compression ke
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true); // byte per second
  view.setUint16(32, bytesPerFrame, true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true);

  ascii(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, HEADER_BYTES);

  return out;
}

/**
 * Awaaz kitni lambi hai — **ginti se, naap se nahi**.
 *
 * ⚠️ Pehle ye ffmpeg se poochha jaata tha. Kaccha PCM me uski zaroorat hi nahi:
 * har second me `rate × channels × 2` byte hote hain, aur ye ganit hamesha theek
 * hai. Ek aur process chalane ka matlab tha ek aur cheez jo kisi machine par na
 * ho — aur wahi hua.
 */
export function pcmDurationSeconds(byteLength: number, format: PcmFormat): number {
  const bytesPerSecond = format.sampleRate * format.channels * (BITS_PER_SAMPLE / 8);
  return bytesPerSecond > 0 ? byteLength / bytesPerSecond : 0;
}
