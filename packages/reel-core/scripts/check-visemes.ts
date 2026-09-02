/**
 * Bolti tasveer ka poora hisaab — mesh ka ganit, muh ke shape, aur waqt.
 *
 * ```
 * npm run check --workspace @reel/core
 * ```
 *
 * Repo me koi test runner nahi hai; yahan ka tarika `check-*` script hai
 * (`check-wizard.ts`, `worker/scripts/check-fonts.ts`). Wahi tarika yahan bhi —
 * ek hi tarika, ek hi jagah samajhne layak.
 *
 * ⚠️ Ye hisaab yahan isliye jancha jaata hai, browser me nahi, kyunki iski galti
 * dikhti nahi hai. Thoda galat matrix par tasveer bas "halki si ajeeb" lagti hai
 * — koi error nahi, koi khaali frame nahi. Aisi galti ko sirf render dekh kar
 * pakadna matlab har badlav ke baad ek poora render chalana, jo koi nahi karta.
 */

import { affineFromTriangles, applyAffine, trianglePoints, type Point } from "../src/index";

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

function near(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

type Tri = readonly [Point, Point, Point];

/* ------------------------------------------------------------------ affine */

console.log("\naffine — teen point se matrix");

const unit: Tri = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 10 },
];

const same = affineFromTriangles(unit, unit);
check(
  "wahi triangle par matrix kuch nahi badalti",
  same !== null && near(same.a, 1) && near(same.d, 1) && near(same.b, 0) && near(same.c, 0) && near(same.e, 0) && near(same.f, 0),
);

const moved = affineFromTriangles(unit, [
  { x: 5, y: 5 },
  { x: 15, y: 5 },
  { x: 5, y: 15 },
]);
check(
  "khiska hua triangle — teeno point apni sahi jagah pahunchte hain",
  moved !== null &&
    near(applyAffine(moved, unit[0]).x, 5) &&
    near(applyAffine(moved, unit[0]).y, 5) &&
    near(applyAffine(moved, unit[1]).x, 15) &&
    near(applyAffine(moved, unit[2]).y, 15),
);

const stretched = affineFromTriangles(unit, [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 0, y: 10 },
]);
check(
  "do guna chaura — x do guna hota hai, y waisa ka waisa rehta hai",
  stretched !== null &&
    near(applyAffine(stretched, { x: 5, y: 5 }).x, 10) &&
    near(applyAffine(stretched, { x: 5, y: 5 }).y, 5),
);

/*
 * Muh khulna asal me yahi hai: neeche wala honth neeche chala jaata hai, upar
 * wala apni jagah rehta hai.
 */
const opened = affineFromTriangles(unit, [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 16 },
]);
check(
  "muh khulna — neeche wala kinara neeche jaata hai, upar wala nahi hilta",
  opened !== null &&
    near(applyAffine(opened, { x: 0, y: 0 }).y, 0) &&
    near(applyAffine(opened, { x: 0, y: 10 }).y, 16),
);

check(
  "ek lakeer par pade SOURCE point par matrix banti hi nahi",
  affineFromTriangles(
    [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
    ],
    unit,
  ) === null,
  "zabardasti banane par det 0 se bhaag hota hai aur tasveer poore frame par kheench jaati hai",
);

/*
 * ⚠️ Ye jaanch ulta sabit karti hai, aur wahi iski wajah hai: chapta DESTINATION
 * bilkul jaayaz hai — wahi "honth band" hai. Ise galti maan lene par म/ब/प par
 * muh kabhi poora band hota hi nahi.
 */
const flat = affineFromTriangles(unit, [
  { x: 0, y: 5 },
  { x: 10, y: 5 },
  { x: 0, y: 5 },
]);
check(
  "chapta DESTINATION jaayaz hai — yahi honth band hona hai",
  flat !== null && near(applyAffine(flat, { x: 0, y: 10 }).y, 5),
  "ise galti maanne par म/ब/प par muh kabhi band hota hi nahi",
);

check(
  "polygon SVG ke clip-path ke layak nikalta hai",
  trianglePoints(unit) === "0,0 10,0 0,10",
);
/* ------------------------------------------------------------------ summary */

/*
 * ⚠️ Sirf ek summary, aur wo file ke bilkul ant me — wahi wajah jo
 * `check-wizard.ts` me likhi hai: is line ke BAAD likhi gayi jaanch chalti to hai
 * par ginti me nahi aati, aur uske fail hone par bhi script exit 0 deti hai.
 */
console.log(`\n${passed} ok, ${failures.length} fail`);
if (failures.length > 0) {
  for (const line of failures) console.log(`  - ${line}`);
  process.exit(1);
}
