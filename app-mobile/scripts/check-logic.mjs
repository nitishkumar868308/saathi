/**
 * Do sabse khatarnak hisaabon ki jaanch — bina phone, bina build.
 *
 * ⚠️ Ye dono isliye chune gaye hain ki inka toota hona CHUP hota hai. Na koi
 * crash, na koi error — bas reminder galat khaane me chala jaata hai, ya photo
 * purani hi dikhti rehti hai. `tsc` inme se ek bhi nahi pakadta.
 *
 * Chalao:  node scripts/check-logic.mjs
 *
 * Dono module jaan-boojh ke bilkul pure hain (na React, na expo-file-system),
 * isliye seedha Node me chal jaate hain — yahi unhe alag file me rakhne ki
 * poori wajah hai.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));

/** TS file ko JS me badal ke import karo (koi build step nahi chahiye). */
async function load(rel) {
  const src = readFileSync(join(here, "..", rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

let pass = 0;
const fails = [];
function eq(what, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`${what}\n     mila : ${JSON.stringify(got)}\n     chahiye: ${JSON.stringify(want)}`);
}

/* ══════════════════ 1. Reminder ke chaar khaane ══════════════════ */

const { bucketOf } = await load("src/utils/reminder-bucket.ts");

// "Aaj" 14 Aug 2026, dopahar — bilkul wahi din jis din user ne screenshot bheja.
const NOW = new Date(2026, 7, 14, 13, 0, 0);
const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h).toISOString();
const R = (iso, is_on = true, is_paused = false) => ({ remind_at: iso, is_on, is_paused });

// ── User ki asli shikayat: 11/12 Aug ke NIPTE hue reminder "Aane wale" me the.
eq("11 Aug ka band reminder -> past", bucketOf(R(at(2026, 8, 11, 19), false), NOW), "past");
eq("12 Aug ka band reminder -> past", bucketOf(R(at(2026, 8, 12, 8), false), NOW), "past");

// ── Chalu par beeta hua = chhoot gaya (ye pehle se theek tha, toota na ho).
eq("5 Aug ka CHALU reminder -> missed", bucketOf(R(at(2026, 8, 5)), NOW), "missed");

// ── Aaj ka reminder hamesha "aaj" — chahe band ho.
eq("aaj ka chalu -> today", bucketOf(R(at(2026, 8, 14, 9)), NOW), "today");
eq("aaj ka BAND bhi -> today", bucketOf(R(at(2026, 8, 14, 9), false), NOW), "today");
eq("aaj ka subah 00:30 -> today", bucketOf(R(at(2026, 8, 14, 0)), NOW), "today");
eq("aaj ka raat 23:30 -> today", bucketOf(R(at(2026, 8, 14, 23)), NOW), "today");

// ── Aage ka.
eq("kal ka -> upcoming", bucketOf(R(at(2026, 8, 15)), NOW), "upcoming");
eq("kal ka BAND -> upcoming", bucketOf(R(at(2026, 8, 15), false), NOW), "upcoming");

// ── Paused (Plus khatam) — beeta hua ho to "past", aage ka ho to "upcoming".
eq("paused + beeta -> past", bucketOf(R(at(2026, 8, 10), true, true), NOW), "past");
eq("paused + aage -> upcoming", bucketOf(R(at(2026, 8, 20), true, true), NOW), "upcoming");

// ── Bina waqt wala reminder kabhi "beeta hua" nahi hota.
eq("remind_at null -> upcoming", bucketOf(R(null), NOW), "upcoming");
eq("remind_at null + band -> upcoming", bucketOf(R(null, false), NOW), "upcoming");
eq("kharaab date -> upcoming", bucketOf(R("kuch-bhi-nahi"), NOW), "upcoming");

/**
 * ⚠️ Sabse zaroori jaanch: chaar khaane poori list ko BAANTTE hain.
 *
 * Har reminder theek EK khaane me jaana chahiye. Yahi wo cheez hai jo pehle do
 * baar tooti — aur uska nateeja hamesha ek hi tha: reminder kisi khaane me
 * dikhta hi nahi, yaani user ke liye wo gum ho gaya.
 */
{
  const all = [];
  for (const day of [1, 5, 10, 13, 14, 15, 20, 40]) {
    for (const on of [true, false]) {
      for (const paused of [true, false]) {
        all.push(R(at(2026, 8, day), on, paused));
      }
    }
  }
  all.push(R(null), R(null, false), R("bakwaas"));

  const buckets = ["missed", "today", "upcoming", "past"];
  const counted = buckets.map((b) => all.filter((r) => bucketOf(r, NOW) === b).length);
  eq("har reminder theek ek khaane me", counted.reduce((a, b) => a + b, 0), all.length);
  eq("koi khaana khaali nahi chhoota", counted.every((n) => n > 0), true);
}

/* ══════════════════ 2. Cache ki file ka naam ══════════════════ */

const { cacheFileName, versionTag, belongsToDoc } = await load("src/utils/doc-file-name.ts");

const ID = "7c699cfe-250c-4cf0-8148-f3a512008f36";

/**
 * Server ka apna hisaab — `web/lib/storage-server.ts` ka `documentFileName()`.
 * Yahan haath se likha hai TAAKI dono alag rahein: agar kal wahan niyam badle
 * aur yahan na badle, to ye jaanch fail hogi — theek wahi hona chahiye.
 */
const serverName = (docId, ext, version) =>
  version && version > 1 ? `${docId}-v${version}.${ext}` : `${docId}.${ext}`;

// ── Pehla upload: koi version nahi.
eq("naya document (mime se ext)", cacheFileName({ id: ID, mime_type: "image/jpeg" }), `${ID}.jpg`);
eq("png", cacheFileName({ id: ID, mime_type: "image/png" }), `${ID}.png`);
eq("pdf", cacheFileName({ id: ID, mime_type: "application/pdf" }), `${ID}.pdf`);
eq("webp", cacheFileName({ id: ID, mime_type: "image/webp" }), `${ID}.webp`);

// ── ⚠️ ASLI BUG: renew ke baad naam BADALNA chahiye, warna purani photo dikhti hai.
{
  const before = cacheFileName({ id: ID, file_path: `uid/${ID}.jpg`, mime_type: "image/jpeg" });
  const after = cacheFileName({ id: ID, file_path: `uid/${ID}-v3.jpg`, mime_type: "image/jpeg" });
  eq("renew se pehle", before, `${ID}.jpg`);
  eq("renew ke baad", after, `${ID}-v3.jpg`);
  eq("renew par naam BADALTA hai (ye hi asli fix hai)", before !== after, true);
}

/**
 * ⚠️ Sabse zaroori jaanch: upload se PEHLE rakhi file, upload ke BAAD bhi usi
 * naam par mile.
 *
 * Ye dono taraf ka contract hai. Na mile to abhi-abhi rakhi hui photo "cache me
 * hai hi nahi" gini jaati hai — dobara download, aur offline me bilkul nahi
 * khulti.
 */
for (const v of [undefined, 1, 2, 3, 12]) {
  for (const [mime, ext] of [
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["application/pdf", "pdf"],
  ]) {
    const beforeUpload = cacheFileName({ id: ID, file_path: null, mime_type: mime }, v);
    const afterUpload = cacheFileName({
      id: ID,
      file_path: `uid/${serverName(ID, ext, v)}`,
      mime_type: mime,
    });
    eq(`prime==resolve (v=${v}, ${ext})`, beforeUpload, afterUpload);
    eq(`server ke naam se milta hai (v=${v}, ${ext})`, beforeUpload, serverName(ID, ext, v));
  }
}

/**
 * ⚠️ Purana version aur CURRENT document ka naam kabhi ek na ho.
 *
 * Ye wahi bug hai jise pehle `versionDocFile()` ek jugaad se rokta tha
 * (id me `-v<n>` chipka ke). Ab naam khud `file_path` se banta hai, isliye ye
 * jaanch us jugaad ki jagah leti hai — aur agar kal koi wo hisaab badle to yahi
 * sabse pehle chillayegi. Naam ek ho jaane ka matlab: history me purani photo ki
 * jagah AAJ wali photo dikhne lagti hai.
 */
{
  const current = cacheFileName({
    id: ID,
    file_path: `uid/${ID}-v3.jpg`,
    mime_type: "image/jpeg",
  });
  const older = [1, 2].map((v) =>
    cacheFileName({ id: ID, file_path: `uid/${serverName(ID, "jpg", v)}`, mime_type: "image/jpeg" }),
  );
  eq("v1 ka naam", older[0], `${ID}.jpg`);
  eq("v2 ka naam", older[1], `${ID}-v2.jpg`);
  eq("current ka naam", current, `${ID}-v3.jpg`);
  eq("teeno naam alag hain", new Set([current, ...older]).size, 3);
  eq("teeno isi doc ke gine jaate hain", [current, ...older].every((n) => belongsToDoc(n, ID)), true);
}

// ── versionTag ke kinare.
eq("bina version", versionTag(`uid/${ID}.jpg`), "");
eq("v2", versionTag(`uid/${ID}-v2.jpg`), "-v2");
eq("v1234", versionTag(`uid/${ID}-v1234.png`), "-v1234");
eq("null", versionTag(null), "");
eq("beech me dot -> version nahi", versionTag("uid/report-v2.final.pdf"), "");

// ── ⚠️ Ext me slash cache folder se BAHAR le ja sakta tha.
eq(
  "gandi file_path se ext nahi liya jaata",
  cacheFileName({ id: ID, file_path: "a/b.c/d", mime_type: "image/png" }),
  `${ID}.png`,
);

// ── Cache saaf karte waqt: sirf ISI document ki files.
eq("apni file", belongsToDoc(`${ID}.jpg`, ID), true);
eq("apna purana version", belongsToDoc(`${ID}-v2.png`, ID), true);
eq("apni adhoori download", belongsToDoc(`${ID}-v2.jpg.part`, ID), true);
eq("kisi aur ki file", belongsToDoc("9999abcd.jpg", ID), false);
eq("aisi id jo humari se shuru hoti hai", belongsToDoc(`${ID}extra.jpg`, ID), false);

/* ══════════════════ 4. Galat status wale jawab ka body ══════════════════ */

/*
 * ⚠️ Ye jaanch ek asli error se aayi hai: admin > Logs me `{"message":""}`
 * chhapta tha, jisse kabhi pata nahi chalta tha ki 500 tha, 403 tha, ya beech
 * me network kat gaya. Poori wajah src/lib/http-error-body.ts ke upar likhi hai.
 */

const { errorBodyFor } = await load("src/lib/http-error-body.ts");

const parse = (out) => (out === null ? null : JSON.parse(out));

// ── Wahi haalat jisse asli error aayi thi: galat status + bilkul khaali body.
eq("khaali body par status milta hai", parse(errorBodyFor(502, "Bad Gateway", "")), {
  message: "HTTP 502 Bad Gateway — server ne khaali jawab bheja",
  code: "HTTP_502",
});

// ── statusText na ho tab bhi status to dikhna hi chahiye.
eq("bina statusText ke bhi", parse(errorBodyFor(500, "", "   ")), {
  message: "HTTP 500 — server ne khaali jawab bheja",
  code: "HTTP_500",
});

// ── Captive portal / proxy ka HTML — ye "khaali" se alag haalat hai.
eq(
  "JSON na hone par jo aaya wo bhi likha jaata hai",
  parse(errorBodyFor(403, "Forbidden", "<html>login karo</html>")),
  {
    message: "HTTP 403 Forbidden — jawab JSON nahi tha: <html>login karo</html>",
    code: "HTTP_403",
  },
);

// ── ⚠️ Asli error body ke UPAR kabhi nahi likha jaata — usme sach pehle se hai.
eq(
  "PostgREST ka apna error waisa ka waisa",
  errorBodyFor(400, "Bad Request", '{"message":"column x nahi hai","code":"42703"}'),
  null,
);

// ── ⚠️ 404 + khaali body ko chhedna "koi row nahi mili" ko error bana deta hai.
eq("404 + khaali body chhoda jaata hai", errorBodyFor(404, "Not Found", ""), null);
eq(
  "par 404 ke saath kuch aaya ho to wo likha jaata hai",
  parse(errorBodyFor(404, "Not Found", "nope")),
  { message: "HTTP 404 Not Found — jawab JSON nahi tha: nope", code: "HTTP_404" },
);

/* ══════════════════ 5. Document lene ka faisla ══════════════════ */

const { intakeVerdict, isPdf, normalizeMime, MAX_FILE_BYTES } = await load(
  "src/utils/doc-intake.ts",
);

const OK = { bytes: 1000, failure: null };

// ── Selfie: AI chala, kuch mila hi nahi -> ROK.
eq("unclear -> rok", intakeVerdict({ ...OK, failure: "unclear" }), {
  save: false,
  note: "noDocument",
});

// ── Net nahi: AI chala hi nahi -> save hone do. Yahan rokna sabse bada nuksan:
//    user ka ASLI document uske haath me hai aur app use ghusne nahi de rahi.
eq("offline -> save", intakeVerdict({ ...OK, failure: "offline" }), {
  save: true,
  note: "offline",
});

// ── Gemini bhara / dheema -> save hone do.
eq("busy -> save", intakeVerdict({ ...OK, failure: "busy" }), { save: true, note: "busy" });
eq("slow -> save", intakeVerdict({ ...OK, failure: "slow" }), { save: true, note: "busy" });

// ── Server ki dikkat -> save hone do.
eq("server -> save", intakeVerdict({ ...OK, failure: "server" }), {
  save: true,
  note: "failed",
});

// ── AI ne theek padha.
eq("ok -> save", intakeVerdict(OK), { save: true, note: "none" });

// ── 5MB SAKHT hadd — theek 5MB chalta hai, usse ek byte upar nahi.
eq("5MB theek", intakeVerdict({ bytes: MAX_FILE_BYTES, failure: null }), {
  save: true,
  note: "none",
});
eq("5MB+1 -> rok", intakeVerdict({ bytes: MAX_FILE_BYTES + 1, failure: null }), {
  save: false,
  note: "tooBig",
});

// ── ⚠️ Badi file par SIZE ki baat pehle aati hai — AI us par chala hi nahi tha.
//    Ulta hone par app "isme koi document nahi mila" kehti aur user saaf photo
//    dobara kheenchta rehta, jabki dikkat size ki thi.
eq(
  "badi file, unclear -> tooBig",
  intakeVerdict({ bytes: MAX_FILE_BYTES + 1, failure: "unclear" }),
  { save: false, note: "tooBig" },
);

/**
 * ── ⚠️ mime ka saaf hona — ye chhota dikhta hai par mehnga hai.
 *
 * `DocumentPicker` mime ke saath `; charset=...` laga kar de sakta hai, aur
 * `doc-file-name.ts` ka `extForMime()` sirf THEEK `application/pdf` pehchanta
 * hai. Bina saaf kiye PDF cache me `.jpg` naam par baith jaati, aur phir wahan
 * dhoondhi hi nahi jaati — yaani abhi-abhi rakhi file offline me nahi khulti.
 */
eq("mime saaf", normalizeMime("application/pdf; charset=binary"), "application/pdf");
eq("mime chhota", normalizeMime("IMAGE/JPEG"), "image/jpeg");
eq("mime ke aas-paas ki jagah", normalizeMime("  application/pdf  "), "application/pdf");
eq("khaali mime", normalizeMime(null), "");

// ── PDF pehchano.
eq("pdf", isPdf("application/pdf"), true);
eq("pdf with charset", isPdf("application/pdf; charset=binary"), true);
eq("jpeg pdf nahi", isPdf("image/jpeg"), false);
eq("khaali pdf nahi", isPdf(null), false);

/* ══════════════════ 6. Expiry ki khabar ka lamha ══════════════════ */

const { expiryNoticeMomentIso } = await load("src/utils/expiry.ts");

/**
 * Server ka apna hisaab — `web/app/api/cron/document-expiry/route.ts` ka
 * `noticeMoment()`. Yahan HAATH SE likha hai, taaki dono alag rahein: kal wahan
 * niyam badle aur yahan na badle, to ye jaanch fail hogi — theek wahi hona
 * chahiye.
 *
 * ⚠️ Ye milna kyun zaroori hai: app aur server dono apni delivery-row ISI lamhe
 * par likhte hain. Alag hote hi ek khabar do tukdon me bant jaati hai — ek me
 * sirf notification, doosre me sirf email/WhatsApp — aur admin ko poori tasveer
 * kabhi nahi dikhti.
 */
const serverMoment = (expiry, lead) => {
  const [y, m, d] = expiry.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  return new Date(base + (3 * 60 + 30) * 60 * 1000 - lead * 24 * 60 * 60 * 1000).toISOString();
};

for (const expiry of ["2026-03-15", "2026-01-01", "2026-12-31", "2028-02-29"]) {
  for (const lead of [7, 1, 0]) {
    eq(
      `khabar ka lamha server jaisa (${expiry}, lead ${lead})`,
      expiryNoticeMomentIso(expiry, lead),
      serverMoment(expiry, lead),
    );
  }
}

// ── 09:00 IST = 03:30 UTC — usi din, na ek din pehle na baad.
eq("lead 0 = us din 03:30 UTC", expiryNoticeMomentIso("2026-03-15", 0), "2026-03-15T03:30:00.000Z");
eq("lead 1 = ek din pehle", expiryNoticeMomentIso("2026-03-15", 1), "2026-03-14T03:30:00.000Z");
eq("lead 7 = saat din pehle", expiryNoticeMomentIso("2026-03-15", 7), "2026-03-08T03:30:00.000Z");

// ── ⚠️ Mahine/saal ki seema paar karte waqt bhi — yahi wo jagah hai jahan
//    "ek din peeche" wali galti chhupti hai.
eq("mahine ki seema", expiryNoticeMomentIso("2026-03-01", 1), "2026-02-28T03:30:00.000Z");
eq("saal ki seema", expiryNoticeMomentIso("2026-01-01", 7), "2025-12-25T03:30:00.000Z");

/* ══════════════════ nateeja ══════════════════ */

if (fails.length) {
  console.error(`\n✖ ${fails.length} jaanch FAIL (${pass} paas):\n`);
  for (const f of fails) console.error(`  • ${f}\n`);
  process.exit(1);
}
console.log(`✓ saari ${pass} jaanch paas`);
