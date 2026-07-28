/**
 * Open Graph image generator — `app/opengraph-image.png` banata hai.
 *
 * Chalao: `node scripts/gen-og.mjs` (sirf tab jab text ya brand badle).
 *
 * ⚠️ Pehle yahan `next/og` ka `ImageResponse` tha jo har request par image
 * banata tha. Do dikkatein thi: Windows par `next build` hi fail ho jaata tha
 * (@vercel/og ka node binary `fileURLToPath` par crash karta hai), aur har
 * social preview par server ko ek image render karni padti thi.
 *
 * Ab image ek baar yahan se ban ke repo me chali jaati hai. Build kahin bhi
 * chalta hai, aur preview turant load hota hai kyunki wo ek saada static PNG hai.
 */
import sharp from "sharp";
import fs from "fs";

const W = 1200, H = 630;
const logo = fs.readFileSync("public/icon-256.png").toString("base64");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g1" cx="15%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#E0A458" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#E0A458" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="88%" cy="82%" r="55%">
      <stop offset="0%" stop-color="#C25A37" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#C25A37" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="r"><rect x="80" y="72" width="88" height="88" rx="26"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="#F7F2E9"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>

  <image href="data:image/png;base64,${logo}" x="80" y="72" width="88" height="88" clip-path="url(#r)"/>
  <text x="186" y="130" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="42" font-weight="700" fill="#2E2823">Apka Saathi</text>

  <text x="80" y="290" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#2E2823" letter-spacing="-2">Never forget what</text>
  <text x="80" y="378" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#C25A37" letter-spacing="-2">matters.</text>

  <text x="80" y="452" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="31" fill="#6B5F54">Reminders for documents, medicines and bills —</text>
  <text x="80" y="496" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="31" fill="#6B5F54">in Hindi, English or a mix of both.</text>

  <rect x="80" y="540" width="286" height="52" rx="26" fill="#C25A37"/>
  <text x="112" y="574" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#FFFFFF">Free on Android</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toFile("app/opengraph-image.png");
console.log("written");
