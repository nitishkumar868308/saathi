/**
 * @reel/media — FFmpeg / ffprobe ke saath baat karne ki ekmatra jagah.
 *
 * Ye code pehle `worker/src/ffmpeg.ts` me tha. Phase 5 me studio ko bhi probe
 * aur thumbnail chahiye the, aur usko worker import nahi karna chahiye (worker
 * ke saath poora Remotion renderer Next ke bundle me ghus jaata). Copy karne se
 * Section 3A ke rules (single encode, lanczos, faststart) do jagah likhe jaate
 * aur ek din alag ho jaate — isliye code yahan aa gaya aur dono ise import
 * karte hain.
 *
 * Node-only hai (`child_process`, `fs`): browser me kabhi import nahi hota.
 */

export * from "./ffmpeg";
export * from "./probe";
export * from "./thumbnails";
