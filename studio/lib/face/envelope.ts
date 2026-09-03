"use client";

import { ENVELOPE_PER_SECOND, rmsEnvelope, toMono } from "@reel/core";

/**
 * Awaaz ki takat waqt ke saath — **browser me** (bolti tasveer).
 *
 * ⚠️ Yahan sirf teen kaam hain: file utaarna, `decodeAudioData` se saade number
 * nikaalna, aur `@reel/core` ko de dena. Poora hisaab wahan hai, jahan use ek
 * script se jaancha ja sakta hai bina koi awaaz banaye.
 *
 * ⚠️ Ye server par nahi chalta, aur wo jaan-boojhkar hai — wahi wajah jo
 * `detect.ts` ki hai: studio Vercel par bhi chalti hai, GitHub ke render minute
 * bachte hain, aur awaaz kabhi kisi bahari jagah nahi jaati.
 */

export interface AudioEnvelope {
  /** 0-1, barabar doori par. */
  values: number[];
  durationSeconds: number;
}

/**
 * `OfflineAudioContext`, `AudioContext` nahi.
 *
 * ⚠️ Aam `AudioContext` speaker se juda hota hai, aur browser use bina user ke
 * chhue "suspended" par rakhte hain — console me har baar ek chetavni, aur kuch
 * browser me decode bhi ruk jaata hai. Yahan bajana hai hi nahi, sirf naapna hai.
 */
function context(): OfflineAudioContext {
  return new OfflineAudioContext(1, 1, 44100);
}

export async function audioEnvelope(
  url: string,
  perSecond: number = ENVELOPE_PER_SECOND,
): Promise<AudioEnvelope | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();
    const buffer = await context().decodeAudioData(bytes);

    const channels: Float32Array[] = [];
    for (let at = 0; at < buffer.numberOfChannels; at += 1) {
      channels.push(buffer.getChannelData(at));
    }

    /*
     * ⚠️ Saare channel mila kar, sirf pehla nahi. Kai recording me ek channel
     * dheema ya bilkul khaali hota hai — us halat me sirf pehla lene par poori
     * awaaz "chup" ginn'ti hai aur muh kabhi khulta hi nahi.
     */
    const mono = toMono(channels);

    return {
      values: rmsEnvelope({ samples: mono, sampleRate: buffer.sampleRate, perSecond }),
      durationSeconds: buffer.duration,
    };
  } catch {
    /*
     * ⚠️ `null`, koi aadha-adhoora envelope nahi. Bina awaaz ke bhi track ban
     * sakta hai (poori lambai ko bolna maan kar), par wo chunav bulane wale ka
     * hona chahiye — yahan chup-chaap ek jhootha envelope lauta dena us halat ko
     * chhupa deta hai jahan awaaz sach me utri hi nahi.
     */
    return null;
  }
}
