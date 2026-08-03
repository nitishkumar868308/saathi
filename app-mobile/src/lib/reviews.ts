import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

const FIRST_OPEN = "saathi-first-open";
const REVIEW_DONE = "saathi-review-done";
const REVIEW_SNOOZE = "saathi-review-snooze";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Review kab poochein — do raaste (item 4).
 *
 * ⚠️ Pehle sirf ek shart thi: app khole hue 1 hafta ho jaye. Iska matlab ye tha
 * ki jo user pehle hi din sab kuch set kar deta — document daal deta, reminder
 * laga deta, sab kaam karta dekh leta — usse chh din tak kuch poocha hi nahi
 * jaata. Rating maangne ka sabse achha lamha wahi hota hai jab abhi-abhi kuch
 * kaam karke dikha ho, hafte bhar baad nahi.
 *
 * Ab do me se jo pehle ho:
 *   A. User ne pehla document AUR pehla reminder dono bana liye — matlab usne
 *      app ka poora waada khud dekh liya. Turant poochho.
 *   B. Warna purana raasta: 1 hafta.
 *
 * Dono soorat me sirf EK baar. "Baad me" par 2 din ka aaram.
 */
const HAS_DOC = "saathi-has-doc";
const HAS_REMINDER = "saathi-has-reminder";

/**
 * Padav pura hone par ReviewPrompt ko turant khabar.
 *
 * Iske bina popup ko agli app-launch tak intezaar karna padta — aur wahi lamha
 * nikal jaata jab user ne abhi-abhi kuch kaam hote dekha ho.
 */
const milestoneListeners = new Set<() => void>();

export function onMilestone(fn: () => void): () => void {
  milestoneListeners.add(fn);
  return () => milestoneListeners.delete(fn);
}

function emitMilestone() {
  milestoneListeners.forEach((f) => f());
}

/** Play Store listing — rate/share nudge ke liye. */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.apkasaathi.app";

/** Pehli baar app khulne ka time record karo (agar pehle se na ho). */
export async function markFirstOpen(): Promise<void> {
  try {
    const cur = await AsyncStorage.getItem(FIRST_OPEN);
    if (!cur) await AsyncStorage.setItem(FIRST_OPEN, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Pehla document ban gaya — yaad rakh lo.
 * Sirf pehli baar likhta hai; baar-baar likhne ka koi matlab nahi.
 */
export async function markFirstDocument(): Promise<void> {
  try {
    if (!(await AsyncStorage.getItem(HAS_DOC)))
      await AsyncStorage.setItem(HAS_DOC, String(Date.now()));
    emitMilestone();
  } catch {
    /* ignore */
  }
}

/** Pehla reminder ban gaya — yaad rakh lo. */
export async function markFirstReminder(): Promise<void> {
  try {
    if (!(await AsyncStorage.getItem(HAS_REMINDER)))
      await AsyncStorage.setItem(HAS_REMINDER, String(Date.now()));
    emitMilestone();
  } catch {
    /* ignore */
  }
}

/** Dono padav ho gaye? (register ke baad 1 document + 1 reminder) */
async function reachedMilestone(): Promise<boolean> {
  const [doc, rem] = await Promise.all([
    AsyncStorage.getItem(HAS_DOC),
    AsyncStorage.getItem(HAS_REMINDER),
  ]);
  return !!doc && !!rem;
}

/**
 * Review popup dikhana chahiye?
 *
 * Haan, jab: pehle se poocha na ho, snooze khatam ho, AUR ya to dono padav ho
 * chuke hon (1 document + 1 reminder) ya app khole hue 1 hafta ho gaya ho.
 */
export async function shouldShowReview(): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(REVIEW_DONE)) return false;

    // "Baad me" kaha tha — 2 din tak dobara mat poochho.
    const snooze = Number(await AsyncStorage.getItem(REVIEW_SNOOZE));
    if (Number.isFinite(snooze) && snooze > 0 && Date.now() - snooze < SNOOZE_MS) return false;

    // Raasta A — user ne document bhi daala aur reminder bhi lagaya.
    if (await reachedMilestone()) return true;

    // Raasta B — 1 hafta.
    const firstStr = await AsyncStorage.getItem(FIRST_OPEN);
    if (!firstStr) {
      await markFirstOpen();
      return false;
    }
    const first = Number(firstStr);
    return Number.isFinite(first) && Date.now() - first >= WEEK_MS;
  } catch {
    return false;
  }
}

export async function snoozeReview(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_SNOOZE, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export async function markReviewDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_DONE, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Review DB me save karo (poora detail — admin me dikhega, aur anumati ho to
 * website par bhi).
 *
 * ⚠️ Pehle ye seedha `insert` tha, aur usse ek banda kai baar review de sakta
 * tha. Popup ki "ek hi baar poochho" wali yaad AsyncStorage me rehti hai — wo
 * app hatane par mit jaati hai, isliye reinstall ke baad wahi user dobara poocha
 * jaata aur DB me doosri row ban jaati thi. Ab website par reviews dikhte hain,
 * aur wahan ek hi aadmi ke do card sabse pehli cheez hai jise log dekh kar
 * "fake reviews" kehte hain.
 *
 * Isliye ab: apni purani row ho to usse BADLO, warna nayi banao. Ek banda, ek
 * raay — aur wo raay badalne ka haq bhi usi ke paas.
 */
export async function submitReview(input: {
  rating: number;
  text: string;
  allowDisplay: boolean;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return false;

    const row = {
      rating: input.rating,
      text: input.text.trim() || null,
      allow_display: input.allowDisplay,
    };

    // RLS apne aap sirf apni row dikhati hai, par `eq` phir bhi likhte hain —
    // niyat code me dikhni chahiye, sirf policy me nahi.
    const { data: mine } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mine?.id) {
      const { error } = await supabase
        .from("reviews")
        .update(row)
        .eq("id", mine.id)
        .eq("user_id", uid);
      return !error;
    }

    const { error } = await supabase.from("reviews").insert({ user_id: uid, ...row });
    return !error;
  } catch {
    return false;
  }
}
