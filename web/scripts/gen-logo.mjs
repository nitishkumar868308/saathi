// Apka Saathi mascot se web logo PNG banata hai (email/OG/share ke liye).
// Chalane ke liye:  cd web && node scripts/gen-logo.mjs   (sharp devDependency)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public");

const TERRA = "#C25A37";
const CREAM = "#FBF5EA";

const MASCOT =
  "M50 12 C70 12 82 26 82 47 L82 62 C82 79 68 87 50 87 C32 87 18 79 18 62 L18 47 C18 26 30 12 50 12 Z M32 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M54 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M39.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M61.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M26.5 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M66.7 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M39 60 Q50 70 61 60 Q50 64.5 39 60 Z";

const mark = (tx, ty, scale) =>
  `<path transform="translate(${tx} ${ty}) scale(${scale})" fill="${CREAM}" fill-rule="evenodd" d="${MASCOT}"/>`;

// Rounded terracotta tile + centered cream mascot.
function tileSvg(size) {
  const s = size / 100; // mascot 0..100 viewBox
  const scale = s * 0.62;
  const t = (size - 100 * scale) / 2;
  const rx = Math.round(size * 0.25);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${rx}" fill="${TERRA}"/>
    ${mark(t, t, scale)}
  </svg>`;
}

async function main() {
  // Transparent-corner PNGs (rounded tile). Email/share ke liye.
  await sharp(Buffer.from(tileSvg(512))).png().toFile(join(OUT, "logo.png"));
  await sharp(Buffer.from(tileSvg(128))).png().toFile(join(OUT, "logo-128.png"));
  // White-background JPG (jahan transparency na chale).
  await sharp(Buffer.from(tileSvg(512)))
    .flatten({ background: "#FFFFFF" })
    .jpeg({ quality: 90 })
    .toFile(join(OUT, "logo.jpg"));
  console.log("Done -> web/public/logo.png, logo-128.png, logo.jpg");
}

main();
