import { supabase } from "./supabase";
import { WEB_URL } from "./plan";
import type { Locale } from "./i18n/dictionaries";

/**
 * Naye user ko welcome email bhejwao (web `/api/welcome` ke through).
 *
 * Server apne aap ek hi baar bhejta hai (profiles.welcomed_at), isliye har
 * login pe call karna safe hai. Access token bhejte hain taaki server sirf
 * apne hi email pe bhej sake. Best-effort — fail ho to app na ruke.
 */
export async function sendWelcomeEmail(locale: Locale): Promise<void> {
  try {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch(`${WEB_URL}/api/welcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ locale }),
    });
  } catch {
    /* best-effort */
  }
}
