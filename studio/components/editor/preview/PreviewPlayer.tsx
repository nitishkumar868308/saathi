"use client";

import { getItemType } from "@reel/core";
import { ReelComposition, type AssetMap } from "@reel/remotion";
import { Player, type CallbackListener } from "@remotion/player";
import { useEffect, useMemo, useRef } from "react";

import { GuidesOverlay } from "@/components/editor/preview/GuidesOverlay";
import { useFonts } from "@/lib/fonts";
import { usePlayback } from "@/lib/playback";
import {
  createSeekThrottle,
  createStutterWatch,
  effectiveGuideId,
  previewLayout,
  sharedAudioTagCount,
} from "@/lib/preview";
import { useEditorStore, useEditorStoreApi } from "@/lib/store";
import { useElementSize } from "@/lib/useElementSize";

/**
 * Asli preview — **wahi `ReelComposition`** jo final MP4 banati hai.
 *
 * Yahan koi "chhota preview" nahi likha gaya, aur ye Section E ka locked faisla
 * #4 hai: do alag renderer rakhne par framing, font aur timing me hamesha thoda
 * farak reh jaata hai, aur wo farak tab dikhta hai jab video ban chuki hoti hai.
 * `@remotion/player` aur `renderMedia` dono isi component ko chalate hain.
 *
 * ⚠️ Preview ka resolution ghat sakta hai (zoom / draft), par **framing bilkul
 * wahi rehti hai** — poori composition par ek hi uniform scale lagti hai
 * (`previewLayout()`), kisi layer par alag se kuch nahi.
 */
export function PreviewPlayer({ assets }: { assets: AssetMap }) {
  const store = useEditorStoreApi();
  const doc = useEditorStore((state) => state.doc);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const playback = usePlayback();

  const { width, height, fps, durationInFrames } = doc.project;
  const { ref: boxRef, size } = useElementSize<HTMLDivElement>();
  const guideId = effectiveGuideId(width, height, playback.guideId);

  const layout = previewLayout(
    size ?? { width: 0, height: 0 },
    { width, height },
    { zoomId: playback.zoomId, draft: playback.draft },
  );

  /**
   * Player abhi DOM me hai ya nahi.
   *
   * ⚠️ Ye flag zaroori hai aur iski wajah ek asli bug thi: pehle render par
   * `size` null hoti hai (ResizeObserver abhi bola hi nahi), isliye `<Player>`
   * render hota hi nahi aur neeche wale saare effect `playerRef.current === null`
   * dekh kar chup-chaap laut jaate the. Naap aane par Player mount to ho jaata,
   * par effects ki dependency nahi badalti thi — matlab **listeners kabhi lagte
   * hi nahi**. Screen par sab theek dikhta: preview bhi chalti, par playhead
   * kahin update nahi hota. Isliye ab har effect ise bhi dekhta hai.
   */
  const playerMounted = layout.width > 0;

  /*
   * Player ko naya `inputProps` object har render par milta hai — aur milna bhi
   * chahiye, warna doc badalne par preview purani hi dikhti. `component` sthir
   * hai (module-level const), isliye Player **remount nahi hota** aur chalte hue
   * playback ki jagah nahi khoti (checklist 6.2).
   */
  const { fonts } = useFonts(doc);
  const inputProps = useMemo(() => ({ doc, assets, fonts }), [doc, assets, fonts]);

  /**
   * Kitne `<audio>` tag pehle se bana kar rakhne hain (6.9).
   *
   * Doc se naapa jaata hai — jitne audio ek saath baj sakte hain. Ek tay number
   * likh dene par ya to tag kam padte (aur awaaz chup ho jaati) ya bekaar bane
   * rehte.
   */
  const audioTags = useMemo(
    () =>
      sharedAudioTagCount(
        doc.items.map((item) => ({
          startFrame: item.startFrame,
          durationInFrames: item.durationInFrames,
          // Registry se — `item.type === "audio"` likhna Dynamic rule 3 todta hai.
          hasAudio: getItemType(item.type)?.hasAudio ?? false,
        })),
      ),
    [doc.items],
  );

  /* --------------------------------------------------- player -> playhead */

  /**
   * Player se aaya hua aakhri frame.
   *
   * Iske bina ek chakkar ban jaata hai: player frame deta hai -> store badalta
   * hai -> neeche wala effect wahi frame player ko wapas seek kar deta hai ->
   * playback har frame par apne aap ko seek karta rehta hai aur audio tootti hai.
   */
  const fromPlayer = useRef<number | null>(null);

  /*
   * Player mount hote waqt kis frame par khule. Ye **jamaaya hua** hai: har
   * frameupdate par badalta hua `initialFrame` dena matlab Player ko har frame
   * par ye batana ki uski shuruaat kahin aur thi — aur wo cheez sirf kabhi-kabhi,
   * kisi ek build par phatti hai. Seek ka kaam neeche wala effect karta hai.
   */
  const initialFrame = useRef(playheadFrame);

  useEffect(() => {
    const player = playback.playerRef.current;
    if (!player) return;

    const watch = createStutterWatch(fps);
    const setPlayhead = store.getState().setPlayhead;

    const onFrame: CallbackListener<"frameupdate"> = (event) => {
      fromPlayer.current = event.detail.frame;
      setPlayhead(event.detail.frame);

      // Stutter sirf chalte hue naapa jaata hai — scrub ke dauraan frameupdate
      // ki raftaar user ke haath ki hoti hai, player ki nahi.
      if (!player.isPlaying()) {
        watch.reset();
        return;
      }
      const stuttering = watch.push(performance.now());
      playback.reportStutter(stuttering, watch.measuredFps());
    };

    const onPlay: CallbackListener<"play"> = () => {
      watch.reset();
      playback.reportPlaying(true);
    };
    const onPause: CallbackListener<"pause"> = () => {
      watch.reset();
      playback.reportPlaying(false);
      playback.reportStutter(false, null);
    };

    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
    // `playback` ka pehchaan har state badalne par badalti hai; listeners ko
    // usse baandhna matlab har play/pause par unhe utaarna-chadhana. Isliye
    // sirf fps par — baaki sab ref/callback se taaza padha jaata hai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps, store, playerMounted]);

  /* --------------------------------------------------- playhead -> player */

  const throttle = useRef<ReturnType<typeof createSeekThrottle> | null>(null);
  if (!throttle.current) {
    throttle.current = createSeekThrottle(
      (frame) => playback.playerRef.current?.seekTo(frame),
      {
        now: () => performance.now(),
        // rAF hi sahi paimana hai: browser jab agla frame banayega tabhi seek ka
        // matlab hai. `setTimeout` background tab me bhi chalta rehta hai.
        schedule: (callback) => {
          requestAnimationFrame(() => callback());
        },
      },
    );
  }

  useEffect(() => {
    const player = playback.playerRef.current;
    if (!player) return;
    // Ye badlaav player ne khud kiya tha — usko wapas seek karna bekaar hai.
    if (fromPlayer.current === playheadFrame) return;
    if (player.getCurrentFrame() === playheadFrame) return;
    throttle.current?.request(playheadFrame);
  }, [playheadFrame, playback.playerRef, playerMounted]);

  /* ------------------------------------------------------- volume / mute */

  useEffect(() => {
    const player = playback.playerRef.current;
    if (!player) return;
    player.setVolume(playback.volume);
    if (playback.muted) player.mute();
    else player.unmute();
  }, [playback.volume, playback.muted, playback.playerRef, playerMounted]);

  return (
    <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
      <div
        className="relative shrink-0 border border-ink-600"
        style={{ width: layout.width, height: layout.height }}
      >
        {playerMounted ? (
          <Player
            ref={playback.playerRef}
            component={ReelComposition}
            inputProps={inputProps}
            durationInFrames={Math.max(1, durationInFrames)}
            compositionWidth={width}
            compositionHeight={height}
            fps={fps}
            loop={playback.loop}
            // Apna transport hai — Remotion ke controls do baar wahi cheez dikhate.
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            // Space humare shortcut registry se chalti hai, taaki player par focus
            // na hone par bhi kaam kare.
            spaceKeyToPlayOrPause={false}
            numberOfSharedAudioTags={audioTags}
            initialFrame={initialFrame.current}
            /*
             * ⚠️ `imageSmoothing` / `image-rendering` yahan jaan-boojhkar chhua
             * nahi gaya (checklist 6.9). Browser ka default smooth scaling hi
             * final render ke sabse kareeb hai; `pixelated` daalne par preview me
             * kinare kade dikhte hain aur MP4 me nahi — yaani preview jhooth
             * bolne lagta hai.
             */
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}

        {playback.guidesOn && guideId ? <GuidesOverlay guideId={guideId} /> : null}
      </div>
    </div>
  );
}
