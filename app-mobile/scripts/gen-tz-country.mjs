#!/usr/bin/env node
/**
 * `src/lib/tz-country.ts` banata hai — IANA timezone se country code.
 *
 * Chalao:  cd app-mobile && node scripts/gen-tz-country.mjs
 *
 * Kyun chahiye: VPN IP badal deta hai, par phone ka TIMEZONE nahi badalta.
 * Isliye "IP kya kehta hai" aur "phone ki ghadi kya kehti hai" — dono milaakar
 * pata chal jaata hai ki koi apni jagah chhupa raha hai.
 *
 * Data IANA ke `zone1970.tab` se — wahi jo har OS ka timezone database hai.
 * Ye ek snapshot hai; saal me ek baar dobara chala lena kaafi hai (naye zone
 * bahut kam bante hain).
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = "https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab";
/**
 * Purane zone naam (aliases).
 *
 * ⚠️ Ye bahut zaroori hai. `zone1970.tab` me sirf CANONICAL naam hain —
 * "Asia/Kolkata". Par Android/JS engine aksar purana alias lautate hain —
 * "Asia/Calcutta". Sirf canonical map rakhne par Indian users ka timezone
 * pehchana hi nahi jaata aur check chup-chaap band pada rehta.
 * (Isi tarah Asia/Saigon, Europe/Kiev, Asia/Rangoon waghera.)
 */
const BACKWARD = "https://raw.githubusercontent.com/eggert/tz/main/backward";

const [text, backward] = await Promise.all([
  fetch(SRC).then((r) => {
    if (!r.ok) throw new Error(`zone1970.tab fetch fail: ${r.status}`);
    return r.text();
  }),
  fetch(BACKWARD).then((r) => {
    if (!r.ok) throw new Error(`backward fetch fail: ${r.status}`);
    return r.text();
  }),
]);

/** zone -> country. Ek zone kai countries me ho sakta hai; pehla hi lete hain. */
const map = {};
for (const line of text.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const cols = line.split("\t");
  if (cols.length < 3) continue;
  const countries = cols[0].split(",").map((c) => c.trim().toUpperCase());
  const zone = cols[2].trim();
  if (!zone || !countries[0]) continue;
  // ⚠️ Pehla country hi lete hain. Kuch zones do deshon me hote hain (jaise
  // Europe/Zurich = CH aur DE/IT ke kuch hisse). Aise me thoda jhol reh jaata
  // hai — isi wajah se neeche wala check "shak" batata hai, "pakka VPN" nahi.
  if (!map[zone]) map[zone] = countries[0];
}

// Purane naam bhi map me daalo — "Link  Asia/Kolkata  Asia/Calcutta".
let aliasCount = 0;
for (const line of backward.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const m = line.trim().split(/\s+/);
  if (m[0] !== "Link" || m.length < 3) continue;
  const [, target, alias] = m;
  if (map[target] && !map[alias]) {
    map[alias] = map[target];
    aliasCount++;
  }
}

const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));

const ts = `/**
 * IANA timezone -> country code (ISO2).
 *
 * ⚠️ Ye file apne aap banti hai — \`scripts/gen-tz-country.mjs\` se. Haath se
 * mat badalna.
 *
 * Kis kaam ki: VPN user ka IP badal deta hai, par phone ka timezone nahi
 * badalta. Dono ko milaakar \`geo-check.ts\` bata deta hai ki jagah chhupayi ja
 * rahi hai ya nahi.
 *
 * Source: ${SRC}
 * Zones: ${entries.length}
 */

const TZ_COUNTRY: Record<string, string> = {
${entries.map(([z, c]) => `  ${JSON.stringify(z)}: "${c}",`).join("\n")}
};

/**
 * Phone ke timezone se country nikaalo. Pata na chale to null.
 *
 * \`Intl\` har platform par hota hai (Hermes me bhi), isliye koi extra package
 * nahi chahiye — aur yahi is check ko sasta banata hai.
 */
export function countryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? (TZ_COUNTRY[tz] ?? null) : null;
  } catch {
    return null;
  }
}

export default TZ_COUNTRY;
`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "tz-country.ts");
writeFileSync(out, ts, "utf8");
console.log(`${entries.length} zones (${aliasCount} purane naam bhi) -> ${out}`);
