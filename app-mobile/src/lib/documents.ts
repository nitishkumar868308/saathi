import { supabase } from "./supabase";
import { canAddDocument, getOffers } from "./plan";
import { deleteDocumentFile } from "./storage";
import {
  flushUploads,
  isUploadPending,
  queueUpload,
  requeueMissingUploads,
} from "./doc-upload-queue";
import {
  addToCachedDocs,
  primeCachedFile,
  readCachedDocs,
  removeCachedFile,
  syncDocumentFiles,
  writeCachedDocs,
} from "./doc-cache";
import { snapshotVersion, versionFilePaths } from "./doc-versions";

/**
 * Free-plan document limit cross hone par throw hota hai.
 *
 * ⚠️ `limit` constructor me aata hai, code me tay nahi hai. Pehle yahan
 * `FREE_DOC_LIMIT` (3) likha tha jabki ASLI hadd `app_config.free_documents` se
 * aati hai (`canAddDocument` wahi padhta hai). Admin ne 3 se 10 kiya to rok 10
 * par lagti thi par message phir bhi "sirf 3 documents" kehta tha — yaani app
 * user se jhooth bolti thi, aur support par wahi sawaal aata tha.
 */
export class DocLimitError extends Error {
  constructor(readonly limit: number) {
    super(
      `Free plan mein sirf ${limit} documents rakh sakte ho. Unlimited ke liye Saathi Plus lo.`,
    );
    this.name = "DocLimitError";
  }
}

export type Document = {
  id: string;
  name: string;
  type: string;
  expiry: string | null; // 'YYYY-MM-DD'
  /** AI scan ka poora samajh — kya document hai, kaunse fields mile. */
  summary: string | null;
  file_uri: string | null; // local device path (fast offline view)
  file_path: string | null; // R2 ka rasta `<uid>/<docId>.<ext>` (cloud backup)
  file_size: number | null; // bytes
  mime_type: string | null;
  /** Plus expire hone pe 3 se aage ke documents lock ho jaate hain. */
  is_locked: boolean;
  created_at: string;
};

/** Local file ke naam se uska type. Server bhi in hi chaar ko maanta hai. */
function mimeFromUri(uri: string): string {
  const ext = (uri.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
}

/**
 * Document ki file R2 pe chadhao.
 *
 * `file_path` / `file_size` / `mime_type` ab server khud bharta hai (upload ke
 * baad R2 se asli size poochh kar) — isliye yahan koi DB update nahi hai.
 */
export async function uploadDocumentImage(
  docId: string,
  localUri: string,
  version?: number,
): Promise<void> {
  const mime = mimeFromUri(localUri);
  /**
   * Kataar me PEHLE, upload BAAD me.
   *
   * ⚠️ Ye tarteeb jaan-boojh ke hai. Pehle upload ek "chalao aur bhool jao" call
   * thi (`.catch(() => {})`) — fail hone par document HAMESHA ke liye sirf us
   * phone par reh jaata tha: koi retry nahi, koi khabar nahi. Admin me wo "Sirf
   * device" pada rehta tha, jo asal me "hum ise kho chuke hain" ka doosra naam
   * hai. Aur document banta hi tab hai jab signal sabse kharab hota hai — bank
   * ke bahar, RTO ke bahar.
   *
   * Kataar pehle bharne se ek aur soorat bhi bach jaati hai: upload ke BEECH me
   * app band ho jaye (Android low-memory par ye aam hai) to bhi wo entry padi
   * rehti hai aur agli baar chal jaati hai.
   */
  await queueUpload(docId, localUri, mime, version);
  /**
   * Offline copy PEHLE, upload BAAD me.
   *
   * ⚠️ Tarteeb maayne rakhti hai. Cache aam taur par upload ke baad bharta hai
   * (R2 se file WAPAS utaar ke), aur us poore chakkar ke liye net chahiye. Par
   * user document tab daalta hai jab wo saamne hota hai — bank ke bahar, RTO ke
   * bahar — jahan signal aata-jaata rehta hai. Wahan upload fail ho jaata tha
   * aur document apne hi phone par "offline nahi khulta" ban jaata tha.
   *
   * File to abhi is phone par padi hi hai; use copy karne me na net lagta hai
   * na intezaar. Isliye offline ka intezaam pehle, cloud backup uske baad.
   */
  await primeCachedFile(docId, localUri, mime);
  await flushUploads();
}

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/**
 * Abhi kaun logged-in hai — bina network ke.
 *
 * ⚠️ Yahan pehle `auth.getUser()` tha, aur wahi offline ka sabse chhupa hua
 * kaanta tha: `getUser()` JWT ko SERVER se verify karta hai, yaani wo ek network
 * request hai. Net na hone par hum query tak pahunchte hi nahi the — uid
 * nikaalte waqt hi gir jaate the. Sirf query ka nateeja cache karna is wajah se
 * kaafi nahi hota.
 *
 * `getSession()` local storage se padhta hai. Suraksha me koi farq nahi — rows
 * server par RLS se waise bhi apne-apne user tak seemit hain.
 */
async function currentUid(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Sirf apne documents — offline bhi.
 *
 * RLS bhi ab own-row hai, par filter yahan bhi rakha hai — do reasons:
 * (1) RLS galat configure ho to bhi leak na ho, (2) count sahi rahe.
 *
 * Net ho to server se, aur saath hi cache bhar do. Net na ho to cache se —
 * khaali list ya error nahi. Isi wajah se Documents tab, Home aur chat ka
 * context, teenon bina kisi badlav ke offline kaam karne lagte hain.
 */
export async function listDocuments(): Promise<Document[]> {
  const sb = client();
  const uid = await currentUid();
  if (!uid) return [];

  try {
    const { data, error } = await sb
      .from("documents")
      .select("*")
      .eq("user_id", uid)
      .order("expiry", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const docs = (data ?? []) as Document[];
    void writeCachedDocs(uid, docs);
    // Fire-and-forget — list turant dikhni chahiye, files peeche utarti rahein.
    syncDocumentFiles(docs);
    /**
     * Jo document cloud par pahuncha hi nahi, use wapas kataar me daal do.
     *
     * ⚠️ Iske bina naya upload-queue sirf AAGE ke documents bachata. Jo pehle hi
     * chhoot chuke hain (admin me "Sirf device" wale) wo hamesha waise hi pade
     * rehte — aur wahi asli shikayat hai.
     */
    void requeueMissingUploads(docs).then(flushUploads);
    return docs;
  } catch (e) {
    const cached = await readCachedDocs(uid);
    if (cached) return cached;
    // Cache bhi nahi hai — pehli baar hai aur net bhi nahi. Ab sach batana hi
    // theek hai; screen error dikha degi.
    throw e;
  }
}

export async function addDocument(input: {
  name: string;
  type: string;
  expiry: string | null;
  summary?: string | null;
  file_uri?: string | null;
}): Promise<Document> {
  // Free plan limit check. Hadd rok se hi aati hai — message ke liye alag se
  // padhna hi wo galti thi jisse dono kabhi milte nahi the.
  if (!(await canAddDocument())) throw new DocLimitError((await getOffers()).freeDocuments);

  const sb = client();
  // Referral qualification (document upload) server-side isi se verify hota hai.
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("documents")
    .insert({
      name: input.name,
      type: input.type,
      expiry: input.expiry,
      summary: input.summary ?? null,
      file_uri: input.file_uri ?? null,
      user_id: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const doc = data as Document;
  /**
   * Naya document turant offline list me bhi.
   *
   * ⚠️ List cache SIRF `listDocuments()` likhta hai, aur wo tabhi chalta hai jab
   * user Documents tab kholta hai. Home se document add karke wapas Home par
   * rehne wala user — jo aam raasta hai — us list me kabhi aata hi nahi tha. Net
   * jaate hi offline screen par uska abhi-abhi save kiya hua document gayab
   * rehta tha. Uske liye wo "app ne save hi nahi kiya" hai.
   */
  const uid = u.user?.id;
  if (uid) await addToCachedDocs(uid, doc);

  return doc;
}

/**
 * Document RENEW — sirf expiry (aur chaho to nayi photo).
 *
 * ── Naam aur type yahan JAAN-BOOJH KE nahi hain ──────────────────────────
 *
 * ⚠️ Ye is function ki sabse zaroori baat hai, aur ye `patch` ke TYPE me hi
 * likhi hai — comment me nahi, taaki bhoolna namumkin ho.
 *
 * Aam "edit" ka matlab hota "sab kuch badal sakte ho", aur wahi is app me sabse
 * bada khatra tha: user Passport add kare aur baad me use Driving Licence bana
 * de. Us ek row par tab kya sach hai, ye kisi ko pata nahi chalta — photo kisi
 * aur document ki, naam kisi aur ka, aur renewal guide (jo `type` se chunta hai)
 * bilkul galat. AI ka scan bhi usi type par tika hai. Aisi galti ka koi error
 * nahi aata; wo bas chup-chaap galat ho jaati hai.
 *
 * Isliye yahan "edit" nahi, **RENEW** hai — wahi ek kaam jiske liye user sach me
 * lauta hai: "document renew ho gaya, nayi date daal do". Document ki PEHCHAAN
 * waisi ki waisi rehti hai; sirf uski taarikh (aur chaho to nayi photo) badalti
 * hai. Naam ya type sach me galat ho to document delete karke naya banana hi
 * sahi raasta hai — kyunki wo tab ek ALAG document hai.
 *
 * ⚠️ Notification yahan se NAHI lagti. Wo bulane wale ka kaam hai
 * (`scheduleDocumentExpiry`), bilkul waise hi jaise `addDocument` me hai —
 * warna ye lib file notifee (native module) par tik jaati aur headless task me
 * import hone layak nahi rehti.
 */
export async function updateDocument(
  doc: Document,
  patch: {
    /** Nayi expiry. `null` = expiry hata do (Aadhaar/PAN jaisa). */
    expiry: string | null;
    /** Nayi photo ka local rasta. `undefined` = photo waisi hi rehne do. */
    file_uri?: string;
  },
): Promise<Document> {
  const sb = client();

  /**
   * Purana haal PEHLE history me — kuch badalne se PEHLE.
   *
   * ⚠️ Tarteeb yahan sab kuch hai. Snapshot `documents` ki row padh kar banta
   * hai, isliye wo update ke BAAD chalaya jaye to wo "purana" nahi, naya haal
   * hi copy karega — history bhar jaati par usme rakha kuch bhi purana nahi
   * hota.
   *
   * Lauta hua `n` do baatein kehta hai: purana haal `version = n` par mehfooz
   * ho gaya, aur nayi file ka naam `n + 1` se banna chahiye taaki wo purani ke
   * upar na chadhe.
   *
   * `0` = history bani hi nahi (SQL abhi deploy nahi hui, ya net nahi tha). Us
   * par rukte NAHI — renew ek zaroori kaam hai aur history uske upar wali cheez
   * hai. 0 par sab kuch bilkul purane tareeke se chalta hai.
   *
   * ⚠️ `changing` ki shart zaroori hai. User Renew screen khol kar bina kuch
   * badle "Save" daba sakta hai (aur ye bilkul aam hai — log ye pakka karne ke
   * liye kholte hain ki date sahi hai). Bina is shart ke har aisi tap ek naya
   * version bana deti, aur "Purane versions" ek hi date ki das ek jaisi entry se
   * bhar jaata — jo history ko poori tarah bekaar kar deta hai.
   */
  const changing = !!patch.file_uri || patch.expiry !== doc.expiry;
  const snapshot = changing ? await snapshotVersion(doc.id) : 0;

  const row: { expiry: string | null; file_uri?: string } = { expiry: patch.expiry };
  if (patch.file_uri) row.file_uri = patch.file_uri;

  const { data, error } = await sb
    .from("documents")
    .update(row)
    .eq("id", doc.id)
    .select()
    .single();
  if (error) throw error;

  const updated = data as Document;

  /**
   * Nayi photo — wahi poora raasta jo `add-document` par hai.
   *
   * Kataar pehle bharti hai, phir offline copy, phir upload. Net na ho to bhi
   * nayi photo turant is phone par dikhti hai aur cloud par baad me chali jaati
   * hai. Yahan `await` isliye hai (add-document ke ulta) ki uske baad hume purani
   * cloud file hatani hai, aur wo tabhi surakshit hai jab nayi chadh chuki ho.
   */
  if (patch.file_uri) {
    /**
     * ⚠️ PURANI cached copy pehle hatao — warna nayi photo kabhi dikhti hi nahi.
     *
     * Ye is poore renew ka sabse chupa hua bug tha. `primeCachedFile()` jaan-
     * boojh ke turant laut jaata hai jab `doccache/<id>.<ext>` pehle se padi ho
     * (add ke raaste par wo sahi hai — wahan wo file abhi-abhi usi ne rakhi
     * thi). Par renew me wahi rasta PURANI photo se bhara hua hota hai, aur
     * `resolveDocUri()` sabse pehle cache hi padhta hai.
     *
     * Nateeja: nayi photo DB me chali jaati, R2 par bhi chadh jaati, par app me
     * har jagah — list, document-view, share, download — purani hi dikhti
     * rehti. User ke liye ye "app ne photo badli hi nahi" hai, aur wo dobara-
     * dobara koshish karta rehta hai.
     *
     * Ext badalne par (jpg → png) ye line ek doosra kaam bhi karti hai: purani
     * file ka rasta naye se alag hota, isliye wo cache me hamesha ke liye padi
     * reh jaati thi — kabhi padhi nahi jaati, bas jagah ghere rehti.
     */
    await removeCachedFile(doc);
    /**
     * Nayi photo NAYE naam par — `<uid>/<docId>-v<n>.<ext>`.
     *
     * Yahi ek baat purani photo ko bachati hai. Purana naam
     * (`<uid>/<docId>.<ext>`) chhoota hi nahi jaata, isliye purani file R2 par
     * jyon ki tyon padi rehti hai aur history use wahin se padh leti hai.
     */
    await uploadDocumentImage(
      doc.id,
      patch.file_uri,
      snapshot > 0 ? snapshot + 1 : undefined,
    ).catch(() => {});

    /**
     * ⚠️ Purani cloud file ab JAAN-BOOJH KE nahi hatti — wo ab history hai.
     *
     * Yahan pehle purani file delete hoti thi (jab ext badal jata ho), aur wo us
     * waqt bilkul sahi tha: purana kuch bacha hi nahi tha, to R2 par padi file
     * sirf ek kharcha thi. Ab wahi file "Purane versions" me user ko dikhti hai,
     * isliye use hatana seedha wo feature todna hoga.
     *
     * Orphan ka darr bhi ab nahi hai: `document_versions` har purani file ka
     * rasta yaad rakhta hai, aur document delete hone par `deleteDocument()`
     * unhe ek-ek karke hataati hai.
     *
     * ── Par jab history bani hi na ho (snapshot = 0) ──────────────────────
     *
     * Tab purana raasta hi sahi hai. Us soorat me nayi file PURANE naam par
     * chadhti hai, yaani wo purani ko waise bhi daba deti hai — sirf ext badalne
     * par purani file kahin darj hue bina reh jaati. Wahi ek soorat hai jisme
     * delete karna zaroori hai.
     *
     * ⚠️ `isUploadPending` ki shart zaroori hai. Kataar me abhi bhi entry hai ka
     * matlab hai upload chadha hi nahi (net nahi tha). Us haal me purani file
     * hata dena document ki EK MAATR cloud copy hatana hai — orphan file us
     * nuksan se kahin sasti hai.
     */
    const oldPath = doc.file_path;
    if (snapshot === 0 && oldPath && !(await isUploadPending(doc.id))) {
      const newExt = mimeFromUri(patch.file_uri).split("/")[1];
      const oldExt = oldPath.split(".").pop()?.toLowerCase();
      // `jpeg` (mime me) aur `jpg` (rasta me) — dono ek hi cheez hain.
      const same = oldExt === newExt || (oldExt === "jpg" && newExt === "jpeg");
      if (!same) await deleteDocumentFile(oldPath).catch(() => {});
    }
  }

  /**
   * Nayi photo ke baad row DOBARA padho.
   *
   * ⚠️ `updated` upar `.update().select()` se aaya hai — yaani upload se PEHLE
   * ka haal. `file_path`, `file_size` aur `mime_type` app nahi bharti; wo server
   * upload poora hone ke BAAD bharta hai (`uploadDocumentImage` par likha hai).
   * Isliye `updated` me abhi bhi PURANI file ka rasta pada hota hai — jo ab
   * history ka hissa hai, is document ka current nahi.
   *
   * Wahi galat row offline cache me likh dena sabse bura tha: app current
   * document ke naam par purane version ki file dikhati rehti, yaani renew ke
   * baad bhi purani hi photo — theek wahi bug jise upar `removeCachedFile()`
   * theek karta hai, bas doosre raaste se wapas aaya hua.
   *
   * Fail ho to `updated` hi theek hai — us haalat me `file_uri` (isi phone ki
   * nayi file) mil jaata hai, aur agli `listDocuments()` par row apne aap sudhar
   * jaati hai.
   */
  let latest = updated;
  if (patch.file_uri) {
    const { data: fresh } = await sb
      .from("documents")
      .select()
      .eq("id", doc.id)
      .maybeSingle();
    if (fresh) latest = fresh as Document;
  }

  /**
   * Offline list bhi turant sudhaaro.
   *
   * ⚠️ Iske bina net jaate hi user ko purani expiry wapas dikhti — usne abhi-abhi
   * renew kiya hota aur app usi purani date par "expired" ka laal tag dikha rahi
   * hoti. Wo "app ne save hi nahi kiya" jaisa dikhta hai.
   */
  const uid = await currentUid();
  if (uid) {
    const cached = await readCachedDocs(uid);
    if (cached) {
      await writeCachedDocs(
        uid,
        cached.map((x) => (x.id === latest.id ? latest : x)),
      );
    }
  }

  return latest;
}

/**
 * Document hatao — server se bhi, aur phone se bhi.
 *
 * Poora `doc` isliye chahiye (sirf id nahi): cached file ka naam uske
 * `file_path`/`mime_type` se banta hai. Bina safai ke deleted documents ki
 * files phone par padi rehti thi aur "offline documents" ka size kabhi ghatta
 * hi nahi.
 */
export async function deleteDocument(doc: Document): Promise<void> {
  /**
   * ⚠️ Purane versions ke raste ROW HATNE SE PEHLE poochho.
   *
   * `document_versions` par `on delete cascade` laga hai, yaani `documents` ki
   * row hatte hi wo saari row bhi chali jaati hain — aur unke saath un purani
   * files ke rasta bhi, jo R2 par abhi bhi padi hain. Ek baar wo pata kho gaya
   * to wo files hamesha ke liye bucket me pad jaati: user ke liye "delete",
   * bill me zinda, aur kisi purane signed URL se khulne layak. Yahi baat neeche
   * current file par pehle se likhi hai; history ne bas usi ko naya roop diya.
   *
   * Fail ho to khaali list — delete phir bhi hona chahiye. Ek reh gayi file
   * "document delete hi nahi hua" se kahin sasti hai.
   */
  const oldPaths = await versionFilePaths(doc.id);

  const { error } = await client().from("documents").delete().eq("id", doc.id);
  if (error) throw error;

  await removeCachedFile(doc);
  // Cloud copy bhi jaani chahiye. ⚠️ Pehle sirf DB row aur local cache hatti
  // thi — bucket me file padi rehti thi: user ke liye "delete", bill me zinda,
  // aur kisi purane signed URL se abhi bhi khulne layak.
  if (doc.file_path) await deleteDocumentFile(doc.file_path);
  /**
   * Har purane version ki file bhi.
   *
   * `doc.file_path` ko chhod dete hain — wo abhi upar hataayi ja chuki hai, aur
   * bina photo wale renew me do version ek hi file par ishara karte hain
   * (`my_document_version_paths` khud bhi `distinct` deta hai).
   */
  for (const p of oldPaths) {
    if (p !== doc.file_path) await deleteDocumentFile(p);
  }
  // Metadata cache bhi turant sudhaaro — warna offline jaate hi delete kiya
  // hua document wapas list me aa jaata.
  const uid = await currentUid();
  if (uid) {
    const cached = await readCachedDocs(uid);
    if (cached) await writeCachedDocs(uid, cached.filter((x) => x.id !== doc.id));
  }
}
