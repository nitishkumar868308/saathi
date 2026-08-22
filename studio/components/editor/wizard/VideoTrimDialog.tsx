"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAssetUrl } from "@/lib/assetUrls";

/**
 * Video ka kaunsa hissa lena hai (26.18).
 *
 * ⚠️ Ye modal video daalte hi khulta hai, baad me nahi — aur wo tarteeb hi iski
 * poori wajah hai. 2 minute ki recording ko 4 second ke scene me daalne par bina
 * poochhe **pehle 4 second** lag jaate hain, aur wo aksar theek wahi hissa hota
 * hai jisme kuch hua hi nahi: camera set ho raha tha, aadmi baith raha tha.
 * Aadmi ko wo galti reel bante waqt dikhti hai, aur tab tak wo aage badh chuka
 * hota hai.
 *
 * ⚠️ Yahan koi timeline nahi hai, do number hain: kahan se, kitna lamba. Timeline
 * jaisa kuch banana matlab wizard ke andar hi ek chhota editor bana dena — aur
 * wizard ka poora vaada hi ye hai ki editor sikhna na pade. Jise sach me barik
 * kaam karna hai wo baad me editor me kar lega, jahan asli timeline hai.
 */
export function VideoTrimDialog({
  open,
  assetId,
  sceneSeconds,
  fallbackSeconds,
  value,
  onCancel,
  onSave,
}: {
  open: boolean;
  assetId: string | null;
  /** Scene abhi kitna lamba hai — default chunav yahi hota hai. */
  sceneSeconds: number;
  /**
   * DB me likhi hui video ki lambai — jab tak file khud na bol de.
   *
   * WARNING: Ye chala kar dekhne par joda gaya. R2 se video utarne me waqt lagta
   * hai, aur tab tak `video.duration` NaN rehta hai — yaani dialog khulta hai par
   * usme koi slider hota hi nahi. Aadmi ek khaali dabbe ke saamne baitha rehta
   * hai aur use pata nahi chalta ki intezaar karna hai ya kuch toota hai.
   *
   * File ka naap phir bhi behtar hai (DB ka andaaza upload ke waqt ka hota hai),
   * isliye wo aate hi is par chadh jaata hai.
   */
  fallbackSeconds: number | null;
  value: { startSeconds: number; endSeconds: number } | null;
  onCancel(): void;
  onSave(trim: { startSeconds: number; endSeconds: number } | null): void;
}) {
  const { url } = useAssetUrl(assetId);
  const video = useRef<HTMLVideoElement>(null);

  const [duration, setDuration] = useState<number | null>(fallbackSeconds);
  const [start, setStart] = useState(value?.startSeconds ?? 0);
  const [length, setLength] = useState(
    value ? value.endSeconds - value.startSeconds : sceneSeconds,
  );

  /*
   * ⚠️ Video ki asli lambai **file se** aati hai, DB se nahi. DB me `duration_ms`
   * ho bhi to wo upload ke waqt ka andaaza hota hai; yahan ek galat number ka
   * matlab hai aisa hissa chun lena jo file me hai hi nahi — aur wo render me
   * jaakar kaale frame banta hai.
   */
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const onMeta = () => {
      const real = Number.isFinite(element.duration) ? element.duration : null;
      setDuration(real);
      if (real !== null) setLength((was) => Math.min(was, real));
    };
    element.addEventListener("loadedmetadata", onMeta);
    return () => element.removeEventListener("loadedmetadata", onMeta);
  }, [url]);

  // Slider hilte hi wahi frame dikhe — warna number badalna andhera kaam hai.
  useEffect(() => {
    const element = video.current;
    if (element && duration !== null) element.currentTime = Math.min(start, duration - 0.05);
  }, [start, duration]);

  if (!open) return null;

  const max = duration ?? 0;
  const end = Math.min(start + length, max || start + length);

  return (
    <Modal
      open={open}
      title="Video ka kaunsa hissa"
      onClose={onCancel}
      width="max-w-md"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 text-[11px] text-chalk-500">
            {duration === null
              ? "video padhi ja rahi hai…"
              : `${start.toFixed(1)}s se ${end.toFixed(1)}s — ${(end - start).toFixed(1)}s ka scene`}
          </span>
          {/*
            "Poori video" ka raasta khula rakhna zaroori hai. Bina iske aadmi ko
            lagta hai ki kuch chunna hi padega, aur wo har video par ek faisla
            lene lagta hai jo aksar zaroori hi nahi tha.
          */}
          <Button variant="ghost" onClick={() => onSave(null)}>
            Poori video
          </Button>
          <Button
            variant="primary"
            disabled={duration === null}
            onClick={() => onSave({ startSeconds: start, endSeconds: end })}
          >
            Yahi lo
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-chalk-400">
          Poori video daalne par uske <strong>shuruaati</strong> {sceneSeconds}s hi scene me
          jaayenge — aur aksar wahi hissa khaali hota hai. Neeche se wo hissa chuno jo sach me
          dikhana hai.
        </p>

        <div className="mx-auto w-[200px] overflow-hidden rounded border border-ink-600 bg-black">
          {url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={video} src={url} className="w-full" muted playsInline preload="metadata" />
          ) : (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 size={16} className="animate-spin text-chalk-500" />
            </div>
          )}
        </div>

        {/*
          WARNING: Video na khul paane par pehle yahan **kuch nahi** aata tha -
          sirf ek kaala dabba aur do button. Aadmi ko pata hi nahi chalta ki
          intezaar karna hai, kuch toota hai, ya usne hi kuch galat kiya. Aur ye
          halat aam hai: file R2 par galat content-type se padi ho (purane upload),
          ya row ho par file hi na ho.
        */}
        {duration === null ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
            Video khul nahi rahi — uski lambai pata nahi chal rahi, isliye hissa chunna abhi
            mumkin nahi. Ho sakta hai file adhoori chadhi ho ya library me row ho par file na
            ho. Abhi <strong>Poori video</strong> daba kar aage badh sakte ho, ya koi doosri
            file chuno.
          </p>
        ) : null}

        {duration !== null ? (
          <div className="space-y-2">
            <label className="block">
              <span className="text-[11px] text-chalk-400">
                Kahan se — <strong>{start.toFixed(1)}s</strong>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, max - 0.5)}
                step={0.1}
                value={start}
                onChange={(event) => setStart(Number(event.target.value))}
                className="w-full accent-terracotta"
              />
            </label>

            <label className="block">
              <span className="text-[11px] text-chalk-400">
                Kitna lamba — <strong>{Math.min(length, max - start).toFixed(1)}s</strong>
              </span>
              <input
                type="range"
                min={0.5}
                max={Math.max(0.5, max - start)}
                step={0.1}
                value={Math.min(length, Math.max(0.5, max - start))}
                onChange={(event) => setLength(Number(event.target.value))}
                className="w-full accent-terracotta"
              />
            </label>

            <p className="text-[10px] text-chalk-500">
              Poori video {max.toFixed(1)}s ki hai.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
