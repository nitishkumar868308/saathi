import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai (.env check karo)");
  return supabase;
}

/** Email + password se naya account (naam ke saath). */
export async function signUpEmail(email: string, password: string, name: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signInEmail(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/* ------------------------ password bhool gaye ------------------------ */

/**
 * "Password bhool gaya" — reset ka link email par bhejo.
 *
 * ⚠️ Ye poora raasta pehle THA HI NAHI. Email+password se bana account, aur
 * password bhool gaye — to app me kahin koi rasta nahi tha. Google wale to
 * phir bhi andar aa jaate the; email wale hamesha ke liye apne hi documents
 * aur reminders se bahar khade reh jaate the. Support bhi kuch nahi kar sakta
 * tha (password Supabase ke paas hashed hai, hum use dekh hi nahi sakte).
 *
 * ⚠️ Jawab hamesha KAAMYAAB dikhta hai, chahe wo email hamare paas ho ya na
 * ho. Wajah surakhsha hai: "ye email register nahi hai" bata dena kisi ko bhi
 * ye jaanne ka tareeka de deta hai ki kaun-kaun is app par hai (account
 * enumeration). Supabase khud bhi isi wajah se is call par error nahi deta.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const sb = client();
  // Wahi deep link jo Google login use karta hai — `app/auth.tsx` dono
  // sambhalta hai. Supabase link par `type=recovery` bhejta hai, jisse wo
  // screen pehchaan leti hai ki ab naya password poochna hai.
  const redirectTo = Linking.createURL("auth");
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  // Sirf network/config wali galti upar bhejte hain. "Email nahi mila" wali
  // baat jaan-boojh ke nigal jaate hain (upar dekho).
  if (error && !/not\s*found|invalid/i.test(error.message)) throw error;
}

/**
 * Naya password set karo — recovery link se aane ke BAAD.
 *
 * Ye tabhi chalta hai jab Supabase ne recovery session bana diya ho (link par
 * tap karne se). Bina us session ke `updateUser` khud hi mana kar deta hai —
 * yaani koi bhi bina link ke kisi ka password nahi badal sakta.
 */
export async function setNewPassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await client().auth.signOut();
}

/**
 * Baaki SAB phones se logout — yahi phone chalu rehta hai.
 *
 * `scope: "others"` Supabase par is user ke doosre saare refresh token maar
 * deta hai, apna wala chhod kar. Isi wajah se yahan `signOut()` (jo poora
 * session uda deta hai) use nahi kiya ja sakta — user ko apne hi phone par
 * dobara login karna padta, jo is button ka poora matlab hi ulta kar deta.
 */
export async function signOutOtherDevices() {
  const { error } = await client().auth.signOut({ scope: "others" });
  if (error) throw error;
}

function getParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
  if (!q) return out;
  for (const pair of q.split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

/** Google se login (Supabase OAuth + in-app browser). */
export async function signInGoogle() {
  const sb = client();
  const redirectTo = Linking.createURL("auth");
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" }, // saare accounts dikhaye
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google URL nahi mili");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // Agar browser ne redirect pakad liya, yahin session set kar do
  if (result.type === "success" && result.url) {
    const params = getParams(result.url);
    if (params.code) {
      await sb.auth.exchangeCodeForSession(params.code);
      return;
    }
    if (params.access_token && params.refresh_token) {
      await sb.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      return;
    }
  }
  // warna: deep-link `saathi://auth` route (auth.tsx) session handle karega — throw nahi
}
