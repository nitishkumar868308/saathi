/**
 * Document ki cached file ka NAAM — sirf hisaab, koi filesystem nahi.
 *
 * ── Ye alag file kyun hai ───────────────────────────────────────────────
 *
 * Ye naam DO jagah ke beech ka contract hai, aur dono jagah ka ek jaisa hona
 * hi is poore cache ki jaan hai:
 *
 *   • Upload se PEHLE app khud file rakh deti hai (`primeCachedFile`), tab
 *     `file_path` bhara hi nahi hota — sirf mime aur version pata hota hai.
 *   • Upload ke BAAD server `documents.file_path` bharta hai
 *     (`<uid>/<docId>-v<n>.<ext>` — dekho `web/lib/storage-server.ts` ka
 *     `documentFileName()`), aur app usi se naam nikaalti hai.
 *
 * Dono raaste ek hi naam par na pahunchein to bug CHUP hota hai: abhi-abhi
 * rakhi hui file "mili hi nahi" gini jaati hai, wahi photo dobara R2 se utarti
 * hai (offline me bilkul nahi khulti), aur purani copy jagah gherti reh jaati
 * hai.
 *
 * Isliye ye hisaab `doc-cache.ts` (jo `expo-file-system` khinchti hai) se alag
 * hai — taaki ise seedha jaancha ja sake.
 */

/**
 * Mime → extension. Bilkul wahi map jo server ke `extFor()` me hai
 * (`web/lib/storage-server.ts`).
 *
 * ⚠️ Dono ka ek jaisa hona ZAROORI hai, aur ye baat dikhti nahi hai. Upload ke
 * baad `file_path` ka ext SERVER tay karta hai. Agar hum file cache me kisi aur
 * naam se rakh dein, to upload ke baad wahi document "cache me nahi hai" gina
 * jaayega aur dobara download hoga — yaani jo file phone par pehle se padi hai,
 * uske liye net ka intezaar. Pehle yahan sirf png/jpg tha, isliye har PDF aur
 * WEBP par theek yahi hota tha.
 */
export function extForMime(mime: string | null | undefined): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

/**
 * Renew ka kaunsa version — `file_path` ke naam se.
 *
 * Server file ko `<uid>/<docId>-v<n>.<ext>` par rakhta hai; version 1 aur bina
 * version wala purana raasta `<uid>/<docId>.<ext>` hai (yaani koi tag nahi).
 */
export function versionTag(filePath: string | null | undefined): string {
  const base = filePath?.split("/").pop() ?? "";
  // `[^.]+$` — ext me dot nahi hota, isliye ye sirf ASLI `-v<n>.<ext>` par
  // lagta hai. Bina iske "report-v2.final.pdf" jaisa naam bhi version gina jaata.
  const m = base.match(/-v(\d{1,4})\.[^.]+$/);
  return m ? `-v${m[1]}` : "";
}

/**
 * Cache me is document ki file ka naam (folder ke bina).
 *
 * ── ⚠️ Naam me VERSION kyun hai ────────────────────────────────────────
 *
 * Shikayat: "document me jab hum edit karke dusra daalte h to wo turant nhi
 * aata h".
 *
 * Naam pehle sirf `<id>.<ext>` tha — yaani renew se pehle aur baad, DONO ka
 * naam hubahu ek. `updateDocument()` purani cached file hata ke usi naam par
 * nayi rakh deta hai, isliye file to sach me nayi hoti hai... par URI ka string
 * wahi rehta hai. Aur React Native ka `Image` bitmap ko URI se cache karta hai
 * (Android par Fresco, iOS par RCTImageLoader) — usi URI par wo apni purani,
 * pehle se decode ki hui photo hi dikhata rehta hai. Document-view, list,
 * comparison card — sab jagah purani photo.
 *
 * User ke liye iska ek hi matlab hai: "app ne photo badli hi nahi." Aur wo
 * dobara-dobara renew karta rehta hai.
 *
 * Version naam me aate hi har renew ka apna naam ban jaata hai, yaani nayi URI
 * — aur image cache ke paas us URI ki koi purani nakal hoti hi nahi.
 */
export function cacheFileName(
  doc: { id: string; file_path?: string | null; mime_type?: string | null },
  /** Upload se PEHLE (jab `file_path` abhi bhara hi nahi) — caller version deta hai. */
  version?: number,
): string {
  const raw = doc.file_path?.split(".").pop()?.split("?")[0] ?? "";
  // ⚠️ Sirf saaf-suthre akshar. Bina is jaanch ke ek aisa `file_path` jisme
  // aakhri dot ke BAAD slash ho (jaise "a/b.c/d") ext ko "c/d" bana deta, aur
  // rasta `doccache/<id>.c/d` — yaani cache folder se BAHAR. Ext ki jagah ext
  // hi aana chahiye.
  const ext = /^[a-z0-9]{1,5}$/i.test(raw) ? raw.toLowerCase() : extForMime(doc.mime_type);
  // ⚠️ `version` aur `file_path` ka hisaab BILKUL ek jaisa hona chahiye (upar
  // poori wajah likhi hai). `version > 1` wali shart server ke
  // `documentFileName()` se hubahu milti hai — v1 ka koi tag nahi hota.
  const tag = version && version > 1 ? `-v${version}` : versionTag(doc.file_path);
  return `${doc.id}${tag}.${ext}`;
}

/** Ye file naam isi document ka hai? (Cache saaf karte waqt chahiye.) */
export function belongsToDoc(fileName: string, docId: string): boolean {
  // uuid ke turant baad hamesha ya `.` (ext) aata hai ya `-v` (version) —
  // isliye sirf `startsWith(id)` se kaam nahi chalta.
  return fileName.startsWith(`${docId}.`) || fileName.startsWith(`${docId}-v`);
}
