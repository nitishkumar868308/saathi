// Web ke liye 2 clean logo — tumhare ASLI files se (svg48 + text), redraw nahi.
//  1) icon-square.png  — clean teal icon (bina wordmark) — chhote square spots.
//  2) logo-horizontal.png — teal icon + "Apka Saathi" wordmark, transparent — header/footer.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(__dirname, "..", "public");
const SRC = resolve(PUB, "svg48.png");
const TEAL = "#125156";
const GOLD = "#C79A4E";

// --- svg48 -> full-bleed teal square (white/halo -> teal) ---
const { data, info } = await sharp(SRC).trim().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
for (let i = 0; i < data.length; i += C) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (r > 208 && g > 198 && b > 188) {
    data[i] = 18; data[i + 1] = 81; data[i + 2] = 86;
  }
}
const tealSquare = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();

function roundedMask(size, r) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`,
  );
}

// 1) clean square icon (512, rounded)
await sharp(tealSquare)
  .resize(512, 512, { fit: "fill" })
  .composite([{ input: roundedMask(512, 96), blend: "dest-in" }])
  .png()
  .toFile(resolve(PUB, "icon-square.png"));
console.log("✓ icon-square.png");

// 2) horizontal lockup (transparent): [rounded teal icon] + "Apka Saathi"
const IH = 132; // icon height
const iconR = await sharp(tealSquare)
  .resize(IH, IH, { fit: "fill" })
  .composite([{ input: roundedMask(IH, 30), blend: "dest-in" }])
  .png()
  .toBuffer();

// wordmark text -> trim to content
const wmSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${IH}">
  <text x="0" y="94" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700">
    <tspan fill="${TEAL}">Apka</tspan><tspan fill="${GOLD}" dx="26">Saathi</tspan>
  </text></svg>`;
const wm = await sharp(Buffer.from(wmSvg)).png().trim().toBuffer();
const wmMeta = await sharp(wm).metadata();

const GAP = 30;
const totalW = IH + GAP + (wmMeta.width ?? 400);
await sharp({
  create: { width: totalW, height: IH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: iconR, left: 0, top: 0 },
    { input: wm, left: IH + GAP, top: Math.round((IH - (wmMeta.height ?? IH)) / 2) },
  ])
  .png()
  .toFile(resolve(PUB, "logo-horizontal.png"));
console.log("✓ logo-horizontal.png", totalW + "x" + IH);
