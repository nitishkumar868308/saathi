/**
 * Service usage log — WhatsApp aur email ka hisaab (item 3).
 *
 * Gemini ka hisaab edge function khud rakhta hai (supabase/functions/ai). Yahan
 * se wahi ek table bhara jaata hai jo web se nikalne wale kaam ke liye hai:
 * Twilio ke WhatsApp aur SMTP ke email.
 *
 * Table: supabase/service-usage.sql
 *
 * ⚠️ Ye hamesha best-effort hai. Hisaab likhne me dikkat aane par WhatsApp ya
 * email ka kaam nahi rukna chahiye — user ka reminder hisaab-kitab se zyada
 * zaroori hai. Isliye har call `void` hoti hai aur error nigal liya jaata hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type UsageService = "twilio" | "email";

export function logServiceUsage(
  service: UsageService,
  kind: string,
  opts: {
    ok?: boolean;
    userId?: string | null;
    units?: number;
    meta?: Record<string, unknown>;
  } = {},
): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  void fetch(`${SUPABASE_URL}/rest/v1/service_usage`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      service,
      kind,
      user_id: opts.userId ?? null,
      units: opts.units ?? 1,
      ok: opts.ok ?? true,
      meta: opts.meta ?? null,
    }),
    cache: "no-store",
  }).catch(() => {
    /* best-effort */
  });
}
