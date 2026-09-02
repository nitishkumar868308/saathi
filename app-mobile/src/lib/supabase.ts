import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { errorBodyFor } from "./http-error-body";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";

/**
 * Har Supabase request isi se guzarti hai — sirf **galat status** par kuch badalta hai.
 *
 * ⚠️ Ye ek asli galti ka ilaaj hai: admin > Logs me `{"message":""}` aata tha,
 * jisse kabhi pata nahi chalta tha ki 500 tha, 403 tha, ya beech me network
 * kat gaya. Poori wajah `http-error-body.ts` ke upar likhi hai.
 *
 * ⚠️ Sahi jawab (`res.ok`) **bilkul chhua nahi jaata** — na body padhi jaati hai,
 * na naya Response banta hai. Wo raasta har list, har download aur har upload par
 * chalta hai; wahan body padh lena use doosri baar padhne layak nahi chhodta.
 */
async function fetchWithStatus(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input as RequestInfo, init);
  if (response.ok) return response;

  const body = await response.text();
  const replacement = errorBodyFor(response.status, response.statusText ?? "", body);

  /*
   * Body ek baar padh li gayi hai, isliye ab har soorat me naya Response banana
   * padta hai — chahe hum uska content badal rahe hon ya nahi. Purana lauta dene
   * par supabase-js use dobara padhne ki koshish karta hai aur khaali haath
   * rehta hai.
   */
  return new Response(replacement ?? body, {
    status: response.status,
    statusText: response.statusText,
    headers: replacement
      ? { "Content-Type": "application/json" }
      : response.headers,
  });
}

/** true jab .env mein Supabase URL + publishable key set ho */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Supabase client. `null` jab tak .env configure na ho (app crash na ho).
 * Screens use karne se pehle `isSupabaseConfigured` check karein.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      /*
       * ⚠️ Ye ek hi line un saari `if (error) throw error` wali jagahon ko theek
       * kar deti hai (abhi 28 hain, 8 file me) — unme se kisi ko chhue bina. Har
       * error ab apna status aur code le kar aati hai, aur `report-error.ts` ke
       * `DETAIL_KEYS` me `code` pehle se hai, isliye wo apne aap admin > Logs ke
       * context me chala jaata hai.
       */
      global: { fetch: fetchWithStatus },
    })
  : null;
