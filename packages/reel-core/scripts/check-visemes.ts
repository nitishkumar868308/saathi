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
  inflateTriangle,
  getVisemeShape,
  knownViseme,
  trianglePoints,
  visemesFromText,
  buildVisemeTrack,
  speechSegments,
  visemeAt,
  DEFAULT_EMOTION,
  EMOTIONS,
  emotionOrDefault,
  getEmotion,
  buildMouthMesh,
  displacePoint,
  mouthRegion,
  readFaceData,
  sampleFace,
  createEmptyProject,
  createItem,
  getItemType,
  getSceneType,
  listSceneTypes,
  parseDoc,
  TalkingPhotoSchema,
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

console.log("\njod ki lakeer — triangle phulana");

const fat = inflateTriangle(unit, 1);
const centroid = { x: 10 / 3, y: 10 / 3 };
const away = (p: { x: number; y: number }): number => Math.hypot(p.x - centroid.x, p.y - centroid.y);

check(
  "har point beech se door hota hai",
  fat.every((p, at) => away(p) > away(unit[at]!)),
  "bilkul kinare par katne se Chromium beech me aadhe pixel ki lakeer chhod deta hai, aur usme peeche wali tasveer jhaankti hai",
);
check("theek utna hi door jitna kaha gaya", near(away(fat[0]!) - away(unit[0]!), 1, 1e-9));
check("0 par kuch nahi badalta", inflateTriangle(unit, 0).every((p, at) => near(p.x, unit[at]!.x)));
check(
  "beech par hi pade teeno point par nahi phatta",
  inflateTriangle(
    [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ],
    1,
  ).every((p) => Number.isFinite(p.x)),
);

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

/* --------------------------------------------------- awaaz aur text ka jod */

console.log("\nbolne wale hisse dhoondhna");

const loud = new Array(50).fill(0.7) as number[];
const quiet = new Array(50).fill(0) as number[];

check("poori awaaz par ek hi hissa", speechSegments(loud, 2).length === 1);
check("poori chuppi par koi hissa nahi", speechSegments(quiet, 2).length === 0);
check(
  "khaali envelope par poori lambai ko bolna maana jaata hai",
  speechSegments([], 2).length === 1,
  "awaaz ki koi jaankari hi na ho to sannata dhoondhna mumkin hi nahi",
);
check(
  "beech ki chuppi do hisse banati hai",
  speechSegments([...new Array(20).fill(0.7), ...new Array(20).fill(0), ...new Array(20).fill(0.7)], 3)
    .length === 2,
);
check(
  "bahut chhoti chuppi jodi jaati hai",
  speechSegments([...new Array(30).fill(0.7), 0, ...new Array(30).fill(0.7)], 3).length === 1,
  "shabdon ke beech ka jhol bolne ka hi hissa hai — wahan muh band karne se chehra hakla'ne lagta hai",
);
check(
  "ek khatka bolna nahi maana jaata",
  speechSegments([...new Array(60).fill(0), 0.9, ...new Array(60).fill(0)], 6).length === 0,
  "saans ya khatka threshold paar kar leti hai, par uspar shabd baithana galat hai",
);

console.log("\nmuh ka track");

const trackSteps = visemesFromText("namaste");
const allLoud = buildVisemeTrack({ steps: trackSteps, envelope: loud, durationSeconds: 2 });

check("bolte waqt shape aate hain", allLoud.length > 1);
check("pehla frame 0 se shuru hota hai", allLoud[0]?.atSeconds === 0);
check(
  "frame waqt ke kram me hain",
  allLoud.every((f, at) => at === 0 || f.atSeconds >= (allLoud[at - 1] as { atSeconds: number }).atSeconds),
  "beh tarteeb frame par visemeAt galat shape lauta deta hai",
);
check(
  "koi frame lambai se bahar nahi jaata",
  allLoud.every((f) => f.atSeconds <= 2 + 1e-9),
);
check(
  "ant me muh band hota hai",
  allLoud[allLoud.length - 1]?.viseme === REST_VISEME,
  "warna awaaz khatam hone ke baad bhi muh khula reh jaata hai — aur wo reel ka aakhri frame hota hai",
);
check(
  "har shape registry me hai",
  allLoud.every((f) => knownViseme(f.viseme)),
);

const halfSilent = buildVisemeTrack({
  steps: trackSteps,
  envelope: [...loud, ...quiet],
  durationSeconds: 2,
});
check(
  "chuppi wale hisse me muh band rehta hai",
  halfSilent.filter((f) => f.atSeconds > 1.05).every((f) => f.viseme === REST_VISEME),
  "yahi wo galti hai jo sirf text se karne par aati hai — saans me bhi muh chalta rehta",
);
check(
  "saare shape pehle aadhe me hi baithte hain",
  halfSilent.filter((f) => f.viseme !== REST_VISEME).every((f) => f.atSeconds < 1.05),
  "kadam sirf bolne wale hisson me baithte hain, poori lambai par nahi",
);

check(
  "poori chuppi par sirf aaram",
  buildVisemeTrack({ steps: trackSteps, envelope: quiet, durationSeconds: 1 }).every(
    (f) => f.viseme === REST_VISEME,
  ),
);
check(
  "bina text ke bhi ek shape milta hai",
  buildVisemeTrack({ steps: [], envelope: loud, durationSeconds: 1 }).length === 1,
  "khaali track par render ke paas koi shape hota hi nahi aur muh apni pichhli jagah jama reh jaata hai",
);

check(
  "zor envelope se aata hai, sab par ek jaisa nahi",
  new Set(
    buildVisemeTrack({
      steps: visemesFromText("namaste dosto kaise ho"),
      envelope: [0.2, 0.95, 0.3, 0.9, 0.25, 0.85, 0.35, 0.95, 0.3, 0.9],
      durationSeconds: 2,
    })
      .filter((f) => f.viseme !== REST_VISEME)
      .map((f) => Math.round(f.intensity * 10)),
  ).size > 1,
  "har frame par ek hi zor matlab 'chabaana' — sabse aam nakli lip sync",
);

check(
  "do hisson me bant kar bhi shabd chhoot'te nahi",
  buildVisemeTrack({
    steps: visemesFromText("namaste dosto"),
    envelope: [...new Array(20).fill(0.8), ...new Array(20).fill(0), ...new Array(20).fill(0.8)],
    durationSeconds: 3,
  }).filter((f) => f.viseme !== REST_VISEME).length >= visemesFromText("namaste dosto").filter((s) => s.viseme !== REST_VISEME).length - 1,
  "har hisse par naya kadam shuru karne se chhote hisse par shabd chhoot jaate hain",
);

console.log("\nlamhe se shape");

check("shuruaat par pehla shape", visemeAt(allLoud, 0).viseme === allLoud[0]?.viseme);
check("bahut aage ka lamha aakhri shape deta hai", visemeAt(allLoud, 99).viseme === REST_VISEME);
check("khaali track par aaram", visemeAt([], 1).viseme === REST_VISEME);
check(
  "shuruaat se pehle ka lamha bhi kuch deta hai",
  knownViseme(visemeAt(allLoud, -5).viseme),
  "render har frame par yahi poochhta hai — yahan undefined lautna matlab poora frame khaali",
);

/* ---------------------------------------------------------------- emotion */

console.log("\nemotion");

check("default emotion registry me hai", getEmotion(DEFAULT_EMOTION) !== undefined);
check("har emotion ka apna naam hai", EMOTIONS.every((e) => e.label.trim().length > 0));
check("koi id do baar nahi", new Set(EMOTIONS.map((e) => e.id)).size === EMOTIONS.length);
check(
  "khush aur dukhi ke honth ulti taraf jaate hain",
  (getEmotion("happy")?.mouthCorner ?? 0) > 0 && (getEmotion("sad")?.mouthCorner ?? 0) < 0,
  "iske bina dono bilkul ek jaise dikhte hain",
);
check(
  "hairaan par bhaunh sabse upar",
  EMOTIONS.every((e) => e.brow <= (getEmotion("surprised")?.brow ?? 0)),
);
check(
  "kisi bhi emotion par sir rukta nahi",
  EMOTIONS.every((e) => e.swaySpeed > 0),
  "bilkul sthir sir ek tasveer jaisa lagta hai, bolta hua insaan nahi",
);
check("anjaan id par undefined", getEmotion("nahi-hai") === undefined);
check(
  "render ko hamesha kuch milta hai",
  emotionOrDefault("nahi-hai").id === DEFAULT_EMOTION &&
    emotionOrDefault(null).id === DEFAULT_EMOTION &&
    emotionOrDefault(undefined).id === DEFAULT_EMOTION,
  "purani doc me hataayi hui emotion par poora chehra sthir ho jaata — bina error ke",
);
check("maujood id apni hi lautti hai", emotionOrDefault("sad").id === "sad");
check(
  "saada emotion sach me saada hai",
  getEmotion(DEFAULT_EMOTION)!.brow === 0 && getEmotion(DEFAULT_EMOTION)!.mouthCorner === 0,
);

/* ------------------------------------------------------------- chehre ka data */

console.log("\nchehre ka data padhna");

const face = sampleFace();

check("banaya hua chehra khud padha jaata hai", readFaceData(face) !== null);
check("null par null", readFaceData(null) === null);
check("kachra par null", readFaceData({ hello: 1 }) === null);
check(
  "purane version par null",
  readFaceData({ ...face, version: 99 }) === null,
  "shape badalne par purana data chup-chaap aadha chehra maan liya jaata",
);
check(
  "bina honth ke null",
  readFaceData({ ...face, lipsOuter: [] }) === null,
  "honth ke bina ye data kisi kaam ka nahi — aur wahi is feature ka aadhaar hai",
);
check(
  "galat point par null",
  readFaceData({ ...face, lipsOuter: [{ x: "a", y: 1 }] }) === null,
);
check(
  "aankh khaali ho to bhi chalta hai",
  readFaceData({ ...face, leftEye: [] }) !== null,
  "unke bina chehra kam zinda lagta hai, par bolta phir bhi hai",
);

/* ------------------------------------------------------------------ mesh */

console.log("\nmuh ka mesh");

const size = { width: 1080, height: 1920 };
const rest = getVisemeShape(REST_VISEME)!;
const aa = getVisemeShape("AA")!;
const oo = getVisemeShape("OO")!;
const ee = getVisemeShape("EE")!;
const neutral = getEmotion("neutral")!;
const happy = getEmotion("happy")!;
const sad = getEmotion("sad")!;

const region = mouthRegion(face, size)!;
check("muh ka ilaaka mil jaata hai", region !== null);
check(
  "ilaaka muh se chaura hai",
  region.right - region.left > region.mouthWidth,
  "kinare tak kheenchav 0 hone ke liye jagah chahiye",
);
check("ilaake me thodi bhi aati hai", region.bottom > region.lipBottom);
check("ilaaka tasveer ke andar hi rehta hai", region.left >= 0 && region.right <= size.width);

const still = buildMouthMesh({ face, size, shape: aa, intensity: 0, emotion: neutral });
check(
  "bina zor ke mesh kuch nahi kheenchta",
  still.every((t) => t.from.every((p, at) => near(p.x, t.to[at]!.x) && near(p.y, t.to[at]!.y))),
  "chup lamhe par muh apni jagah rehna chahiye",
);

const open = buildMouthMesh({ face, size, shape: aa, intensity: 1, emotion: neutral });
check("khulne par honth sach me hilte hain", open.some((t) => t.from.some((p, at) => Math.abs(p.y - t.to[at]!.y) > 1)));
check("har triangle ke teen point hain", open.every((t) => t.from.length === 3 && t.to.length === 3));
check("mesh ki ginti tay hai", open.length === still.length && open.length > 0);

/*
 * ⚠️ Ye is poori file ka sabse zaroori niyam hai — kinara hila to muh ke chaaron
 * taraf ek chaukor ka nishaan dikhne lagta hai.
 */
const onEdge = (p: { x: number; y: number }): boolean =>
  near(p.x, region.left, 1e-6) ||
  near(p.x, region.right, 1e-6) ||
  near(p.y, region.top, 1e-6) ||
  near(p.y, region.bottom, 1e-6);

check(
  "ilaake ka kinara kabhi nahi hilta",
  open.every((t) =>
    t.from.every((p, at) => !onEdge(p) || (near(p.x, t.to[at]!.x, 1e-6) && near(p.y, t.to[at]!.y, 1e-6))),
  ),
  "kinara hilne par kheenche hue hisse aur baaki tasveer ke beech ek saaf lakeer ban jaati hai",
);

const half = buildMouthMesh({ face, size, shape: aa, intensity: 0.5, emotion: neutral });
const travel = (mesh: typeof open): number =>
  Math.max(...mesh.map((t) => Math.max(...t.from.map((p, at) => Math.abs(t.to[at]!.y - p.y)))));
check(
  "aadhe zor par aadha khulta hai",
  Math.abs(travel(half) * 2 - travel(open)) < 1,
  "bina iske dheeme bole gaye hisse par bhi muh poora khulta hai — cheekh jaisa",
);

check(
  "khule muh me band muh se zyada harkat hai",
  travel(open) > travel(buildMouthMesh({ face, size, shape: rest, intensity: 1, emotion: neutral })),
);

check(
  "upar wala honth jabde ke saath neeche nahi jaata",
  displacePoint({ x: region.centerX, y: region.lipTop }, { region, shape: aa, intensity: 1, emotion: neutral }).y <=
    region.lipTop + 1e-6,
);
check(
  "neeche wala honth neeche jaata hai",
  displacePoint({ x: region.centerX, y: region.lipBottom }, { region, shape: aa, intensity: 1, emotion: neutral }).y >
    region.lipBottom + 1,
);

const wideAt = (shape: typeof ee): number => {
  const p = { x: region.centerX + region.mouthWidth / 3, y: (region.lipTop + region.lipBottom) / 2 };
  return displacePoint(p, { region, shape, intensity: 1, emotion: neutral }).x - p.x;
};
check("chaura shape honth ko bahar le jaata hai", wideAt(ee) > 0);
check("gol shape honth ko andar lata hai", wideAt(oo) < 0);

const cornerY = (emotion: typeof happy): number => {
  const p = { x: region.centerX + region.mouthWidth / 2, y: (region.lipTop + region.lipBottom) / 2 };
  return displacePoint(p, { region, shape: rest, intensity: 0, emotion }).y;
};
check(
  "khush par kone upar jaate hain, dukhi par neeche",
  cornerY(happy) < cornerY(neutral) && cornerY(sad) > cornerY(neutral),
  "iske bina dono bilkul ek jaise dikhte hain",
);
check(
  "emotion chup rehne par bhi dikhta hai",
  Math.abs(cornerY(happy) - cornerY(neutral)) > 0.5,
  "zor se baandh dene par aadmi sannate me saada dikhta aur bolte hi khush ho jaata",
);

check("bina honth wale chehre par mesh khaali", buildMouthMesh({ face: { ...face, lipsOuter: [] }, size, shape: aa, intensity: 1, emotion: neutral }).length === 0);
check("naap 0 par mesh khaali", buildMouthMesh({ face, size: { width: 0, height: 0 }, shape: aa, intensity: 1, emotion: neutral }).length === 0);
check(
  "har triangle se matrix ban jaati hai",
  open.every((t) => affineFromTriangles(t.from, t.to) !== null),
  "jis triangle ki matrix na bane wo tukda render me gayab ho jaata hai",
);

/* -------------------------------------------------- schema aur registry */

console.log("\nschema — sirf juda hai, badla kuch nahi");

check(
  "aam item par bolti tasveer ka data null hota hai",
  createItem("image").talkingPhoto === null,
);
check(
  "purana doc bina is khaane ke bhi khulta hai",
  parseDoc(createEmptyProject({ name: "purana" })) !== null,
  "doc parse na hona matlab render fail — isliye default null zaroori hai",
);

const goodTalking = {
  voiceAssetId: "as_1",
  emotionId: DEFAULT_EMOTION,
  face,
  sourceSize: { width: 1080, height: 1350 },
  track: buildVisemeTrack({ steps: visemesFromText("namaste"), envelope: loud, durationSeconds: 1 }),
};
check("poora data schema se guzar jaata hai", TalkingPhotoSchema.safeParse(goodTalking).success);
check(
  "bina chehre ke mana",
  !TalkingPhotoSchema.safeParse({ ...goodTalking, face: undefined }).success,
  "chehre ke bina render me ek bilkul sthir chehra nikalta hai, bina kisi error ke",
);
check(
  "aadhe chehre par mana",
  !TalkingPhotoSchema.safeParse({ ...goodTalking, face: { ...face, lipsOuter: [] } }).success,
);
check(
  "hadd se bahar zor par mana",
  !TalkingPhotoSchema.safeParse({
    ...goodTalking,
    track: [{ atSeconds: 0, viseme: "AA", intensity: 5 }],
  }).success,
);
check("bina awaaz ke bhi jaayaz hai", TalkingPhotoSchema.safeParse({ ...goodTalking, voiceAssetId: null }).success);
check(
  "bina naap ke mana",
  !TalkingPhotoSchema.safeParse({ ...goodTalking, sourceSize: undefined }).success,
  "naap ke bina chaudi tasveer par muh khisak kar chehre se bahar chala jaata hai",
);

console.log("\nregistry — naya item type, par koi naya scene type nahi");

check("naya item type registry me hai", getItemType("talking_photo") !== undefined);
check(
  "uska apna renderer hai",
  getItemType("talking_photo")?.componentKey === "TalkingPhotoItem",
);
check("wo tasveer maangta hai", getItemType("talking_photo")?.needsAsset === true);
check("purana image type waisa ka waisa hai", getItemType("image")?.componentKey === "ImageItem");

check(
  "koi naya SCENE type nahi jodha gaya",
  getSceneType("talking_photo") === undefined,
  "sceneTypesForPrompt() saare scene type AI ke HAR prompt me bhejta hai — naya jodne se har purani reel ka prompt badal jaata",
);
check(
  "AI ko dikhne wale scene type utne hi hain jitne pehle the",
  listSceneTypes().length === 12,
  "ye ginti badal jaaye to AI ka prompt badal chuka hai — aur wo maujooda reel ka vyavhaar badalna hai",
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
