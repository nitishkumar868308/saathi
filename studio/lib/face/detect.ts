"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { FACE_DATA_VERSION, type FaceData, type FacePoint } from "@reel/core";

import {
  faceOvalPoints,
  leftBrowPoints,
  leftEyePoints,
  lipRings,
  rightBrowPoints,
  rightEyePoints,
} from "@/lib/face/indices";

/**
 * Tasveer me chehra dhoondho — **browser me, poori tarah local** (bolti tasveer).
 *
 * ⚠️ Ye server par nahi chalta, aur wo jaan-boojhkar hai. Teen faayde, teenon
 * asli: studio Vercel par bhi chalti hai (aur wahan koi binary nahi chal sakta),
 * GitHub ke render minute me se ek second bhi kharch nahi hota, aur tasveer
 * kabhi kisi bahari jagah nahi jaati.
 *
 * ⚠️ WASM aur model dono **apne hi `public/` se** aate hain, kisi CDN se nahi.
 * MediaPipe ka aam tarika jsdelivr ka URL dena hai; wo yahan do wajah se galat
 * hai — is project ka niyam hai ki kuch bahar na jaaye, aur CDN band hone par
 * feature chup-chaap marta hai (screen par sirf "kuch nahi hua" dikhta hai).
 */

/** Model bhaari hai (~4MB) aur WASM usse bhi — ek hi baar utarta hai. */
let pending: Promise<FaceLandmarker> | null = null;

async function detector(): Promise<FaceLandmarker> {
  if (pending) return pending;

  pending = (async () => {
    const fileset = await FilesetResolver.forVisionTasks("/models/wasm");
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
      runningMode: "IMAGE",
      /*
       * ⚠️ Ek hi chehra. Do log wali tasveer par mesh kis par lage — iska koi
       * bharosemand jawab nahi hai, aur "sabse bade wale par" chun lena aksar
       * galat nikalta hai (peeche khada aadmi kabhi-kabhi bada dikhta hai).
       * Aisi tasveer par saaf mana karna behtar hai, aur wo `detectFace` karta
       * hai.
       */
      numFaces: 1,
    });
  })();

  /*
   * Fail hone par yaad mat rakho — warna ek baar ka network/WASM ka jhatka poore
   * session ke liye feature band kar deta hai, aur dobara koshish ka koi raasta
   * nahi bachta.
   */
  pending.catch(() => {
    pending = null;
  });

  return pending;
}

export interface DetectedFace {
  face: FaceData;
  /** Tasveer ka apna naap — `talkingPhoto.sourceSize` me yahi jaata hai. */
  size: { width: number; height: number };
}

/** Ghere ka kitna ilaaka — bahari aur andaruni honth me farak isse tay hota hai. */
function ringArea(points: readonly FacePoint[]): number {
  if (points.length === 0) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

/**
 * Chehra mila to uska data, warna **`null`**.
 *
 * ⚠️ `null` ka matlab hai "ye tasveer bol nahi sakti", aur wo UI me saaf dikhna
 * chahiye. Chup-chaap koi aadha-adhoora chehra maan kar aage badhna wo galti hai
 * jo render me ek hilte hue dhabbe ki tarah nikalti hai — aur tab tak aadmi poori
 * reel bana chuka hota hai.
 */
export async function detectFace(image: HTMLImageElement): Promise<DetectedFace | null> {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return null;

  const result = (await detector()).detect(image);
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;

  const pick = (indices: readonly number[]): FacePoint[] => {
    const points: FacePoint[] = [];
    for (const at of indices) {
      const point = landmarks[at];
      /*
       * Anjaan index chup-chaap chhod diya jaata hai. Ye tab hota hai jab model
       * badal jaaye aur uske points kam ho jaayein — us halat me aadha chehra
       * lena poore feature ke band ho jaane se behtar hai, aur `FaceDataSchema`
       * waise bhi honth na hone par mana kar deta hai.
       */
      if (!point) continue;
      points.push({ x: point.x, y: point.y });
    }
    return points;
  };

  /*
   * Honth ke do ghere — bada wala bahari. Ye naap se tay hota hai, kram se nahi:
   * library kis ghere ko pehle deti hai iska koi vaada nahi hai, aur uspar
   * bharosa karne par ek din bahari aur andaruni aapas me badal jaate hain — jis
   * par mesh muh ke andar simat kar reh jaata.
   */
  const rings = lipRings().map(pick);
  const sorted = [...rings].sort((a, b) => ringArea(b) - ringArea(a));
  const lipsOuter = sorted[0] ?? [];
  const lipsInner = sorted[1] ?? [];

  const face: FaceData = {
    version: FACE_DATA_VERSION,
    lipsOuter,
    lipsInner,
    jaw: pick(faceOvalPoints()),
    leftEye: pick(leftEyePoints()),
    rightEye: pick(rightEyePoints()),
    leftBrow: pick(leftBrowPoints()),
    rightBrow: pick(rightBrowPoints()),
  };

  /* Honth hi is poore feature ka aadhaar hain — unke bina data bekaar hai. */
  if (face.lipsOuter.length < 3) return null;

  return { face, size: { width, height } };
}
