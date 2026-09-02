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

import {
  REST_VISEME,
  VISEME_SHAPES,
  affineFromTriangles,
  applyAffine,
  getVisemeShape,
  knownViseme,
  trianglePoints,
  visemesFromText,
  type Point,
} from "../src/index";

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
/* ------------------------------------------------------------ muh ke shape */

console.log("\nmuh ke aath shape");

check("aath hi hain", VISEME_SHAPES.length === 8, "Rhubarb bhi aath par tika hai");
check("koi id do baar nahi", new Set(VISEME_SHAPES.map((s) => s.id)).size === 8);
check("har shape ka apna naam hai", VISEME_SHAPES.every((s) => s.label.trim().length > 0));
check("aaram ka shape registry me hai", getVisemeShape(REST_VISEME) !== undefined);
check(
  "honth band wala shape sach me band hai",
  getVisemeShape("MBP")!.open === 0,
  "isse bada rakhne par म/ब/प par honth milte hi nahi",
);
check(
  "aaram par honth bilkul chipke nahi hote",
  getVisemeShape(REST_VISEME)!.open > 0,
  "bilkul 0 par chehra 'honth dabaye hue' lagta hai — har chup lamhe par",
);
check("gol shape sach me simta hua hai", getVisemeShape("OO")!.wide < 1);
check("chaura shape sach me kheencha hua hai", getVisemeShape("EE")!.wide > 1);
check("anjaan id par undefined", getVisemeShape("nahi-hai") === undefined);
check("knownViseme sahi bolta hai", knownViseme("AA") && !knownViseme("ZZ"));
check(
  "har shape ke number apni hadd me hain",
  VISEME_SHAPES.every((s) => s.open >= 0 && s.open <= 1 && s.wide > 0 && s.round >= 0 && s.round <= 1),
);

/* ---------------------------------------------------------- text se qatar */

console.log("\ntext se muh ke shape");

check("khaali text par kuch nahi", visemesFromText("").length === 0);

check(
  "'माँ' par sabse pehle honth band",
  visemesFromText("माँ")[0]?.viseme === "MBP",
  "म/ब/प par honth na milna wo galti hai jo har dekhne wala turant pakad leta hai",
);
check("'माँ' me uske baad muh khulta hai", visemesFromText("माँ")[1]?.viseme === "AA");
check(
  "chandrabindu ka apna shape nahi hota",
  visemesFromText("माँ").length === 2,
  "usse apna shape dene par muh ko ek bekaar ka jhatka lagta hai",
);

check("'आ' par muh poora khulta hai", visemesFromText("आ")[0]?.viseme === "AA");
check("'ऊ' par gol", visemesFromText("ऊ")[0]?.viseme === "OO");
check("'ई' par chaura", visemesFromText("ई")[0]?.viseme === "EE");

check(
  "bina matra ke vyanjan apne saath 'अ' leta hai",
  visemesFromText("कमल").some((s) => s.viseme === "AA"),
  "ise chhodne par 'कमल' teen band honth ban jaata aur muh kabhi khulta hi nahi",
);

check(
  "'papa' me dono p par honth band",
  visemesFromText("papa").filter((s) => s.viseme === "MBP").length === 2,
);
check("'namaste' me म par honth band", visemesFromText("namaste").some((s) => s.viseme === "MBP"));
check("'van' par F/V wala shape", visemesFromText("van")[0]?.viseme === "FV");

check("space par aaram", visemesFromText("a a").some((s) => s.viseme === REST_VISEME));
check(
  "lagatar khaali jagah par ek hi aaram",
  visemesFromText("a    a").filter((s) => s.viseme === REST_VISEME).length === 1,
  "har space ko bhaar dene par muh asli shabdon par jaldbaazi karta hai",
);

check(
  "swar ka guchha ek hi shape deta hai",
  visemesFromText("boat").filter((s) => s.viseme === "OO").length === 1,
  "har akshar ko apna shape dene par muh ek hi swar me do baar badalta hai — kaanpne jaisa",
);

check(
  "shabd ke ant ka vyanjan bhi dikhta hai",
  visemesFromText("stop").some((s) => s.viseme === "MBP"),
  "aakhri p par honth band hona chahiye",
);

check(
  "har kadam ka bhaar 0 se bada hai",
  visemesFromText("namaste dosto, aaj ka update").every((s) => s.weight > 0),
  "bhaar 0 hone par us kadam ko koi waqt milta hi nahi",
);
check(
  "har kadam ka shape registry me hai",
  visemesFromText("नमस्ते dosto").every((s) => knownViseme(s.viseme)),
  "anjaan shape par render me muh apni pichhli jagah atak jaata hai — bina error ke",
);
check(
  "Hinglish (dono lipi) ek saath chalti hai",
  visemesFromText("aaj ka अपडेट").length > 4,
);
check(
  "sirf viraam par bhi nahi phatta",
  visemesFromText("... !!! ???").every((s) => s.viseme === REST_VISEME),
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
