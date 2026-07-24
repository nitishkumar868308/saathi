// Apka Saathi — asli app-icon (public/svg48.png) se saare zaroori sizes.
// svg48 = teal rounded-square (gold AS + hug + handshake) white bg pe.
// White ko teal se replace karke full-bleed teal icon banate hain, phir resize.
//
// Chalao (web/ me):  node scripts/app-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP = resolve(ROOT, "app-mobile", "assets", "images");
const WEBPUB = resolve(ROOT, "web", "public");
const WEBAPP = resolve(ROOT, "web", "app");
const SRC = resolve(WEBPUB, "svg48.png");

// 1) Trim white border + raw pixels.
const { data, info } = await sharp(SRC)
  .trim()
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// 2) Teal color = left-center edge ka pixel (bg).
const sx = Math.floor(W * 0.05);
const sy = Math.floor(H * 0.5);
const si = (sy * W + sx) * C;
const TEAL = [data[si], data[si + 1], data[si + 2]];
console.log("teal bg:", TEAL);

// 3) White / light halo (corners) ko teal bana do — gold mark (b~78) safe.
for (let i = 0; i < data.length; i += C) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (r > 208 && g > 198 && b > 188) {
    data[i] = TEAL[0];
    data[i + 1] = TEAL[1];
    data[i + 2] = TEAL[2];
  }
}
const tealHex = "#" + TEAL.map((n) => n.toString(16).padStart(2, "0")).join("");

// Full-bleed teal square (base).
const base = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();

async function square(size, out) {
  await sharp(base).resize(size, size, { fit: "fill" }).png().toFile(out);
  console.log("✓", out);
}

// Adaptive foreground: teal square ~76% center, baaki transparent (bg color = teal).
async function adaptive(size, out) {
  const inner = Math.round(size * 0.76);
  const pad = Math.round((size - inner) / 2);
  const fg = await sharp(base).resize(inner, inner, { fit: "fill" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, left: pad, top: pad }])
    .png()
    .toFile(out);
  console.log("✓", out);
}

// Mobile
await square(1024, resolve(APP, "icon.png"));
await adaptive(1024, resolve(APP, "adaptive-foreground.png"));
await square(512, resolve(APP, "splash-icon.png"));
await square(196, resolve(APP, "favicon.png"));
// Web
await square(512, resolve(WEBPUB, "logo.png"));
await square(128, resolve(WEBPUB, "logo-128.png"));
await square(512, resolve(WEBAPP, "icon.png"));

console.log("\nADAPTIVE BG (app.json me daalo):", tealHex);
console.log("Sab icons ban gaye 🎉");
