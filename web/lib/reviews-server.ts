/**
 * Website par dikhne wale ASLI reviews (item 1).
 *
 * App me review lete waqt user se saaf poocha jaata hai: "I allow Apka Saathi to
 * display this review on its website". Ab tak us haan ka koi matlab nahi tha —
 * landing page par teen haath se likhe testimonial pade the aur unke upar likha
 * tha "Asli Saathi users ki asli baat". Yahan se wo haan sach ban jaati hai.
 *
 * Data `public_reviews()` RPC se aata hai (supabase/reviews-public.sql). Seedha
 * table se NAHI padhte: `reviews` par anon ke liye koi select policy nahi hai
 * (aur honi bhi nahi chahiye — us table me user_id hai). RPC sirf utna lautata
 * hai jitna page par dikhna chahiye: rating, text, pehla naam, sheher, tareekh.
 *
 * ⚠️ Ye kabhi throw nahi karta. Env missing ho, SQL na chala ho, DB down ho —
 * khaali list laut aati hai aur page apne handwritten testimonials dikha deta
 * hai. Ek review na dikhne se poora landing page toot jaana bahut bura sauda hai.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type PublicReview = {
  id: string;
  rating: number;
  text: string;
  /** "Rohit S." — poora naam server bhejta hi nahi. Na ho to null. */
  name: string | null;
  /** Sheher, agar user ne profile me bharaa ho. */
  city: string | null;
  createdAt: string;
};

export type ReviewStats = {
  count: number;
  /** 1-5, ek decimal tak. Koi review na ho to null. */
  avg: number | null;
};

/** RPC call — fail ho to `null`. Kabhi throw nahi karta. */
async function rpc<T>(fn: string, body: Record<string, unknown> = {}): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      // Naya review turant dikhe par har visitor ki request DB tak na jaye.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Website par dikhane laayak reviews (naye pehle). Fail ho to khaali list. */
export async function getPublicReviews(limit = 12): Promise<PublicReview[]> {
  const rows = await rpc<Record<string, unknown>[]>("public_reviews", { p_limit: limit });
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      id: String(r.id ?? ""),
      rating: Number(r.rating ?? 0),
      text: typeof r.text === "string" ? r.text.trim() : "",
      name: (r.name as string) ?? null,
      city: (r.city as string) ?? null,
      createdAt: String(r.created_at ?? ""),
    }))
    // Server pehle hi ye shartein lagata hai; yahan dobara isliye ki ek adhoori
    // row poore section ko khaali quote-card dikhane par majboor na kar de.
    .filter((r) => r.id && r.text.length >= 8 && r.rating >= 1 && r.rating <= 5);
}

/** "X logon ne Y star diye" — sab reviews par (sirf dikhne walon par nahi). */
export async function getReviewStats(): Promise<ReviewStats> {
  const s = await rpc<{ count?: number; avg?: number | string | null }>(
    "public_review_stats",
  );
  const count = Number(s?.count ?? 0);
  const avgRaw = s?.avg == null ? null : Number(s.avg);
  return {
    count: Number.isFinite(count) && count > 0 ? count : 0,
    avg: avgRaw != null && Number.isFinite(avgRaw) ? avgRaw : null,
  };
}
