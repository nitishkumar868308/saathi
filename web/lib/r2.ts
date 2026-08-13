import { createHash, createHmac } from "crypto";

/**
 * Cloudflare R2 — saari file storage (documents + profile photo).
 *
 * .env.local:
 *     R2_ACCOUNT_ID=
 *     R2_ACCESS_KEY_ID=
 *     R2_SECRET_ACCESS_KEY=
 *     R2_BUCKET=apkasaathi-storage
 *
 * ⚠️ Ye chaaron SIRF server par rehte hain. Kabhi NEXT_PUBLIC_ prefix ke saath
 *    nahi, aur kabhi app ki .env me nahi — R2 ki access key poore bucket ka
 *    master key hai, uske aage koi RLS jaisi doosri deewar nahi hai.
 *
 * App khud R2 se baat nahi karti. Wo apna Supabase token le kar `/api/storage/*`
 * pe aati hai; server dekhta hai ki ye kaun hai, phir uske apne folder ka ek
 * chhoti umar wala presigned URL banata hai. Isi wajah se bucket poora private
 * reh sakta hai.
 *
 * Bucket ke andar ka dhaancha:
 *     avatars/<uid>/avatar.jpg
 *     documents/<uid>/<docId>.<ext>
 *
 * (DB me `documents.file_path` pehle jaisa hi `<uid>/<docId>.<ext>` rehta hai —
 *  `documents/` wala prefix sirf yahan lagta hai.)
 */

const REGION = "auto"; // R2 ka region hamesha "auto" hota hai
const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

/**
 * Env har baar padha jaata hai, module load pe ek baar nahi.
 *
 * Next.js me dono chalta hai, par is tarah `r2.ts` ko test se bhi chalaya ja
 * sakta hai (env set karo, phir call karo) — aur `.env.local` badalne par
 * dev server ke andar purani value chipki nahi rehti.
 */
function cfg() {
  return {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET || "apkasaathi-storage",
  };
}

export function r2Bucket(): string {
  return cfg().bucket;
}

export class R2NotConfigured extends Error {
  constructor() {
    super("R2 set nahi hai — R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY daalo");
    this.name = "R2NotConfigured";
  }
}

export function r2Configured(): boolean {
  const c = cfg();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);
}

/* --------------------------- SigV4 ke chhote purze --------------------------- */

/**
 * RFC 3986 wala encoding — `encodeURIComponent` se thoda sakht.
 *
 * ⚠️ `encodeURIComponent` `!'()*` ko chhod deta hai, par AWS ka canonical form
 * unhe encoded maanta hai. Ek bhi akshar alag ho to signature match nahi karta
 * aur R2 seedha 403 de deta hai — isliye ye chaar hath se badalne padte hain.
 */
function uriEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Canonical path — `/` waise ka waisa, har hissa alag se encode. */
function encodePath(path: string): string {
  return path.split("/").map(uriEncode).join("/");
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** AWS ka date format: 20240131T091530Z aur 20240131. */
function stamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/* ---------------------------- SigV4 ka asli signer --------------------------- */

export type SignInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  /** Bina encode kiya hua path, `/` se shuru. Jaise `/bucket/avatars/u1/a.jpg`. */
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresIn: number;
  /** Signed headers. `host` apne aap jud jaata hai. */
  headers?: Record<string, string>;
  /** Query jo URL me bhi jaayegi aur sign bhi hogi. */
  extraQuery?: Record<string, string>;
  now?: Date;
};

/**
 * Query-string wala AWS SigV4 presigned URL.
 *
 * Ye jaan-boojh ke R2 se poori tarah azaad hai — isliye ise AWS ke apne
 * documented test vector (`scripts/r2-sigv4-test.mjs`) se chala kar jaancha ja
 * sakta hai. Poora ganit yahin ek jagah hai; `presign()` bas iske upar R2 ka
 * account/bucket chadhata hai.
 */
export function presignUrl(input: SignInput): string {
  const { amzDate, dateStamp } = stamps(input.now ?? new Date());
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;

  // Header ke naam hamesha lowercase — canonical form me wahi chalta hai, aur
  // caller "Content-Type" bheje ya "content-type", farq nahi padna chahiye.
  const headers: Record<string, string> = { host: input.host };
  for (const [k, v] of Object.entries(input.headers ?? {})) headers[k.toLowerCase()] = v;
  const signedHeaders = Object.keys(headers).sort();

  const query: Record<string, string> = {
    ...(input.extraQuery ?? {}),
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${input.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(input.expiresIn),
    "X-Amz-SignedHeaders": signedHeaders.join(";"),
  };

  // ⚠️ Sort ENCODED naam par hota hai, asli naam par nahi. Dono ka nateeja
  // aksar ek hi hota hai, par hamesha nahi — aur AWS encoded wala maanta hai.
  const canonicalQuery = Object.entries(query)
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalPath = encodePath(input.path);
  const canonicalHeaders = signedHeaders
    .map((h) => `${h}:${headers[h].trim().replace(/\s+/g, " ")}\n`)
    .join("");

  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join(
    "\n",
  );

  const signature = hmac(
    signingKey(input.secretAccessKey, dateStamp, input.region, input.service),
    stringToSign,
  ).toString("hex");

  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/* ------------------------------- Presigned URL ------------------------------- */

export type PresignOptions = {
  /** URL kitni der chalega (seconds). R2/S3 ki chhat 7 din hai. */
  expiresIn?: number;
  /**
   * PUT ke liye. Diya ho to `content-type` bhi sign hota hai — yaani client
   * ISI type ke saath hi upload kar sakta hai, kisi aur ke saath nahi.
   */
  contentType?: string;
  /** GET ke liye — browser/app ko file is naam se save karne ko kaho. */
  downloadName?: string;
  /** Testing ke liye — waqt fix kar dena. */
  now?: Date;
};

/**
 * Kisi bhi method ka presigned URL (GET / PUT / HEAD / DELETE).
 *
 * Payload hamesha UNSIGNED-PAYLOAD hai — presigned URL me yahi tareeka hai,
 * kyunki URL banate waqt body abhi maujood hi nahi hoti.
 */
export function presign(
  method: "GET" | "PUT" | "HEAD" | "DELETE",
  key: string,
  opts: PresignOptions = {},
): string {
  const c = cfg();
  if (!r2Configured()) throw new R2NotConfigured();

  const extraQuery: Record<string, string> = {};
  if (opts.downloadName) {
    extraQuery["response-content-disposition"] =
      `attachment; filename="${opts.downloadName.replace(/["\\\r\n]/g, "")}"`;
  }

  return presignUrl({
    method,
    host: `${c.accountId}.r2.cloudflarestorage.com`,
    // R2 path-style: /<bucket>/<key>
    path: `/${c.bucket}/${key}`,
    region: REGION,
    service: SERVICE,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    // 1 second se 7 din — S3/R2 ki apni chhat.
    expiresIn: Math.min(Math.max(opts.expiresIn ?? 300, 1), 604800),
    headers: opts.contentType ? { "content-type": opts.contentType } : undefined,
    extraQuery,
    now: opts.now,
  });
}

/** App/browser seedha yahan PUT karega. `contentType` bhi bandha hua hai. */
export function presignUpload(key: string, contentType: string, expiresIn = 300): string {
  return presign("PUT", key, { contentType, expiresIn });
}

/** Padhne ka chhoti umar wala URL. */
export function presignDownload(
  key: string,
  expiresIn = 300,
  downloadName?: string,
): string {
  return presign("GET", key, { expiresIn, downloadName });
}

/* --------------------------------- Operations -------------------------------- */

export type ObjectInfo = { size: number; contentType: string | null };

/**
 * Object hai ya nahi, aur hai to kitna bada.
 *
 * ⚠️ Yahi wo jagah hai jahan upload ki asli size pata chalti hai. Presigned PUT
 * me size ki koi rok lag hi nahi sakti (`content-length-range` sirf POST policy
 * me hota hai), isliye app ki batayi hui size par bharosa karna bekaar hai —
 * upload ke BAAD yahan se poochhna hi ek sachcha jawab hai.
 */
export async function headObject(key: string): Promise<ObjectInfo | null> {
  const res = await fetch(presign("HEAD", key, { expiresIn: 60 }), {
    method: "HEAD",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? "0");
  return {
    size: Number.isFinite(len) ? len : 0,
    contentType: res.headers.get("content-type"),
  };
}

/** Object hata do. Pehle se na ho to bhi `true` (R2 DELETE idempotent hai). */
export async function deleteObject(key: string): Promise<boolean> {
  const res = await fetch(presign("DELETE", key, { expiresIn: 60 }), {
    method: "DELETE",
    cache: "no-store",
  });
  return res.ok || res.status === 404;
}

/**
 * Object ke bytes server par (avatar proxy ke liye).
 * Na mile to `null` — caller 404 de.
 */
export async function getObject(key: string): Promise<Response | null> {
  const res = await fetch(presign("GET", key, { expiresIn: 60 }), { cache: "no-store" });
  if (!res.ok) return null;
  return res;
}

/* ---------------------------------- Keys ------------------------------------- */

/**
 * Ek hi jagah se banne wali keys.
 *
 * ⚠️ Har jagah key haath se jodna hi wo galti hai jisse `documents/<uid>/…` ke
 * bahar ki file bhi kabhi khul jaati hai. Key hamesha uid se hi banti hai, aur
 * uid HAMESHA verify kiye hue token se aata hai — kabhi request body se nahi.
 */
export const r2Key = {
  avatar: (uid: string) => `avatars/${uid}/avatar.jpg`,
  /**
   * ⚠️ Yahan pehle `document(uid, docId, ext)` tha, jo hamesha
   * `documents/<uid>/<docId>.<ext>` banata tha — yaani har document ki EK hi
   * jagah. Renew par nayi photo theek usi jagah chadh jaati thi aur purani
   * hamesha ke liye mit jaati thi.
   *
   * Ab naam `documentFileName()` tay karta hai (version ke saath), aur yahan se
   * sirf `<uid>/<file>` ko poore key me badla jaata hai. Ek hi raasta hone se
   * upload aur commit ka key kabhi alag nahi ho sakta.
   */
  documentPath: (filePath: string) => `documents/${filePath.replace(/^\/+/, "")}`,
};

/**
 * `<uid>/<name>.<ext>` — bas itna hi. Aur uid wahi hona chahiye jo token se aaya.
 *
 * `..`, `\`, `//`, absolute path, khaali hissa — sab yahin ruk jaate hain.
 */
export function isOwnDocumentPath(filePath: string, uid: string): boolean {
  if (!filePath || filePath.length > 200) return false;
  if (filePath.includes("..") || filePath.includes("\\") || filePath.startsWith("/")) {
    return false;
  }
  const parts = filePath.split("/");
  if (parts.length !== 2) return false;
  if (parts[0] !== uid) return false;
  return /^[A-Za-z0-9._-]{1,120}$/.test(parts[1]);
}
