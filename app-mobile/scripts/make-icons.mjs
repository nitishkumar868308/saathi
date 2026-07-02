// Saathi app icons generator — SVG se PNG (sharp).
// Chalao: node scripts/make-icons.mjs
import sharp from "sharp";

const OUT = "assets/images";
const SIZE = 1024;

// Lucide-style heart path (24x24 viewBox)
const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z";

function svg({ withBg, heartColor, scale }) {
  const tx = SIZE / 2;
  const ty = SIZE / 2;
  const bg = withBg
    ? `<rect width="${SIZE}" height="${SIZE}" rx="235" fill="url(#g)"/>`
    : "";
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E0A458"/>
      <stop offset="1" stop-color="#C25A37"/>
    </linearGradient>
  </defs>
  ${bg}
  <g transform="translate(${tx} ${ty}) scale(${scale}) translate(-12 -11.6)">
    <path d="${HEART}" fill="${heartColor}"/>
  </g>
</svg>`;
}

async function render(config, file, outSize) {
  await sharp(Buffer.from(svg(config)))
    .resize(outSize, outSize)
    .png()
    .toFile(`${OUT}/${file}`);
  console.log("✓", file);
}

// 1. App icon (iOS + general): gradient rounded bg + cream heart
await render({ withBg: true, heartColor: "#FFFCF6", scale: 24 }, "icon.png", 1024);

// 2. Android adaptive foreground: cream heart on transparent (bg = terracotta via app.json), safe-zone sized
await render({ withBg: false, heartColor: "#FFFCF6", scale: 20 }, "adaptive-foreground.png", 1024);

// 3. Splash: terracotta heart on transparent (shows on cream splash bg)
await render({ withBg: false, heartColor: "#C25A37", scale: 20 }, "splash-icon.png", 512);

// 4. Favicon (web)
await render({ withBg: true, heartColor: "#FFFCF6", scale: 24 }, "favicon.png", 96);

console.log("Done — icons in", OUT);
