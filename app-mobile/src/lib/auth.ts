import AsyncStorage from "@react-native-async-storage/async-storage";
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

/**
 * Email + password se naya account (naam aur bhasha ke saath).
 *
 * ⚠️ `language` ko metadata me bhejna zaroori hai, chahe wo `profiles` me bhi
 * jaati ho. Wajah waqt ki hai: confirm wala email Supabase usi pal bhej deta hai
 * jab `auth.users` ki row banti hai — `profiles` ki row (aur uska `language`) us
 * waqt tak nahi hoti. Bina iske hamara Send Email Hook (`web/app/api/auth-email`)
 * bhasha kahin se padh hi nahi sakta, aur account banate waqt ka pehla email —
 * theek wo email jo Hindi wale buzurg ke liye sabse zyada maayne rakhta hai —
 * hamesha Hinglish me chala jaata.
 */
export async function signUpEmail(
  email: string,
  password: string,
  name: string,
  language?: string,
) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { data: { full_name: name, ...(language ? { language } : {}) } },
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
  // Link laut ke aaye (ya toot ke aaye) tab pata hona chahiye ki wo RESET ka
  // tha — neeche poori wajah likhi hai.
  await rememberPendingReset(email.trim());
}

/**
 * "Is phone se abhi-abhi password reset maanga gaya tha" — ek chhota sa nishaan.
 *
 * ⚠️ Ye jugaad nahi hai, iske bina ek asli galti hoti hai. Jab Supabase reset ke
 * link par MANA karta hai (token ek baar chal ke khatam ho chuka — email ke
 * scanner ke chhoote hi aisa hota hai), to jawab me sirf itna aata hai:
 *
 *     saathi://auth#error=access_denied&error_code=otp_expired
 *
 * Usme `type=recovery` HOTA HI NAHI. Yaani us error ko dekh kar ye bataya hi
 * nahi ja sakta ki ye reset ka link tha ya Google login ka — aur dono ka agla
 * kadam bilkul ulta hai (reset wale ko reset screen chahiye, Google wale ko
 * login). Bina is nishaan ke ya to reset wale login par phenke jaate (wahi
 * purani shikayat), ya Google wale bewajah reset screen par pahunch jaate.
 *
 * 24 ghante ki umar jaan-boojh ke: Supabase ka link waise bhi 1 ghante me mar
 * jaata hai, aur mahine bhar purana nishaan kisi aur din ke Google login ko
 * galat jagah bhej deta.
 */
const RESET_PENDING_KEY = "saathi-reset-pending";
const RESET_PENDING_MS = 24 * 60 * 60 * 1000;

async function rememberPendingReset(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(RESET_PENDING_KEY, JSON.stringify({ email, at: Date.now() }));
  } catch {
    /* Nishaan na lag paaye to sirf itna hota hai ki toote hue link par screen
       login dikhayegi — code wala raasta phir bhi khula rehta hai. */
  }
}

/** Us reset ka email jo abhi tak poora nahi hua. Purana/na ho to `null`. */
export async function pendingPasswordReset(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(RESET_PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { email?: string; at?: number };
    if (!v?.email || !v?.at || Date.now() - v.at > RESET_PENDING_MS) return null;
    return v.email;
  } catch {
    return null;
  }
}

/** Password badal gaya — nishaan hata do. */
export async function clearPendingPasswordReset(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RESET_PENDING_KEY);
  } catch {
    /* best-effort — 24 ghante me khud bhi mar jaata hai */
  }
}

/**
 * Reset ka CODE — link ka doosra, aur zyada bharosemand, raasta.
 *
 * ── Ye kyun chahiye tha ─────────────────────────────────────────────────
 *
 * ⚠️ Link wala raasta bahut si aisi jagah tootta hai jahan hamara koi bas nahi
 * chalta, aur toot-ne par user ko bilkul ek jaisa dikhta hai: "app khul gayi,
 * par login hi maang rahi hai". Char asli wajah:
 *
 *   1. **Email ka scanner link pehle hi kha jaata hai.** Gmail/Outlook har link
 *      ko surakhsha ke liye khud khol ke dekhte hain. Recovery ka token EK BAAR
 *      chalne wala hota hai — scanner ke chhoote hi wo khatam. User jab tap
 *      karta hai to Supabase `#error=access_denied&error_code=otp_expired`
 *      wapas bhejta hai, yaani token to hai hi nahi.
 *   2. **Email doosre device par khula.** Log mail aksar laptop par kholte hain.
 *      Wahan `saathi://` scheme ko koi nahi jaanta — link kuch karta hi nahi.
 *   3. **Redirect URL allow-list.** `saathi://auth` Supabase ke Authentication >
 *      URL Configuration me na ho to Supabase use anadekha karke Site URL
 *      (website) par bhej deta hai — app kabhi khulti hi nahi.
 *   4. **Link ki umar.** Default 1 ghanta. Raat ko maanga, subah khola — gaya.
 *
 * Code in chaaron se poori tarah bacha hua hai: wo email ke TEXT me hota hai,
 * kisi link par tap karne ki zaroorat hi nahi, aur user use kisi bhi device se
 * padh ke apne phone me type kar sakta hai.
 *
 * ⚠️ Code ki LAMBAI yahan tay nahi hoti. Wo Supabase ka setting hai
 * (Authentication > Sign In / Providers > Email > Email OTP Length, 6 se 10
 * tak) aur email me jitne ank aate
 * hain, `verifyOtp` bhi utne hi maangta hai — poora, waisa hi. Ek waqt is par
 * asli bug tha: dashboard 8 par set tha aur screen 6 ke baad kaat deti thi,
 * yaani ye raasta user ko dikhta tha par chal kabhi nahi sakta tha. Isliye ab
 * `forgot-password.tsx` koi ginti nahi maanti (`CODE_MAX`), aur email apni ginti
 * khud gin ke likhta hai. Kahin bhi 6 likh dena wahi bug wapas le aayega.
 *
 * ⚠️ Code email me pahunchta hai `web/app/api/auth-email` se — Supabase ka Send
 * Email Hook. Wahi mail user ki bhasha me bhejta hai. Hook band ho to Supabase
 * apne Authentication > Emails wale template par gir jaata hai, aur us template
 * me `{{ .Token }}` hona ZAROORI hai — sirf `{{ .ConfirmationURL }}` wale
 * template me code aata hi nahi.
 *
 * Kaamyab hone par yahan poora recovery session ban jaata hai — bilkul wahi jo
 * link se banta — isliye iske turant baad `setNewPassword()` chal sakta hai.
 */
export async function verifyPasswordResetCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\D/g, ""),
    type: "recovery",
  });
  if (error) throw error;
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
