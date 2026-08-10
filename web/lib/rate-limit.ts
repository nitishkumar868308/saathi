/**
 * Bina login wale public endpoints ki rok.
 *
 * ⚠️ `/api/contact` aur `/api/account/delete-request` par koi rok thi hi nahi,
 * aur dono EMAIL bhejte hain — contact to do bhejta hai (admin ko khabar, aur
 * form me likhe hue pate par "rasid"). Yaani ek script kisi bhi ajnabi ke inbox
 * me hamare apne domain se mail bhar sakti thi:
 *
 *     for i in {1..5000}; do curl -X POST .../api/contact \
 *       -d '{"name":"x","email":"<kisi ka bhi pata>","message":"xx"}'; done
 *
 * Nuksaan teen tarah ka hota hai, aur teenon mehnge hain: Hostinger ka SMTP
 * quota ek hi jhatke me khatam (jiske baad ASLI reminder aur OTP wale mail bhi
 * rukte hain), `contact_messages` table kachre se bhar jaati hai (asli sawaal
 * usme dab jaate hain), aur sabse bura — apkasaathi.com ka bhejne wala pata
 * spam list me chala jaata hai. Wo aakhri wala hafton me theek hota hai.
 *
 * ⚠️ Ye rok **memory me** hai, aur wahi kami hai jo `admin-rate-limit.ts` me
 * likhi hai: Vercel par har serverless instance ka apna counter hota hai, isliye
 * bahut bada hamla kai instance faila ke ise thoda patla kar sakta hai. Phir bhi
 * ye asli kaam karti hai — aam script-wali baadh (ek jagah se hazaron request)
 * yahin ruk jaati hai, aur iske liye koi nayi table ya migration nahi chahiye.
 *
 * Sach me pukhta chahiye to agla kadam Supabase me ek `public_hits` table hai
 * (sab instance ek hi ginti dekhein), ya Vercel WAF ka rate-limit rule.
 */

type Bucket = { count: number; windowStart: number };

/** Har naam (endpoint) ka apna naksha — contact ki ginti delete-request par na lage. */
const buckets = new Map<string, Map<string, Bucket>>();

/** Naksha badhne se roko — beete hue window ki entries hata do. */
function prune(map: Map<string, Bucket>, now: number, windowMs: number): void {
  if (map.size < 1000) return;
  const dead: string[] = [];
  // `forEach` isliye (for…of nahi): project ka tsconfig purane target par hai
  // aur Map ko seedha iterate karne se build fail ho jaata hai.
  map.forEach((b, key) => {
    if (now - b.windowStart > windowMs) dead.push(key);
  });
  dead.forEach((k) => map.delete(k));
}

/**
 * Request kis "jagah" se aayi.
 *
 * Vercel `x-forwarded-for` bharta hai; sabse pehla hissa asli client hota hai.
 * Kuch na mile to ek hi bucket ("unknown") — us soorat me rok sabke liye ek
 * saath lagti hai, jo bina pehchaan wale traffic ke liye theek hi hai.
 */
export function requestKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

export type RateVerdict = { allowed: true } | { allowed: false; retryAfter: number };

/**
 * Ek koshish gino aur batao ki aage badhna chahiye ya nahi.
 *
 * ⚠️ Ginti KOSHISH par hoti hai, fail par nahi (login wali rok se ulta). Wajah
 * seedhi hai: yahan koi "galat password" hota hi nahi — har request "kaamyab"
 * hoti hai aur har kaamyab request ek email bhejti hai. Isliye kharcha safalta
 * se hi aata hai, aur ginti wahin honi chahiye.
 */
export function hit(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): RateVerdict {
  const now = Date.now();
  let map = buckets.get(name);
  if (!map) {
    map = new Map<string, Bucket>();
    buckets.set(name, map);
  }
  prune(map, now, windowMs);

  const b = map.get(key);
  if (!b || now - b.windowStart > windowMs) {
    map.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  b.count += 1;
  if (b.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((b.windowStart + windowMs - now) / 1000)),
    };
  }
  return { allowed: true };
}
