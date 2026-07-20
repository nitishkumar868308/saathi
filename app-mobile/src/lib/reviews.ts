import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

const FIRST_OPEN = "saathi-first-open";
const REVIEW_DONE = "saathi-review-done";
const REVIEW_SNOOZE = "saathi-review-snooze";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 2 * 24 * 60 * 60 * 1000;

/** Play Store listing — rate/share nudge ke liye. */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.saathi.app";

/** Pehli baar app khulne ka time record karo (agar pehle se na ho). */
export async function markFirstOpen(): Promise<void> {
  try {
    const cur = await AsyncStorage.getItem(FIRST_OPEN);
    if (!cur) await AsyncStorage.setItem(FIRST_OPEN, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Review popup dikhana chahiye? 1 hafte baad, ek baar (snooze pe 2 din ruko). */
export async function shouldShowReview(): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(REVIEW_DONE)) return false;
    const firstStr = await AsyncStorage.getItem(FIRST_OPEN);
    if (!firstStr) {
      await markFirstOpen();
      return false;
    }
    const first = Number(firstStr);
    if (!Number.isFinite(first) || Date.now() - first < WEEK_MS) return false;
    const snooze = Number(await AsyncStorage.getItem(REVIEW_SNOOZE));
    if (Number.isFinite(snooze) && snooze > 0 && Date.now() - snooze < SNOOZE_MS) return false;
    return true;
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

/** Review DB me save karo (poora detail — admin me dikhega). */
export async function submitReview(input: {
  rating: number;
  text: string;
  allowDisplay: boolean;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) return false;
    const { error } = await supabase.from("reviews").insert({
      user_id: u.user.id,
      rating: input.rating,
      text: input.text.trim() || null,
      allow_display: input.allowDisplay,
    });
    return !error;
  } catch {
    return false;
  }
}
