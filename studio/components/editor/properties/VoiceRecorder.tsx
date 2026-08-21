"use client";

import clsx from "clsx";
import { AlertTriangle, Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AudioPreview } from "@/components/media/AudioPreview";
import { useUploader } from "@/lib/upload/uploader";

/**
 * Browser me apni awaaz record karo (22.13).
 *
 * ⚠️ Recording **aam upload ban kar** jaati hai — wahi `useUploader`, wahi
 * presign → PUT → complete, wahi `permanent` lifecycle. Iska matlab hai ki
 * dedup (checksum), probe, thumbnail (waveform) aur cleanup — sab apne aap
 * mil jaate hain. Recording ke liye alag raasta banane par un me se har cheez
 * dobara likhni padti, aur ek din unme se koi ek chhoot jaati.
 *
 * ⚠️ TTS ki awaaz `temporary` hoti hai (cleanup use utha sakta hai), par
 * recording **`permanent`** hai — kyunki wo user ki apni cheez hai. Usse
 * "generated maal" ke saath rakh dena ek din kisi ki asli recording mita
 * dega, aur wo wapas nahi aayegi.
 *
 * ⚠️ Mic ki ijazat **dabane par** maangi jaati hai, page khulte hi nahi. Bina
 * wajah permission ka popup dikhana sabse jaldi "block" karwata hai, aur ek
 * baar block hone par user ko wo settings me jaakar kholna padta hai.
 */

/** Kis format me record karein — jo browser sach me de sake. */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function extensionFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function VoiceRecorder({
  onRecorded,
}: {
  /** Recording upload ho gayi — uska asset id. */
  onRecorded(assetId: string): void;
}) {
  const [supported] = useState(() => pickMimeType());
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastAssetId, setLastAssetId] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const uploader = useUploader({
    tags: ["voice"],
    onFinished: (result) => {
      setLastAssetId(result.assetId);
      onRecorded(result.assetId);
    },
  });

  /*
   * Mic ka stream har haal me band hona chahiye — component hat jaaye tab bhi.
   * Warna browser ke tab par recording ka laal nishaan jalta rehta hai aur user
   * ko lagta hai ki app chup-chaap sun raha hai.
   */
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!supported) {
    return (
      <p className="flex items-start gap-1 text-[10px] leading-snug text-chalk-500">
        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
        Ye browser recording nahi kar sakta (MediaRecorder nahi hai). Apni file{" "}
        <strong>Upload</strong> se laga do.
      </p>
    );
  }

  async function start(): Promise<void> {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        // Ye teeno browser ka apna kaam hai aur recording ko saaf rakhte hain;
        // hamara `cleanup` (22.7) uske baad bhi lagta hai.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = media;
      chunks.current = [];

      const rec = new MediaRecorder(media, { mimeType: supported as string });
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: supported as string });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `recording-${stamp}.${extensionFor(supported as string)}`, {
          type: supported as string,
        });
        // Yahan se aage wahi raasta jo har upload ka hai.
        uploader.addFiles([file]);
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
      };

      recorder.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch (cause: unknown) {
      /*
       * Sabse aam wajah "mic ki ijazat nahi mili" hoti hai, aur browser ka apna
       * message (`NotAllowedError`) us baat ko bilkul nahi samjhata.
       */
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /denied|NotAllowed/i.test(message)
          ? "Mic ki ijazat nahi mili. Browser ke address bar me mic ka nishaan dabao aur allow karo."
          : `Mic nahi khul paaya: ${message}`,
      );
    }
  }

  function stop(): void {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  const busy = uploader.busy;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => (recording ? stop() : void start())}
        title={recording ? "Recording rok do" : "Apni awaaz record karo"}
        className={clsx(
          "flex w-full items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
          recording
            ? "border-terracotta bg-terracotta/20 text-chalk-100"
            : busy
              ? "cursor-not-allowed border-ink-600 text-chalk-500"
              : "border-ink-600 text-chalk-400 hover:border-terracotta hover:text-chalk-200",
        )}
      >
        {busy ? (
          <Loader2 size={11} className="animate-spin" />
        ) : recording ? (
          <Square size={11} />
        ) : (
          <Mic size={11} />
        )}
        {busy ? "Chadh rahi hai…" : recording ? `Rok do — ${clock(seconds)}` : "Record karo"}
      </button>

      {/* Recording chalne par uska waqt dikhta hai — warna pata hi nahi chalta ki chal rahi hai. */}
      {recording ? (
        <p className="text-center text-[10px] text-terracotta">● rec {clock(seconds)}</p>
      ) : null}

      {/* Record karte hi sunn lo — bhejne se pehle. */}
      {lastAssetId && !recording ? <AudioPreview assetId={lastAssetId} /> : null}

      {error ? (
        <p className="flex items-start gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1 text-[10px] leading-snug text-amber">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
