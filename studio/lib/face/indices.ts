import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { pointsFromConnections, ringsFromConnections } from "@reel/core";

/**
 * Chehre ke kaunse point kis hisse ke hain — **library se, yaad se nahi**.
 *
 * ⚠️ Ye poori file isliye hai ki MediaPipe ke 478 point me se honth/aankh/bhaunh
 * ke number **kahin likhe na jaayein**. Wo numbers yaad se likh dena sabse aasan
 * raasta tha aur sabse khatarnak: ek galat number par mesh chehre ke kisi aur
 * hisse par baith jaata hai, aur wo galti kisi error se nahi — sirf bani hui
 * reel dekh kar pakdi jaati hai.
 *
 * Library apne connections khud batati hai (`FACE_LANDMARKS_LIPS` waghairah),
 * aur `ringsFromConnections` unhe ek qatar me badal deta hai. Model badle to
 * numbers apne aap badal jaayenge; yahan kuch nahi badalna padega.
 *
 * ⚠️ Ye file `@mediapipe/tasks-vision` ko sirf uske **constants** ke liye import
 * karti hai — koi WASM load nahi hota. Isi wajah se ise Node me chala kar jaancha
 * ja sakta hai (`scripts/check-face.ts`), browser khole bina.
 */

/** Honth ke do ghere — bahari aur andaruni. Kaunsa kaunsa hai wo naap se tay hota hai. */
export function lipRings(): number[][] {
  return ringsFromConnections(FaceLandmarker.FACE_LANDMARKS_LIPS);
}

export function leftEyePoints(): number[] {
  return pointsFromConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
}

export function rightEyePoints(): number[] {
  return pointsFromConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
}

export function leftBrowPoints(): number[] {
  return pointsFromConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW);
}

export function rightBrowPoints(): number[] {
  return pointsFromConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW);
}

/**
 * Chehre ka poora ghera.
 *
 * ⚠️ Ise `jaw` ke naam se jama kiya jaata hai, jabki isme maatha bhi aata hai —
 * aur wo theek hai, kyunki ismein se **sirf sabse neeche wala point** kaam aata
 * hai (thodi kahan khatam hoti hai). Sirf jabde ke points alag karne ka koi
 * bharosemand tarika library nahi deti, aur use haath se kaat'na wapas wahi
 * "yaad se index likhna" ban jaata hai jisse ye file bachti hai.
 */
export function faceOvalPoints(): number[] {
  return pointsFromConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
}
