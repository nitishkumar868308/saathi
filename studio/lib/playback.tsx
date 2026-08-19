"use client";

import { DEFAULT_SAFE_AREA_GUIDE_ID, clampFrame, secondsToFrames } from "@reel/core";
import type { PlayerRef } from "@remotion/player";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { DEFAULT_ZOOM_ID } from "@/lib/preview";
import { useEditorStoreApi } from "@/lib/store";

/**
 * Playback ka control — player ke bahar, taaki har kahin se chal sake.
 *
 * ⚠️ **Playhead yahan nahi rehta.** Wo store me hai (`uiSlice.playheadFrame`) aur
 * wahi ek sach hai (checklist 6.6): transport bar, timeline ka scrub, keyboard —
 * teeno usi ko likhte hain, aur player usko padh kar seek karta hai. Playhead ki
 * ek aur copy yahan rakhne se do state ban jaati aur wo hamesha ek dusre se ek
 * frame peechhe reh jaati.
 *
 * Yahan sirf wo cheezein hain jo **doc ka hissa nahi hain aur playhead bhi nahi**:
 * chal raha hai ya nahi, loop, mute/volume, zoom, guides, draft. Inhe doc me
 * daalna galat hota (Ctrl+Z volume badal deta), aur store me daalna bhi zaroori
 * nahi — ye editor ke ek session ki baat hai, save karne layak kuch nahi.
 *
 * Player ka imperative handle bhi yahi rakhta hai, isliye shortcut ko player ka
 * pata nahi hona chahiye — wo bas `playback.toggle()` bulata hai.
 */

export interface PlaybackState {
  isPlaying: boolean;
  loop: boolean;
  muted: boolean;
  /** 0-1. */
  volume: number;
  zoomId: string;
  guidesOn: boolean;
  /** Kaunsi safe-area guide dikh rahi hai. */
  guideId: string;
  draft: boolean;
  /** Naapa gaya: playback target fps se kaafi neeche chal raha hai. */
  stutter: boolean;
  /** Aakhri naapi hui asli fps — hint me dikhti hai. */
  measuredFps: number | null;
}

export interface PlaybackApi extends PlaybackState {
  /** `<Player ref={...}>` isi par lagta hai. */
  playerRef: RefObject<PlayerRef>;

  play(): void;
  pause(): void;
  toggle(): void;
  /** +1 / -1 frame. Chalte hue me step karne par pehle ruk jaata hai. */
  stepFrames(delta: number): void;
  /** Seconds ka jump — frames me badalna `secondsToFrames` se hi hota hai. */
  stepSeconds(delta: number): void;
  toStart(): void;
  toEnd(): void;

  setLoop(value: boolean): void;
  setMuted(value: boolean): void;
  setVolume(value: number): void;
  setZoomId(value: string): void;
  setGuidesOn(value: boolean): void;
  setGuideId(value: string): void;
  setDraft(value: boolean): void;

  /** Player apni asli haalat batata hai (play/pause event se). */
  reportPlaying(value: boolean): void;
  reportStutter(stutter: boolean, measuredFps: number | null): void;
}

const PlaybackContext = createContext<PlaybackApi | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const store = useEditorStoreApi();
  const playerRef = useRef<PlayerRef>(null);

  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    loop: false,
    muted: false,
    volume: 1,
    zoomId: DEFAULT_ZOOM_ID,
    guidesOn: false,
    /*
     * Yahan sirf shuruaati pasand rakhi jaati hai. "Ye guide is naap ke frame par
     * matlab rakhti hai ya nahi" ka faisla `effectiveGuideId()` karta hai —
     * kyunki project ka size baad me badal sakta hai (Section 3B) aur tab reel
     * wali guide 16:9 par bekaar ho jaati hai.
     */
    guideId: DEFAULT_SAFE_AREA_GUIDE_ID,
    draft: false,
    stutter: false,
    measuredFps: null,
  });

  /**
   * Playhead set karne ka ekmatra raasta.
   *
   * Hadd yahan lagti hai, player me nahi: `durationInFrames - 1` aakhri asli
   * frame hai, aur uske aage seek karne par Remotion khaali frame dikhata hai
   * jise dekh kar lagta hai ki project khatam hone se pehle hi kaala ho gaya.
   */
  const goTo = useCallback(
    (frame: number) => {
      const editor = store.getState();
      const last = Math.max(0, editor.doc.project.durationInFrames - 1);
      editor.setPlayhead(clampFrame(frame, 0, last));
    },
    [store],
  );

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const api = useMemo<PlaybackApi>(
    () => ({
      ...state,
      playerRef,

      play: () => playerRef.current?.play(),
      pause,
      toggle: () => playerRef.current?.toggle(),

      stepFrames: (delta) => {
        // Chalte-chalte frame step karna hamesha ulta padta hai: playback agla
        // frame likh deta hai aur step gayab ho jaata hai.
        pause();
        goTo(store.getState().playheadFrame + delta);
      },
      stepSeconds: (delta) => {
        pause();
        const editor = store.getState();
        goTo(editor.playheadFrame + secondsToFrames(delta, editor.doc.project.fps));
      },
      toStart: () => {
        pause();
        goTo(0);
      },
      toEnd: () => {
        pause();
        goTo(store.getState().doc.project.durationInFrames);
      },

      setLoop: (loop) => setState((previous) => ({ ...previous, loop })),
      setMuted: (muted) => setState((previous) => ({ ...previous, muted })),
      setVolume: (volume) =>
        setState((previous) => ({
          ...previous,
          volume: Math.min(1, Math.max(0, volume)),
          // Slider ghumate hi awaaz aani chahiye — warna "volume kaam nahi kar
          // raha" lagta hai jabki sirf mute laga hua tha.
          muted: volume <= 0 ? previous.muted : false,
        })),
      setZoomId: (zoomId) => setState((previous) => ({ ...previous, zoomId })),
      setGuidesOn: (guidesOn) => setState((previous) => ({ ...previous, guidesOn })),
      setGuideId: (id) => setState((previous) => ({ ...previous, guideId: id })),
      setDraft: (draft) => setState((previous) => ({ ...previous, draft })),

      reportPlaying: (isPlaying) => setState((previous) => ({ ...previous, isPlaying })),
      reportStutter: (stutter, measuredFps) =>
        setState((previous) =>
          previous.stutter === stutter && previous.measuredFps === measuredFps
            ? previous
            : { ...previous, stutter, measuredFps },
        ),
    }),
    [state, pause, goTo, store],
  );

  return <PlaybackContext.Provider value={api}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackApi {
  const api = useContext(PlaybackContext);
  if (!api) throw new Error("usePlayback sirf <PlaybackProvider> ke andar chalta hai");
  return api;
}
