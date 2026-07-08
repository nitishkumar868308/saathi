// Saathi mascot se app icons generate karta hai (SVG -> PNG).
// Chalane ke liye:  node scripts/gen-icons.mjs   (sharp install hona chahiye)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets", "images");

const TERRA = "#C25A37";
const CREAM = "#FBF5EA";

const MASCOT =
  "M50 12 C70 12 82 26 82 47 L82 62 C82 79 68 87 50 87 C32 87 18 79 18 62 L18 47 C18 26 30 12 50 12 Z M32 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M54 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M39.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M61.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M26.5 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M66.7 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M39 60 Q50 70 61 60 Q50 64.5 39 60 Z";

const mark = (tx, ty, scale) =>
  `<path transform="translate(${tx} ${ty}) scale(${scale})" fill="${CREAM}" fill-rule="evenodd" d="${MASCOT}"/>`;

// 1. icon.png — full-bleed terracotta + centered mascot (iOS + fallback)
const iconSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${TERRA}"/>
  ${mark(232, 232, 5.6)}
</svg>`;

// 2. adaptive-foreground.png — transparent, mascot in safe zone (Android)
const adaptiveSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${mark(262, 262, 5.0)}
</svg>`;

// 3. splash-icon.png — rounded terracotta tile + mascot (cream splash pe)
const splashSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="212" y="212" width="600" height="600" rx="164" fill="${TERRA}"/>
  ${mark(302, 302, 4.2)}
</svg>`;

// 4. favicon.png — chhota tile (web)
const faviconSvg = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="32" fill="${TERRA}"/>
  <g transform="translate(20 20) scale(0.88)">${mark(0, 0, 1)}</g>
</svg>`;

const jobs = [
  ["icon.png", iconSvg, 1024],
  ["adaptive-foreground.png", adaptiveSvg, 1024],
  ["splash-icon.png", splashSvg, 1024],
  ["favicon.png", faviconSvg, 128],
];

for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, name));
  console.log("wrote", name);
}
console.log("done ✓");
