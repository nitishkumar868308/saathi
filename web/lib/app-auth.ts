const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * "Ye request kis logged-in app user ki hai?"
 *
 * App apna Supabase access token `Authorization: Bearer ...` me bhejti hai; hum
 * use Supabase se hi puchhwate hain. Token khud se decode karke `sub` nikaal
 * lena aasaan tha — aur bilkul galat: JWT ka payload koi bhi likh sakta hai,
 * uski jaanch signature se hoti hai. Supabase se poochh lena hi wo ek jagah hai
 * jahan jhooth nahi chal sakta.
 *
 * ⚠️ Jahan bhi ye lagti hai, wahan user ki id kabhi REQUEST BODY se mat lena.
 * Body me `userId` bhejne dena ka matlab hai koi bhi kisi ke bhi naam par kaam
 * kar sakta hai. Yahi ek line poore phone-verification ko bekaar kar deti.
 *
 * Kuch bhi gadbad (token nahi, expire, Supabase down) → `null`. Caller 401 de.
 */
export async function appUserId(request: Request): Promise<string | null> {
  return (await appUser(request))?.id ?? null;
}

/**
 * Wahi jaanch, par email/naam ke saath.
 *
 * `appUserId` isi ke upar khada hai. Alag function isliye hai ki zyadatar
 * routes ko sirf id chahiye, aur unhe email tak pahunch dena bekaar hai — jitna
 * kam data ghoomta hai, utna kam kahin galti se log/response me pahunchta hai.
 * Jinhe email SACH ME chahiye (jaise PIN reset ka code bhejna), sirf wahi ye
 * bulate hain.
 */
export type AppUser = { id: string; email: string | null; name: string | null };

export async function appUser(request: Request): Promise<AppUser | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ") || !SUPABASE_URL || !ANON) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: header, apikey: ANON },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { full_name?: string; name?: string };
    };
    if (!user.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    };
  } catch {
    return null;
  }
}
