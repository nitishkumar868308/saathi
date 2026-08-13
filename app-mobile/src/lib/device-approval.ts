import { supabase } from "./supabase";
import { WEB_URL } from "./plan";
import { getDeviceId } from "./device";

/**
 * "Naya phone" — is phone par reminder/alert chaalu karne ka raasta.
 *
 * ── Ye kyun chahiye tha ────────────────────────────────────────────────────
 *
 * Ek account, kai phone — aur teen cheezein chup-chaap tootti thi (poori baat
 * `supabase/device-approval.sql` ke sar par likhi hai): alarm har phone ke ANDAR
 * lagte hain, FCM token phone ka hota hai, aur purane phone par documents khule
 * pade rehte hain.
 *
 * Ab ek waqt me EK phone "active" rehta hai. Baaki phone par app poori chalti
 * hai aur data bhi dikhta hai — sirf notification aur alarm nahi lagte.
 *
 * ⚠️ Ye LOGIN ki rok NAHI hai, aur ye jaan-boojh ke hai. Login rok dene par
 * jiska email access chala gaya ho wo apne hi documents se hamesha ke liye bahar
 * ho jaata. Sirf wahi ruka hai jo sach me do jagah nahi chal sakta.
 *
 * ⚠️ Pehla phone apne aap active ho jaata hai (`claim_device_if_free`), bina
 * kisi code ke. Iske bina har naya user pehle hi din email-OTP ki deewar se
 * takrata — jo onboarding ka sabse bura tarika hota.
 */

export type DeviceApprovalError =
  | "unauthorized"
  /** Account par email hai hi nahi (phone-only login) — support hi raasta hai. */
  | "no_email"
  /** Email bhejne ka setup hi nahi hai. */
  | "not_configured"
  /** 60 second ka thehraav — button khud khul jayega. */
  | "cooldown"
  /** Ghante/din ki hadd poori. */
  | "too_many"
  | "wrong_code"
  | "expired"
  /** Us code par bahut galat koshish — naya code mangwana padega. */
  | "locked"
  | "bad_device"
  | "failed"
  | "network";

export type DeviceState = {
  /** Is phone par notification/alarm chalne chahiye. */
  active: boolean;
  /** Koi DOOSRA phone active hai — isliye ye chup hai. */
  needsApproval: boolean;
  /** Us doosre phone ki jhalak. Koi id nahi — sirf itna. */
  other: { platform: string | null; lastSeenAt: string | null } | null;
};

/**
 * Aakhri jaana hua haal.
 *
 * ⚠️ Ye cache sirf isliye hai ki `push.ts` aur `notifications.ts` ke gate har
 * baar network call na karein. Wo dono app khulte hi chalte hain, aur wahan ek
 * aur await lagana app ke pehle frame ko dheema kar deta.
 *
 * Default `active: true` JAAN-BOOJH KE hai. Jab tak hume pata na ho, notification
 * CHALNI chahiye — ek nayi feature ki wajah se kisi ka asli reminder chhoot
 * jaana usse kahin bura hai ki ek purane phone par ek extra notification chali
 * jaye. Sach pata chalte hi (`refreshDeviceState`) ye theek ho jaata hai.
 */
let cached: DeviceState = { active: true, needsApproval: false, other: null };

const listeners = new Set<(s: DeviceState) => void>();

export function deviceState(): DeviceState {
  return cached;
}

export function onDeviceState(fn: (s: DeviceState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function set(next: DeviceState) {
  cached = next;
  listeners.forEach((l) => l(next));
}

/**
 * Server se poochho ki ye phone active hai ya nahi — aur khaali jagah ho to
 * usi call ke saath ise chaalu bhi kar lo.
 *
 * Login ke baad aur app saamne aane par chalta hai.
 */
let lastCheckAt = 0;

/**
 * "Haal itna purana to nahi?" — poochho tabhi jab sach me zaroorat ho.
 *
 * ⚠️ Ye is feature ka sabse aasaani se chhoot jaane wala hissa hai. `runSync()`
 * (notifications.ts) aur `saveToken()` (push.ts) dono cache padhte hain, aur
 * dono app khulte hi chalte hain — `refreshDeviceState()` ke poora hone ka
 * intezaar kiye bina. Cache ka default `active: true` hai, isliye ek INACTIVE
 * phone par bhi pehla sync saare alarm laga deta.
 *
 * Isliye rok caller par nahi chhodi — `runSync` khud yahi bulata hai. Gate
 * bhoolna namumkin hona chahiye, yaad rakhna nahi padna chahiye.
 */
export async function ensureDeviceState(maxAgeMs = 60_000): Promise<DeviceState> {
  if (lastCheckAt && Date.now() - lastCheckAt < maxAgeMs) return cached;
  return refreshDeviceState();
}

export async function refreshDeviceState(): Promise<DeviceState> {
  if (!supabase) return cached;
  try {
    const id = await getDeviceId();

    const { data, error } = await supabase.rpc("my_device_state", { p_id: id });
    if (error || !data) return cached;

    let d = data as { active?: boolean; needs_approval?: boolean; other?: unknown };

    /**
     * Dono false = user ka koi bhi phone active nahi (naya signup, ya migration
     * se pehle ka purana account). Tab ye phone apne aap active ho jaata hai.
     *
     * ⚠️ Ye race-safe hai: DB par ek partial unique index hai, isliye do phone
     * ek saath ye chala dein to ek hi jeetega aur doosre ko `false` milega — jo
     * phir OTP wale raaste par chala jayega. Sahi vyavhaar, error nahi.
     */
    if (!d.active && !d.needs_approval) {
      const claimed = await supabase.rpc("claim_device_if_free", { p_id: id });
      if (claimed.data === true) {
        d = { active: true, needs_approval: false };
      } else {
        // Koi aur jeet gaya — ab asli haal dobara poochho.
        const again = await supabase.rpc("my_device_state", { p_id: id });
        if (!again.error && again.data) d = again.data as typeof d;
      }
    }

    const other = d.other as { platform?: string; last_seen_at?: string } | undefined;
    const next: DeviceState = {
      active: !!d.active,
      needsApproval: !!d.needs_approval,
      other: other
        ? { platform: other.platform ?? null, lastSeenAt: other.last_seen_at ?? null }
        : null,
    };
    // ⚠️ Mohar sirf KAAMYAB jawab par. Fail par na lagaane se `ensureDeviceState`
    // agli baar dobara koshish karta hai — warna ek fail hui call ke baad poora
    // ek minute purane (galat) haal par chalta.
    lastCheckAt = Date.now();
    set(next);
    return next;
  } catch {
    // Net na ho to purana haal hi rehne do — "pata nahi" par notification band
    // kar dena sabse bura nateeja hai.
    return cached;
  }
}

/** Logout par — agla user is phone par aaye to purana haal na dikhe. */
export function resetDeviceState(): void {
  lastCheckAt = 0;
  set({ active: true, needsApproval: false, other: null });
}

/* --------------------------- email wala code --------------------------- */

async function post<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: DeviceApprovalError }> {
  if (!supabase) return { ok: false, error: "failed" };

  // Server user ki pehchaan SIRF is token se karta hai — request me user id
  // bhejna kabhi kaam nahi karega (aur nahi karna chahiye).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "unauthorized" };

  try {
    const res = await fetch(`${WEB_URL}/api/device/approve/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, deviceId: await getDeviceId() }),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: out as T };
    return { ok: false, error: (out.error as DeviceApprovalError) ?? "failed" };
  } catch {
    // Net nahi. Ise `failed` se alag rakhna zaroori hai: "dobara koshish karo"
    // kehna tabhi sahi hai jab dikkat sach me net ki ho.
    return { ok: false, error: "network" };
  }
}

/** Account ke email par code bhejo. Kaamyab hone par mask kiya hua email milta hai. */
export async function sendApprovalCode(): Promise<
  { ok: true; email: string; retryAfter: number } | { ok: false; error: DeviceApprovalError }
> {
  const res = await post<{ email?: string; retryAfter?: number }>("send", {});
  if (!res.ok) return res;
  return {
    ok: true,
    email: String(res.data.email ?? ""),
    retryAfter: Number(res.data.retryAfter ?? 60),
  };
}

/**
 * Code daalo — sahi nikla to ye phone wahin active ho jaata hai.
 *
 * ⚠️ Jaanch aur activate SERVER par ek hi call me hote hain. App yahan sirf
 * nateeja sunti hai; wo khud kabhi device active nahi kar sakti (uski RPC
 * service_role-only hai). Iske bina poora email-OTP dikhawa hota.
 */
export async function confirmApprovalCode(
  code: string,
): Promise<DeviceApprovalError | null> {
  const res = await post<{ ok: boolean }>("confirm", { code });
  if (!res.ok) return res.error;
  // Ab ye phone active hai — cache turant sach par le aao, taaki alarm/token
  // wale gate agle hi pal khul jaayein.
  lastCheckAt = Date.now();
  set({ active: true, needsApproval: false, other: null });
  return null;
}
