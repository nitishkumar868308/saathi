import type { Item, Track } from "@reel/core";

/**
 * Audio volume — fades ke saath.
 *
 * Fade sirf sundarta ke liye nahi hai: clip ke shuru/ant me awaaz ko ek jhatke
 * se on/off karne par "click" ki aawaz aati hai, jo speaker par saaf sunai deti
 * hai. Poori audio depth (curves, ducking) Phase 15 me hai; ye utna hi hai jitna
 * pehli MP4 ko sun-ne layak banane ke liye chahiye.
 *
 * Track ka mute item ke upar chalta hai — wahi har editor karta hai.
 */
export function itemVolume(item: Item, track: Track): number | ((frame: number) => number) {
  if (item.audio.muted || track.muted) return 0;

  const base = item.audio.volume;
  const { fadeInFrames, fadeOutFrames } = item.audio;
  if (fadeInFrames <= 0 && fadeOutFrames <= 0) return base;

  const duration = item.durationInFrames;
  return (frame: number): number => {
    let gain = base;
    if (fadeInFrames > 0 && frame < fadeInFrames) {
      gain *= frame / fadeInFrames;
    }
    if (fadeOutFrames > 0 && frame > duration - fadeOutFrames) {
      gain *= Math.max(0, (duration - frame) / fadeOutFrames);
    }
    return Math.max(0, gain);
  };
}
