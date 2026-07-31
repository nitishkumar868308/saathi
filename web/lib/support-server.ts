/**
 * Support tickets ka server-side hissa — app aur admin panel dono ke liye.
 *
 * ⚠️ Ticket app se seedha Supabase me nahi banta, is route se hoke banta hai.
 * Wajah: banne ke saath hi do email jaani hoti hain (admin ko khabar, user ko
 * rasid), aur email sirf server bhej sakta hai. Agar app khud RPC maar ke phir
 * ek "email bhej do" wala endpoint bulaata, to wo endpoint bina pehchaan ke
 * khula rehta — koi bhi uspe spam bhej sakta tha.
 *
 * Isliye app apna Supabase access token bhejti hai, hum use Supabase se hi
 * verify karte hain, aur uske BAAD hi kuch hota hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Anon key — token verify karne ke liye chahiye.
 *
 * ⚠️ Is repo me anon key teen alag naamon se chali aa rahi hai: web ka
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`, app ka `EXPO_PUBLIC_SUPABASE_KEY`, aur edge
 * functions ka apne aap inject hone wala `SUPABASE_ANON_KEY`. Sirf ek naam
 * padhne par ye chup-chaap fail hota tha: har support request 401 lautati, aur
 * user ko "bheja nahi ja saka" dikhta — jabki galti sirf naam ki thi.
 */
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_KEY;

const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supportConfigured(): boolean {
  return !!(SUPABASE_URL && SERVICE);
}

/* ------------------------------ auth ------------------------------ */

/** Request ka `Authorization: Bearer <access_token>` sach me kiska hai. */
export async function userFromRequest(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth || !SUPABASE_URL || !ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: ANON },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string };
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * User ke apne token se RPC chalao.
 *
 * Service-role se chalana yahan galat hota: tab `auth.uid()` null hota aur SQL
 * ke saare "ye ticket isi user ka hai?" wale check bekaar ho jaate.
 */
export async function userRpc<T>(
  request: Request,
  fn: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  const auth = request.headers.get("authorization");
  if (!auth || !SUPABASE_URL || !ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        Authorization: auth,
        apikey: ANON,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------------------------- admin reads ---------------------------- */

function serviceHeaders() {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json",
  };
}

export async function adminGet<T>(query: string): Promise<T[]> {
  if (!SUPABASE_URL || !SERVICE) throw new Error("supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: serviceHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function adminPost<T>(path: string, body: unknown): Promise<T[]> {
  if (!SUPABASE_URL || !SERVICE) throw new Error("supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function adminPatch(path: string, body: unknown): Promise<void> {
  if (!SUPABASE_URL || !SERVICE) throw new Error("supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
}

/* ------------------------------ types ------------------------------ */

export type Ticket = {
  id: string;
  ticket_no: string;
  user_id: string;
  email: string | null;
  name: string | null;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
};

export type TicketMessage = {
  id: number;
  ticket_id: string;
  sender: string;
  body: string;
  seen_at: string | null;
  created_at: string;
};

/** Ek ticket ke saare device tokens — jawab ki notification ke liye. */
export async function tokensForUser(userId: string): Promise<string[]> {
  const rows = await adminGet<{ token: string }>(
    `device_tokens?select=token&user_id=eq.${userId}`,
  ).catch(() => []);
  return rows.map((r) => r.token).filter(Boolean);
}
