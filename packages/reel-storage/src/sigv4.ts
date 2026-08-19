import { createHash, createHmac } from "node:crypto";

/**
 * AWS SigV4 presigned URL signer.
 *
 * ⚠️ Ye `web/lib/r2.ts` se **copy** kiya gaya hai, import nahi. Wo file live
 * marketing site (`web/`) ki hai aur README ka rule 4 kehta hai use haath nahi
 * lagana — na hi studio ko uske build par nirbhar karna hai. Copy me sirf itna
 * farq hai ki config yahan **argument** se aati hai, `process.env` se nahi:
 * driver ko env padhne ka kaam nahi karna chahiye, wo `config.ts` ka zimma hai.
 *
 * Ganit bilkul wahi hai. Wo `web/` me AWS ke apne documented test vector se
 * jaanchi ja chuki hai, isliye usme kuch "sudhaarne" ki koshish nahi ki gayi.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";

/**
 * RFC 3986 wala encoding — `encodeURIComponent` se thoda sakht.
 *
 * ⚠️ `encodeURIComponent` `!'()*` ko chhod deta hai, par AWS ka canonical form
 * unhe encoded maanta hai. Ek bhi akshar alag ho to signature match nahi karta
 * aur R2 seedha 403 de deta hai — isliye ye chaar haath se badalne padte hain.
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

export type SignMethod = "GET" | "PUT" | "HEAD" | "DELETE";

export interface SignInput {
  method: SignMethod;
  host: string;
  /** Bina encode kiya hua path, `/` se shuru. Jaise `/bucket/permanent/reels/x.mp4`. */
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
}

/**
 * Query-string wala AWS SigV4 presigned URL.
 *
 * Payload hamesha UNSIGNED-PAYLOAD hai — presigned URL me yahi tareeka hai,
 * kyunki URL banate waqt body abhi maujood hi nahi hoti.
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
    .map((h) => `${h}:${(headers[h] as string).trim().replace(/\s+/g, " ")}\n`)
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
