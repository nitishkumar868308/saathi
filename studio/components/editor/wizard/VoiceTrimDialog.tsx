"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAssetUrl } from "@/lib/assetUrls";

/**
 * Awaaz ka kaunsa hissa lena hai (26.28).
 *
 * ⚠️ Ye `VideoTrimDialog` ka bhai hai, uski nakal nahi — do farak asli hain aur
 * dono kaan ke hain. Ek: yahan dekhne ko kuch nahi hota, isliye **sun kar dekhna**
 * hi ekmatra jaanch hai, aur wo sirf chune hue hisse ka hona chahiye (poori file
 * ka nahi, warna wo kuch bhi sabit nahi karta). Do: video me "kitna lamba" poochha
 * jaata hai kyunki scene ki lambai pehle se tay hoti hai; awaaz me ulta hai —
 * **scene ki lambai awaaz se banti hai**, isliye yahan "kahan tak" poochha jaata
 * hai.
 *
 * ⚠️ Ye file ko kaat-ta nahi hai, sirf ye likhta hai ki uska kaunsa hissa bajega
 * (`voiceTrim` → `trimItemToSourceRange`). Isliye kaat hatana ek tap hai aur asli
 * awaaz hamesha poori bachi rehti hai. Upar likh dene par ek galat kaat ke baad
 * awaaz dobara banani padti — jo paise aur waqt dono kharch karti hai.
 */
export function VoiceTrimDialog({
  open,
  assetId,
  fallbackSeconds,
  value,
  onCancel,
  onSave,
}: {
  open: boolean;
  assetId: string | null;
  /**
   * Jo lambai draft me likhi hai — jab tak file khud na bol de.
   *
   * ⚠️ Iske bina dialog khulte hi ek khaali dabba dikhta hai: R2 se file utarne
   * me waqt lagta hai aur tab tak `audio.duration` NaN rehta hai. Aadmi ko pata
   * hi nahi chalta ki intezaar karna hai ya kuch toota hai. File ka apna naap
   * aate hi is par chadh jaata hai.
   */
  fallbackSeconds: number | null;
  value: { startSeconds: number; endSeconds: number } | null;
  onCancel(): void;
  onSave(trim: { startSeconds: number; endSeconds: number } | null): void;
}) {
  const { url } = useAssetUrl(assetId);
  const audio = useRef<HTMLAudioElement>(null);

  const [duration, setDuration] = useState<number | null>(fallbackSeconds);
  const [start, setStart] = useState(value?.startSeconds ?? 0);
  const [end, setEnd] = useState(value?.endSeconds ?? fallbackSeconds ?? 0);
  const [playing, setPlaying] = useState(false);

  /*
   * ⚠️ Asli lambai **file se** aati hai, draft se nahi. Draft ka number TTS ke
   * jawab ka hai (ya library ka andaaza); yahan ek galat number ka matlab hai
   * aisa hissa chun lena jo file me hai hi nahi — aur wo reel me chuppi banta hai.
   */
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const onMeta = (): void => {
      const real = Number.isFinite(element.duration) ? element.duration : null;
      if (real === null) return;
      setDuration(real);
      setEnd((was) => (was <= 0 ? real : Math.min(was, real)));
      setStart((was) => Math.min(was, Math.max(0, real - 0.2)));
    };
    element.addEventListener("loadedmetadata", onMeta);
    return () => element.removeEventListener("loadedmetadata", onMeta);
  }, [url]);

  /*
   * Chuna hua hissa khatam hote hi ruk jao.
   *
   * ⚠️ Bina iske "sun kar dekho" poori file baja deta hai, aur wo theek wo cheez
   * chhupa leta hai jiske liye aadmi yahan aaya tha: uske chune hue ant ke baad
   * kya hai. Wo aakhri adhoora shabd sunai hi nahi deta, aur wo apni kaat ko
   * theek maan kar aage badh jaata hai.
   */
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const onTime = (): void => {
      if (element.currentTime >= end) {
        element.pause();
        element.currentTime = start;
      }
    };
    element.addEventListener("timeupdate", onTime);
    return () => element.removeEventListener("timeupdate", onTime);
  }, [start, end]);

  // Dialog band hote hi awaaz bhi band — warna wo peeche bajti rehti hai.
  useEffect(() => {
    if (open) return;
    const element = audio.current;
    if (element) element.pause();
  }, [open]);

  if (!open) return null;

  const max = duration ?? 0;
  const cut = Math.max(0, end - start);

  function toggle(): void {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      element.currentTime = start;
      void element.play();
    } else {
      element.pause();
    }
  }

  return (
    <Modal
      open={open}
      title="Awaaz ka kaunsa hissa"
      onClose={onCancel}
      width="max-w-md"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 text-[11px] text-chalk-500">
            {duration === null
              ? "awaaz padhi ja rahi hai…"
              : `${start.toFixed(1)}s se ${end.toFixed(1)}s — ${cut.toFixed(1)}s bajegi`}
          </span>
          {/*
            "Poori awaaz" ka raasta khula rakhna zaroori hai. Bina iske ek baar
            kaat lagane ke baad wapas jaane ka koi tarika nahi bachta, aur aadmi
            ko awaaz dobara banani padti hai — jo paise bhi leti hai.
          */}
          <Button variant="ghost" onClick={() => onSave(null)}>
            Poori awaaz
          </Button>
          <Button
            variant="primary"
            disabled={duration === null || cut < 0.3}
            onClick={() => onSave({ startSeconds: start, endSeconds: end })}
          >
            Yahi lo
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="rounded border border-ink-600 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-chalk-400">
          Shuru ki saans ya ant ka adhoora shabd yahin se kaat do. File nahi badalti —
          sirf itna tay hota hai ki reel me uska <strong>kaunsa hissa</strong> bajega, aur
          scene ki lambai bhi usi hisaab se ban jaayegi.
        </p>

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audio}
          src={url ?? undefined}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {duration === null ? (
          <p className="flex items-center gap-1.5 rounded border border-amber/40 bg-amber/10 px-2 py-1.5 text-[11px] leading-snug text-amber">
            <Loader2 size={11} className="shrink-0 animate-spin" />
            Awaaz khul nahi rahi — uski lambai pata nahi chal rahi, isliye hissa chunna abhi
            mumkin nahi. <strong>Poori awaaz</strong> daba kar aage badh sakte ho.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                title={playing ? "Rok do" : "Chuna hua hissa sun kar dekho"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-600 text-chalk-300 transition-colors hover:border-terracotta hover:text-chalk-100"
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="text-[11px] leading-snug text-chalk-400">
                Sirf chuna hua hissa bajega — {cut.toFixed(1)}s.
              </span>
            </div>

            <label className="block">
              <span className="text-[11px] text-chalk-400">
                Kahan se — <strong>{start.toFixed(1)}s</strong>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, max - 0.3)}
                step={0.1}
                value={start}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setStart(next);
                  setEnd((was) => Math.max(was, next + 0.3));
                }}
                className="w-full accent-terracotta"
              />
            </label>

            <label className="block">
              <span className="text-[11px] text-chalk-400">
                Kahan tak — <strong>{end.toFixed(1)}s</strong>
              </span>
              <input
                type="range"
                min={Math.min(start + 0.3, max)}
                max={max}
                step={0.1}
                value={Math.min(Math.max(end, start + 0.3), max)}
                onChange={(event) => setEnd(Number(event.target.value))}
                className="w-full accent-terracotta"
              />
            </label>

            <p className="text-[10px] text-chalk-500">Poori awaaz {max.toFixed(1)}s ki hai.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
