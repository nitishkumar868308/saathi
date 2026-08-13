import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";
import { forgetLocalLock } from "./app-lock";
import { getDeviceId } from "./device";
import { resetDeviceState } from "./device-approval";

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
  /**
   * ⚠️ Lock ka local nishaan PEHLE hatao, session ke BAAD nahi.
   *
   * Do wajah, aur dono asli hain:
   *
   *   • Is phone par agla user koi AUR ho sakta hai. Uske saamne pehle wale ka
   *     PIN maangna sabse bekaar soorat hai — wo PIN use pata hi nahi hoga.
   *   • Server par lock waise ka waisa pada rehta hai. Yahi poora point hai:
   *     "logout karke lock hata lo" wala purana raasta ab band hai, kyunki
   *     dobara login karte hi `syncAppLock()` lock wapas le aata hai.
   *
   * `catch` isliye ki SecureStore ki kisi dikkat par logout khud na ruk jaye —
   * atka hua logout is se kahin zyada bura hai.
   */
  await forgetLocalLock().catch(() => {});

  /**
   * ⚠️ Is phone ka notification token bhi hatao — session hatane se PEHLE.
   *
   * Ye ek asli bug tha jo audit me pakda gaya. `device_tokens` ki row par purana
   * `user_id` pada reh jaata tha, aur us row se admin ka broadcast aur reminder
   * ki push seedha bheji jaati hai. Yaani LOGOUT KE BAAD BHI is phone par us
   * user ke reminder aur message aate rehte the. Bech diya hua ya kisi ko diya
   * hua phone iska sabse bura roop hai — uspar aapke reminder ka poora text
   * dikhta rehta.
   *
   * Session ke BAAD nahi kar sakte: tab `auth.uid()` khatam ho chuka hota hai
   * aur RPC apni hi row nahi dhoondh paata (wo `auth.uid()` par chalti hai).
   *
   * Fail ho to logout rukna NAHI chahiye — atka hua logout is se kahin bura hai.
   * Server par row reh jayegi, par agla login usi token ka maalik badal dega.
   */
  try {
    const sb = client();
    await sb.rpc("forget_my_device_tokens", { p_device_id: await getDeviceId() });
  } catch {
    /* best-effort */
  }

  await client().auth.signOut();
  // Agla user is phone par aaye to use purana haal na dikhe.
  resetDeviceState();
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

/**
 * Deep-link se auth ke tokens nikaalo — `?query` AUR `#fragment`, DONO se.
 *
 * ⚠️ Ye `export` hai aur dono jagah padhta hai, aur wahi is app ka sabse chupa
 * hua bug theek karta hai: **"Forgot password" ka email link kuch nahi karta
 * tha.**
 *
 * Wajah ye thi ki Supabase ka client default `flowType: "implicit"` par chalta
 * hai (dekho `lib/supabase.ts`), aur us flow me recovery link tokens **hash
 * fragment** me bhejta hai:
 *
 *     saathi://auth#access_token=…&refresh_token=…&type=recovery
 *
 * `app/auth.tsx` un tokens ko `useLocalSearchParams()` se padh raha tha — aur wo
 * sirf QUERY STRING padhta hai, fragment ko poori tarah gira deta hai. Yaani
 * link par tap karne se app to khulti thi, par uske paas kuch hota hi nahi tha:
 * session nahi banta tha, `type=recovery` dikhta hi nahi tha, aur screen chup-chaap
 * home par chali jaati thi. User ke liye link "kaam hi nahi karta".
 *
 * Google login isi bug se bacha hua tha kyunki wo `openAuthSessionAsync` ka
 * lautaya hua URL isi function se padhta hai — yaani fragment wala raasta yahan
 * pehle se sahi tha, bas recovery link us raaste se aata hi nahi.
 *
 * ⚠️ Yahan PKCE par switch karna aasan lagta hai (tab sab kuch `?code=` me aata
 * aur query hi kaafi hoti), par wo galat hoga: PKCE ka code_verifier USI phone
 * par bana hota hai jisne reset maanga tha. Log email aksar doosre device par
 * kholte hain, aur wahan PKCE poori tarah fail ho jaata. Implicit har jagah
 * chalta hai — isliye flow wahi rehta hai aur padhna theek kiya gaya hai.
 */
export function getParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const read = (chunk?: string) => {
    if (!chunk) return;
    for (const pair of chunk.split("&")) {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  };
  // Fragment PEHLE nahi — query pehle, taaki fragment (jo Supabase bharta hai)
  // uske upar baithe. Dono me ek hi naam aa jaye to naya wala hi sach hai.
  const hashAt = url.indexOf("#");
  const qAt = url.indexOf("?");
  const queryPart =
    qAt >= 0 ? url.slice(qAt + 1, hashAt > qAt ? hashAt : undefined) : undefined;
  const hashPart = hashAt >= 0 ? url.slice(hashAt + 1) : undefined;
  read(queryPart);
  read(hashPart);
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
