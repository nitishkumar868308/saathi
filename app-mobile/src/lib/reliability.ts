import { Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * "App band karne pe reminder nahi aata" — India ke phones (MIUI/Realme/Oppo/
 * Vivo/Samsung) aggressive battery optimization se app ke scheduled alarms ko
 * maar dete hain. Full-screen intent isse theek nahi karta; asli fix hai app ko
 * battery optimization se **chhoot** dilana.
 *
 * Ye koi special/risky permission nahi maangta — bas OS ka battery-optimization
 * settings screen kholta hai, jahan user app ko "unrestricted" kar de. Play Store
 * safe.
 */

const ASKED_KEY = "saathi-battery-asked";

/** Battery optimization settings screen kholo (Android). Best-effort. */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // Poori list — user app ko dhoondh ke "unrestricted" kar sakta hai.
    await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch {
    try {
      // Fallback: app ki apni settings (wahan se Battery -> Unrestricted).
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
  }
}

/** Kya humne pehle hi battery-optimization ka prompt dikhaya tha? */
export async function batteryPromptShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    return true; // storage na ho to dobara dobara mat poochho
  }
}

/** Prompt dikhane ke baad mark kar do — sirf ek baar poochhna hai. */
export async function markBatteryPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
}
