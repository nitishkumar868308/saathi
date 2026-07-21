/**
 * Apka Saathi — final logo + app icon generator.  Sab kuch LOCAL.
 *
 * Chalao:  node brand/build-logo.js
 * Output:  brand/svg/*.svg   aur   brand/png/*.png|jpg
 *
 * MARK ka idea — "AS", do dost:
 *   A  = aap        — chaudi, gol sire wali, sthir
 *   S  = Saathi     — thodi jhuki hui, aur uska upar wala hissa A ke
 *                     KANDHE pe se aage se guzarta hai (haath rakhna)
 * Dono alag padhte hain, milte sirf ek jagah hain — wahi dosti hai.
 */
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "web", "node_modules", "sharp"));

const SVG_DIR = path.join(__dirname, "svg");
const PNG_DIR = path.join(__dirname, "png");
fs.mkdirSync(SVG_DIR, { recursive: true });
fs.mkdirSync(PNG_DIR, { recursive: true });

const C = {
  terracotta: "#C25A37",
  terracottaDeep: "#A8492B",
  amber: "#E0A458",
  gold: "#F2B45E",
  cream: "#F7F2E9",
  ink: "#2E2823",
};

/* -------------------------------- mark -------------------------------- */
function mark(cA, cS) {
  const swA = 58;
  const swS = 52;
  return `
  <g transform="translate(256 256) scale(0.9) translate(-248 -266)"
     fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M104 380 L160 210 C174 148 222 148 236 210 L292 380" stroke="${cA}" stroke-width="${swA}"/>
    <path d="M148 308 L248 308" stroke="${cA}" stroke-width="${swA - 10}"/>
    <g transform="rotate(-4 320 260)">
      <path d="M374 198 C374 166 344 150 316 154 C288 158 264 178 268 206
               C280 232 306 244 332 254 C362 265 388 283 388 315
               C388 351 356 372 322 368" stroke="${cS}" stroke-width="${swS}"/>
    </g>
  </g>`;
}

const doc = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

const TILE_BG = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#CA6440"/><stop offset="1" stop-color="#AE4D2B"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="114" fill="url(#bg)"/>`;

/* ------------------------------- files -------------------------------- */
const files = {
  // app icon
  "app-icon.svg": doc(512, 512, TILE_BG + mark(C.cream, C.gold)),
  // mark alone
  "mark-light-bg.svg": doc(512, 512, mark(C.terracotta, C.amber)),
  "mark-dark-bg.svg": doc(512, 512, mark(C.cream, C.gold)),
  "mark-mono.svg": doc(512, 512, mark(C.ink, C.ink)),
  // alt icon: cream tile
  "badge.svg": doc(
    512,
    512,
    `<rect width="512" height="512" rx="114" fill="${C.cream}"/>` + mark(C.terracotta, C.amber),
  ),
};

/* ------------------------------ lockups ------------------------------- */
function lockup({ bg, markA, markS, apka, saathi, tag, tagColor }) {
  return doc(
    1500,
    460,
    `${bg ? `<rect width="1500" height="460" fill="${bg}"/>` : ""}
     <g transform="translate(-10,10) scale(0.86)">${mark(markA, markS)}</g>
     <text x="430" y="212" font-family="Segoe UI, Arial, sans-serif" font-size="142" font-weight="700" letter-spacing="-3" fill="${apka}">Apka</text>
     <text x="430" y="356" font-family="Segoe UI, Arial, sans-serif" font-size="142" font-weight="700" letter-spacing="-3" fill="${saathi}">Saathi</text>
     <text x="436" y="414" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" letter-spacing="7" fill="${tagColor}">${tag}</text>`,
  );
}

files["lockup-light.svg"] = lockup({
  bg: "#FBF7F0",
  markA: C.terracotta,
  markS: C.amber,
  apka: C.ink,
  saathi: C.terracotta,
  tag: "JO KUCH NAHI BHOOLTA",
  tagColor: "#8A7B6C",
});
files["lockup-dark.svg"] = lockup({
  bg: C.terracotta,
  markA: C.cream,
  markS: C.gold,
  apka: C.cream,
  saathi: C.gold,
  tag: "JO KUCH NAHI BHOOLTA",
  tagColor: "#F0DFC8",
});

for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(SVG_DIR, name), svg, "utf8");
}

/* -------------------------------- PNGs -------------------------------- */
const square = [
  ["app-icon.svg", "app-icon", [1024, 512, 192, 96, 48]],
  ["mark-light-bg.svg", "mark-light-bg", [800]],
  ["mark-dark-bg.svg", "mark-dark-bg", [800]],
  ["mark-mono.svg", "mark-mono", [800]],
  ["badge.svg", "badge", [512]],
];

(async () => {
  for (const [src, base, sizes] of square) {
    const buf = fs.readFileSync(path.join(SVG_DIR, src));
    for (const s of sizes) {
      await sharp(buf, { density: 400 }).resize(s, s).png().toFile(path.join(PNG_DIR, `${base}-${s}.png`));
      console.log("png:", `${base}-${s}.png`);
    }
  }
  for (const src of ["lockup-light", "lockup-dark"]) {
    const buf = fs.readFileSync(path.join(SVG_DIR, src + ".svg"));
    await sharp(buf, { density: 400 }).resize({ width: 1500 }).png().toFile(path.join(PNG_DIR, src + "-1500.png"));
    console.log("png:", src + "-1500.png");
  }
  await sharp(fs.readFileSync(path.join(SVG_DIR, "lockup-light.svg")), { density: 400 })
    .resize({ width: 1500 })
    .flatten({ background: "#FBF7F0" })
    .jpeg({ quality: 92 })
    .toFile(path.join(PNG_DIR, "lockup-light-1500.jpg"));
  console.log("jpg: lockup-light-1500.jpg");
  console.log("\nDone -> brand/svg/ , brand/png/");
})();
