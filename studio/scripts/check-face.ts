/**
 * MediaPipe ke landmark index — **chala kar jaanche hue, yaad se nahi** (bolti tasveer).
 *
 * ```
 * npm run check:face --workspace @reel/studio
 * ```
 *
 * ⚠️ Ye jaanch is poore feature ki sabse zaroori jaanchon me se hai, aur uski
 * wajah ye hai ki yahan ki galti **kisi error se nahi dikhti**. Agar honth ke
 * index galat hue to mesh chehre ke kisi aur hisse par baith jaata hai — naak
 * par, ya gaal par — aur code padhne par sab theek lagta hai. Wo galti sirf bani
 * hui reel dekh kar pakdi jaati, yaani sabse mehngi jagah par.
 *
 * ⚠️ Yahan koi WASM load nahi hota aur na koi tasveer chahiye. Library ke
 * constants saade array hain, isliye ye poori jaanch Node me chal jaati hai —
 * browser khole bina, ek second me.
 */

import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { ringsFromConnections } from "@reel/core";

import {
  faceOvalPoints,
  leftBrowPoints,
  leftEyePoints,
  lipRings,
  rightBrowPoints,
  rightEyePoints,
} from "../lib/face/indices";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Model 478 point deta hai (468 chehra + 10 aankh ki putli). */
const MAX_LANDMARK = 478;

console.log("\nlibrary apne connections deti hai");

const sets: [string, { start: number; end: number }[]][] = [
  ["honth", FaceLandmarker.FACE_LANDMARKS_LIPS],
  ["baayin aankh", FaceLandmarker.FACE_LANDMARKS_LEFT_EYE],
  ["daayin aankh", FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE],
  ["baayin bhaunh", FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW],
  ["daayin bhaunh", FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW],
  ["chehre ka ghera", FaceLandmarker.FACE_LANDMARKS_FACE_OVAL],
];

for (const [name, connections] of sets) {
  check(`${name} ki list maujood hai`, Array.isArray(connections) && connections.length > 0, `${connections?.length ?? 0} connections`);
}

console.log("\nhamare nikaale hue points");

const parts: [string, number[]][] = [
  ["baayin aankh", leftEyePoints()],
  ["daayin aankh", rightEyePoints()],
  ["baayin bhaunh", leftBrowPoints()],
  ["daayin bhaunh", rightBrowPoints()],
  ["chehre ka ghera", faceOvalPoints()],
];

for (const [name, points] of parts) {
  check(`${name} ke points mile`, points.length > 0, `${points.length} point`);
  check(
    `${name} ke saare index hadd me hain`,
    points.every((at) => Number.isInteger(at) && at >= 0 && at < MAX_LANDMARK),
    "hadd ke bahar ka index chup-chaap chhoot jaata hai aur us hisse ka aadha data aata hai",
  );
  check(`${name} me koi point do baar nahi`, new Set(points).size === points.length);
}

console.log("\nhonth — do ghere, bahari aur andaruni");

const rings = lipRings();
check(
  "honth theek do ghere dete hain",
  rings.length === 2,
  `${rings.length} ghera — ek hi nikle to bahari/andaruni ka farak hi khatam ho jaata hai`,
);
check(
  "dono ghere barabar bade hain",
  rings.length === 2 && rings[0]!.length === rings[1]!.length,
  rings.map((r) => r.length).join(" aur "),
);
check(
  "dono ghere alag points par hain",
  rings.length === 2 && rings[0]!.every((at) => !rings[1]!.includes(at)),
  "ek hi point dono me hone ka matlab hai ki ghere sach me alag nahi hue",
);
check(
  "honth ke saare index hadd me hain",
  rings.flat().every((at) => Number.isInteger(at) && at >= 0 && at < MAX_LANDMARK),
);

/*
 * ⚠️ Ye jaanch qatar ke **kram** par hai, sirf ginti par nahi. Ghere ke har point
 * ka apne agle point se sach me judа hona zaroori hai: kram toota hua ho to mesh
 * ke triangle aapas me kat'te hain, aur render me muh ke andar ek ulti-seedhi
 * jaali dikhne lagti hai.
 */
const lipEdges = new Set(
  FaceLandmarker.FACE_LANDMARKS_LIPS.flatMap((edge) => [
    `${edge.start}-${edge.end}`,
    `${edge.end}-${edge.start}`,
  ]),
);
check(
  "ghere ka har point apne agle se juda hua hai",
  rings.every((ring) =>
    ring.every((at, index) => {
      const next = ring[(index + 1) % ring.length];
      return next === undefined || lipEdges.has(`${at}-${next}`);
    }),
  ),
  "kram toota ho to mesh ke triangle aapas me kat'te hain",
);

console.log("\nqatar banane ka tarika");

check(
  "ek chakkar poora chalta hai",
  ringsFromConnections([
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 0 },
  ])[0]!.length === 3,
);
check("khaali par khaali", ringsFromConnections([]).length === 0);

console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
