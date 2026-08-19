"use client";

import { DEFAULT_SAFE_AREA_GUIDE_ID, clampFrame, secondsToFrames } from "@reel/core";
import type { PlayerRef } from "@remotion/player";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
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

/** Shuttle isse tez nahi hoti — usse aage frame dikhte hi nahi, sirf bhaagte hain. */
const MAX_SHUTTLE_RATE = 8;

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
  /** J/K/L shuttle ki abhi ki raftaar. 0 = shuttle band. */
  shuttleRate: number;
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
  /**
   * J / K / L shuttle (16.5).
   *
   * `-1` peeche, `+1` aage, `0` roko. Usi disha me dobara dabane par raftaar
   * dugni ho jaati hai (1x -> 2x -> 4x), aur ulti disha me dabane par pehle
   * raftaar 1x par wapas aati hai. Yahi har NLE karta hai, aur usi ki wajah se
   * footage me ek jagah dhoondhna J-J-L-K jitna hi hota hai.
   */
  shuttle(direction: -1 | 0 | 1): void;

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
    shuttleRate: 0,
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

  /**
   * Shuttle ki raftaar ek ref me hai, state me nahi — aur ye zaroori hai.
   *
   * `shuttle()` ko turant purani raftaar chahiye hoti hai taaki wo dugni kar
   * sake. State se padhne par `api` ke dobara bante hi purana closure baith
   * jaata aur J dabate rehne par raftaar 2x par atak jaati.
   */
  const shuttleRef = useRef(0);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  /*
   * Shuttle ka apna loop.
   *
   * ⚠️ Remotion ke `<Player>` par "speed" jaisa koi prop nahi hai, aur peeche
   * chalane ka to sawaal hi nahi. Isliye shuttle playhead ko khud aage-peeche
   * khiskata hai. 1x aage wale case ko chhod diya gaya hai — wahan asli playback
   * behtar hai (awaaz ke saath, aur frames chhootenge nahi).
   *
   * Kadam **beete hue asli waqt** se banta hai, har tick par ek frame se nahi:
   * bhaari project me rAF 60 ki jagah 20 baar chalta hai, aur tab fixed kadam
   * lene par shuttle ki raftaar apne aap teen guna dheemi ho jaati.
   */
  useEffect(() => {
    const rate = state.shuttleRate;
    if (rate === 0 || rate === 1) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const editor = store.getState();
      const fps = editor.doc.project.fps;
      const elapsed = (now - last) / 1000;
      last = now;

      const next = editor.playheadFrame + rate * fps * elapsed;
      const clamped = Math.max(0, Math.min(editor.doc.project.durationInFrames, next));
      goTo(Math.round(clamped));

      // Kinare par pahunch kar shuttle apne aap ruk jaata hai — warna user ko
      // lagta hai ki wo chal raha hai par kuch ho nahi raha.
      if (clamped <= 0 || clamped >= editor.doc.project.durationInFrames) {
        shuttleRef.current = 0;
        setState((previous) => ({ ...previous, shuttleRate: 0 }));
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.shuttleRate, goTo, store]);

  const stopShuttle = useCallback(() => {
    if (shuttleRef.current === 0) return;
    shuttleRef.current = 0;
    setState((previous) => ({ ...previous, shuttleRate: 0 }));
  }, []);

  const api = useMemo<PlaybackApi>(
    () => ({
      ...state,
      playerRef,

      play: () => {
        // Shuttle chalte hue Space dabana — playback jeetna chahiye, warna do
        // cheezein ek saath playhead likhti hain aur wo kaanpta hai.
        stopShuttle();
        playerRef.current?.play();
      },
      pause,
      toggle: () => playerRef.current?.toggle(),

      stepFrames: (delta) => {
        // Chalte-chalte frame step karna hamesha ulta padta hai: playback agla
        // frame likh deta hai aur step gayab ho jaata hai.
        stopShuttle();
        pause();
        goTo(store.getState().playheadFrame + delta);
      },
      stepSeconds: (delta) => {
        stopShuttle();
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

      shuttle: (direction) => {
        if (direction === 0) {
          shuttleRef.current = 0;
          pause();
          setState((previous) => ({ ...previous, shuttleRate: 0 }));
          return;
        }

        const current = shuttleRef.current;
        /*
         * Ulti disha me dabane par seedha -2x par chala jaana galat lagta hai:
         * user ko lagta hai ki wo "wapas" jaana chahta tha, aur video bhaag
         * jaati hai. Isliye pehle 1x par aata hai, phir hi tez hota hai.
         */
        const next =
          current === 0 || Math.sign(current) !== direction
            ? direction
            : Math.sign(current) * Math.min(MAX_SHUTTLE_RATE, Math.abs(current) * 2);

        shuttleRef.current = next;
        setState((previous) => ({ ...previous, shuttleRate: next }));

        // Aage ki taraf 1x par asli playback hi sabse sahi hai — awaaz ke saath.
        if (next === 1) {
          playerRef.current?.play();
          return;
        }
        pause();
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
