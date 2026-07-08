import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Signup ke waqt daala gaya referral code yahan rakha jaata hai.
 *
 * Zaroori kyun: signup ke turant baad session na ho (email confirm) ya Google
 * OAuth se aaye — dono case me `apply_referral_code` RPC tab tak call nahi ho
 * sakta. Isliye code save karo, aur pehle SIGNED_IN pe apply karke clear kar do.
 */

const KEY = "pending_referral_code";

export async function savePendingReferral(code: string): Promise<void> {
  const c = code.trim().toUpperCase();
  if (!c) return;
  try {
    await AsyncStorage.setItem(KEY, c);
  } catch {
    /* ignore */
  }
}

export async function takePendingReferral(): Promise<string | null> {
  try {
    const c = await AsyncStorage.getItem(KEY);
    if (c) await AsyncStorage.removeItem(KEY);
    return c;
  } catch {
    return null;
  }
}
