import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";
import { WEB_URL } from "./plan";
import { reportError } from "./report-error";

/**
 * Account delete — request bhejna, aur band kiye gaye account ko pehchaanna.
 *
 * ⚠️ Pehle app ka "Sab data delete" button SEEDHA delete karta tha:
 *
 *     sb.from("documents").delete().eq("user_id", uid)
 *     sb.from("reminders").delete().eq("user_id", uid)
 *
 * Wo teen alag tarah se galat tha:
 *
 *   1. **Wapas nahi aata.** Ek galti se laga tap par user ke saare documents
 *      hamesha ke liye chale jaate the. Ye wahi cheez hai jiske liye wo app
 *      laaya tha — passport, insurance, bijli ka bill. Uska koi backup nahi.
 *   2. **Adhoora delete.** Sirf DO table hatti thi. Notes, chat, support
 *      tickets, profile details, aur R2/storage me padi ASLI FILES sab wahin
 *      rehti thi. Yaani hum "delete ho gaya" keh ke jhooth bol rahe the.
 *   3. **Koi record nahi.** Play Store ki data-deletion shart me "kab maanga,
 *      kab poora hua" — dono ka saboot chahiye. Client-side delete ke baad
 *      dikhane ko kuch bachta hi nahi tha.
 *
 * Ab wahi raasta hai jo website ka delete-account form use karta hai: request
 * `account_delete_requests` me jaati hai, aur admin panel se do me se ek kaam
 * hota hai —
 *
 *   HIDE  (soft) — `profiles.deleted_at` set. Data DB me safe, par RLS use user
 *                  ki taraf se poori tarah band kar deti hai. Wapas laaya ja
 *                  sakta hai (user aksar do din baad wapas aata hai).
 *   PURGE (hard) — storage ki files, har table ki rows, aur auth user — sab.
 *
 * Dono soorat me app ko wahi dikhna chahiye jo sach hai: kuch bhi nahi.
 */

/** Request bhejne ka nateeja — screen isi se tay karti hai kya kehna hai. */
export type DeleteRequestResult =
  /** Nayi request darj ho gayi. */
  | "sent"
  /** Pehle se pending thi — user ko wahi tasalli deni hai, error nahi. */
  | "pending"
  /** Session hi nahi (kabhi nahi hona chahiye — screen login ke peeche hai). */
  | "no_auth"
  | "failed";

/**
 * Ye request bhej di ja chuki hai — is phone par yaad.
 *
 * ⚠️ App `account_delete_requests` PADH nahi sakti (wo table sirf service_role
 * ke liye khuli hai, aur ye jaan-boojh ke hai — ek user doosre ki request na
 * dekh paye). Isliye "aapki request pending hai" wali baat local yaad se aati
 * hai. Ye poora sach nahi hai (naya phone / app dobara install par khali ho
 * jaayega), par uska sabse bura nateeja bhi bas itna hai ki user dobara request
 * bhej de — aur server usse dedupe kar deta hai.
 */
const ASKED_KEY = "saathi-delete-asked:";

export async function deletionAsked(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  try {
    return (await AsyncStorage.getItem(ASKED_KEY + uid)) === "1";
  } catch {
    return false;
  }
}

async function rememberAsked(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY + uid, "1");
  } catch {
    /* yaad na rahe to bhi request server par darj ho chuki hai */
  }
}

/**
 * Account delete ki request admin ko bhejo.
 *
 * Naam/email jaan-boojh ke SESSION se aate hain, kisi form se nahi: user ko
 * apna hi email dobara type karwana yahan sirf ek aur galti ka mauka hai, aur
 * server ko waise bhi wahi email chahiye jisse account bana hai.
 */
export async function requestAccountDeletion(opts: {
  reason?: string;
  locale?: string;
}): Promise<DeleteRequestResult> {
  if (!supabase) return "failed";

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const email = user?.email?.trim();
  if (!user || !email) return "no_auth";

  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = (meta?.full_name || meta?.name || email.split("@")[0]).trim();

  try {
    const res = await fetch(`${WEB_URL}/api/account/delete-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        reason: opts.reason ?? "App se maangi gayi (Profile → Account delete)",
        locale: opts.locale,
      }),
    });
    const out = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      pending?: boolean;
      error?: string;
    };
    if (!res.ok || !out.ok) throw new Error(out.error ?? `HTTP ${res.status}`);

    await rememberAsked(user.id);
    return out.pending ? "pending" : "sent";
  } catch (e) {
    // ⚠️ Chup mat raho. Request ka kho jaana Play Store ki shart ka seedha
    // ullanghan hai — admin ko Logs me dikhna chahiye, aur user ko dobara
    // bhejne ka mauka.
    reportError(e, { screen: "settings", action: "delete_account_request" });
    return "failed";
  }
}

/* ----------------------- band kiya gaya account ----------------------- */

/**
 * Admin ne is account ko hide kar diya hai?
 *
 * `profiles.deleted_at` bhara ho to haan. Wo column app ko DIKHTA hai (select
 * wali policy jaan-boojh ke khuli hai) — sirf isi liye ki app user se saaf keh
 * sake ki "ye account band kar diya gaya hai". Baaki har table RLS se band ho
 * chuki hoti hai, isliye bina is check ke user ko ek aisi app milti jisme sab
 * kuch khaali hai aur kahin koi wajah nahi likhi — sabse buri soorat.
 *
 * Error par `false` — net na hone par account ko band bata dena usse kayi guna
 * bura hoga.
 */
export async function isAccountClosed(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("id", uid)
      .maybeSingle();
    if (error) return false;
    return Boolean((data as { deleted_at?: string | null } | null)?.deleted_at);
  } catch {
    return false;
  }
}
