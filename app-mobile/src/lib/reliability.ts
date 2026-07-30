import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import notifee, {
  AndroidNotificationSetting,
  AuthorizationStatus,
} from "@notifee/react-native";

/**
 * "Reminder time pe nahi aaya" ka asli fix.
 *
 * Android par ek reminder theek waqt pe bajne ke liye CHAAR cheezein chahiye —
 * ek bhi missing ho to notification ya to aata hi nahi, ya OS use doosre alarms
 * ke saath batch karke der se (kabhi 5-10 min baad) deta hai:
 *
 *   1. notif   — POST_NOTIFICATIONS permission (Android 13+)
 *   2. alarm   — SCHEDULE_EXACT_ALARM ka user grant (Android 12+ / API 31+).
 *                Ye NA ho to AlarmManager exact alarm ko chupchaap INEXACT bana
 *                deta hai — isi wajah se 8:36 wala reminder 8:38 pe, 8:39 wale
 *                ke saath, ek hi jhund me aata tha.
 *   3. battery — app battery optimization se chhoot (doze me alarm na mare)
 *   4. fsi     — "Full screen notifications" (Android 14+ / API 34+). YAHI wo
 *                cheez hai jiske bina reminder ka BADA popup screen ke beech me
 *                nahi aata — sirf upar patli si notification aati hai.
 *
 *                Android 14 se pehle `USE_FULL_SCREEN_INTENT` manifest me likh
 *                dena kaafi tha. Ab wo ek "special app access" ban gaya hai:
 *                Google ne alarm/calling apps ke alawa sab ke liye ise DEFAULT
 *                SE BAND kar diya. Isliye user sab kuch allow kar deta hai, sab
 *                green dikhta hai, aur phir bhi bada alert kabhi nahi aata
 *                (item 11).
 *
 *                Iska status padhne ka koi JS API nahi hai (notifee me bhi
 *                nahi), isliye `oem` ki tarah: user ek baar screen khol le to
 *                step done maan lete hain.
 *
 *   5. oem     — MIUI/ColorOS/FuntouchOS/OneUI ka apna "auto-start / background"
 *                switch. notifee `getPowerManagerInfo()` batata hai ki is device
 *                par aisi screen hai ya nahi.
 *
 * Yahan sirf status padha aur OS ka sahi screen khola jaata hai — koi risky
 * permission nahi. UI `components/permission-modal.tsx` me hai.
 */

const ASKED_KEY = "saathi-reliability-asked";
const OEM_KEY = "saathi-oem-done";
const FSI_KEY = "saathi-fsi-done";

/** Full-screen intent "special app access" Android 14 (API 34) se aaya. */
const FSI_MIN_API = 34;

export type StepKey = "notif" | "alarm" | "fsi" | "battery" | "oem";

export type ReadinessStep = {
  key: StepKey;
  /** Is device/OS version par ye step lagu hota hai? */
  supported: boolean;
  /** Ho chuka hai? */
  ok: boolean;
};

export type Readiness = {
  steps: ReadinessStep[];
  /** Sab lagu steps ho chuke? */
  allOk: boolean;
  /** Jo abhi baaki hain — UI inhi par focus karta hai. */
  pending: StepKey[];
  /** OEM step ke liye manufacturer ka naam — "Xiaomi", "Realme"… */
  oemName: string | null;
};

const EMPTY: Readiness = { steps: [], allOk: true, pending: [], oemName: null };

/**
 * Chaaron cheezon ka abhi ka status.
 *
 * iOS par sirf pehla step (notification permission) lagu hota hai — exact alarm,
 * battery aur OEM auto-start wali dikkatein wahan hain hi nahi. Pehle iOS par
 * poori list khaali laut aati thi, jiski wajah se modal bina kuch check kiye
 * "sab set hai" dikha deta tha — chaahe notifications band hi kyun na hon.
 */
export async function checkReadiness(): Promise<Readiness> {
  if (Platform.OS === "web") return EMPTY;

  if (Platform.OS !== "android") {
    const settings = await notifee.getNotificationSettings().catch(() => null);
    const ok =
      settings?.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings?.authorizationStatus === AuthorizationStatus.PROVISIONAL;
    const steps: ReadinessStep[] = [{ key: "notif", supported: true, ok }];
    return { steps, allOk: ok, pending: ok ? [] : ["notif"], oemName: null };
  }

  const [settings, batteryOn, power, oemDone, fsiDone] = await Promise.all([
    notifee.getNotificationSettings().catch(() => null),
    notifee.isBatteryOptimizationEnabled().catch(() => false),
    notifee
      .getPowerManagerInfo()
      .catch(() => ({}) as { activity?: string | null; manufacturer?: string }),
    AsyncStorage.getItem(OEM_KEY).catch(() => null),
    AsyncStorage.getItem(FSI_KEY).catch(() => null),
  ]);

  const notifOk =
    settings?.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings?.authorizationStatus === AuthorizationStatus.PROVISIONAL;

  // NOT_SUPPORTED = Android 11 ya purana — wahan exact alarm bina grant ke chalta
  // hai, isliye step dikhane ki zaroorat hi nahi.
  const alarmSetting = settings?.android?.alarm ?? AndroidNotificationSetting.NOT_SUPPORTED;
  const alarmSupported = alarmSetting !== AndroidNotificationSetting.NOT_SUPPORTED;
  const oemActivity = power?.activity ?? null;

  // Android 14+ par hi "Full screen notifications" wali screen hoti hai.
  const fsiSupported = (Device.platformApiLevel ?? 0) >= FSI_MIN_API;

  const steps: ReadinessStep[] = [
    { key: "notif", supported: true, ok: !!notifOk },
    {
      key: "alarm",
      supported: alarmSupported,
      ok: !alarmSupported || alarmSetting === AndroidNotificationSetting.ENABLED,
    },
    // OS iska status nahi batata (koi API nahi) — `oem` ki tarah, ek baar khol
    // lene par done maante hain. Warna step kabhi green hi na ho.
    { key: "fsi", supported: fsiSupported, ok: !fsiSupported || fsiDone === "1" },
    { key: "battery", supported: true, ok: !batteryOn },
    // OEM screen ka status OS nahi batata (koi API hi nahi). Isliye "ok" tab
    // maante hain jab user ek baar khol chuka ho — warna step kabhi green na ho.
    { key: "oem", supported: !!oemActivity, ok: !oemActivity || oemDone === "1" },
  ];

  const pending = steps.filter((s) => s.supported && !s.ok).map((s) => s.key);

  return {
    steps,
    allOk: pending.length === 0,
    pending,
    oemName: power?.manufacturer ?? null,
  };
}

/**
 * Battery optimization ki chhoot maango — **system popup** ke zariye.
 *
 * ⚠️ Yahan notifee ka `openBatteryOptimizationSettings()` jaan-boojh ke nahi
 * hai. Uska naam dhoka deta hai: wo `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`
 * bhejta hai, jo phone ki **saari apps ki lambi list** khol deta hai. User ko
 * usme apna app dhoondhna padta hai — 10 me se 9 log wahin chhod dete hain, aur
 * "popup aata hi nahi" wali shikayat wahi se aati thi.
 *
 * Asli popup `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` se aata hai, aur wo
 * chalta hi tab hai jab intent ke saath `data = package:<applicationId>` ho.
 * Notifee ke paas is intent ka koi API nahi, isliye IntentLauncher se khud
 * bhejte hain.
 *
 * Ye Android ka ek "sensitive" intent hai — chhoot pehle se mili ho to OS popup
 * dikhata hi nahi, aur kuch OEM ise block bhi kar dete hain. Dono soorat me
 * neeche wali list-screen fallback chal jaati hai, taaki user kabhi bina raaste
 * ke na rahe.
 */
async function requestBatteryExemption(): Promise<void> {
  const pkg = Application.applicationId;
  if (pkg) {
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        { data: `package:${pkg}` },
      );
      return;
    } catch {
      /* OEM ne block kiya ya chhoot pehle se hai — neeche list screen kholte hain */
    }
  }
  await notifee.openBatteryOptimizationSettings();
}

/** Ek step ke liye OS ka sahi dialog/screen kholo. */
export async function requestStep(key: StepKey): Promise<void> {
  if (Platform.OS === "web") return;
  // Baaki teen steps sirf Android ki dikkatein hain — iOS par un rows ko
  // `checkReadiness()` bhejta hi nahi, par yahan bhi guard rakhna zaroori hai
  // taaki koi galti se Android-only intent iOS par na chala de.
  if (Platform.OS !== "android" && key !== "notif") return;
  try {
    switch (key) {
      case "notif": {
        const before = await notifee.getNotificationSettings();
        await notifee.requestPermission();
        const after = await notifee.getNotificationSettings();
        // Dono platform par ek hi dikkat: permission ek baar pakka mana ho jaane
        // ke baad OS dobara dialog dikhata hi nahi (Android 13+ par do "Don't
        // allow" ke baad, iOS par pehle "Don't Allow" ke baad hi).
        // requestPermission() chupchaap wahi DENIED lauta deti hai — bina iske
        // user "Allow" dabata rehta aur kuch hota hi nahi dikhta.
        //
        // Aise me settings khol dete hain, jahan se manually on ho sakta hai.
        // Android par app ki notification settings; iOS par notifee ka ye API
        // no-op hai, isliye wahan RN ka `Linking.openSettings()` chalta hai.
        if (
          after.authorizationStatus === before.authorizationStatus &&
          after.authorizationStatus === AuthorizationStatus.DENIED
        ) {
          if (Platform.OS === "android") await notifee.openNotificationSettings();
          else await Linking.openSettings();
        }
        return;
      }
      case "alarm":
        // "Alarms & reminders" — Android 12+ ka dedicated screen.
        await notifee.openAlarmPermissionSettings();
        return;
      case "fsi": {
        // "Full screen notifications" — Android 14+ ka special app access.
        // Isi ke bina reminder ka bada popup nahi aata (item 11).
        await AsyncStorage.setItem(FSI_KEY, "1").catch(() => {});
        const pkg = Application.applicationId;
        try {
          await IntentLauncher.startActivityAsync(
            "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
            pkg ? { data: `package:${pkg}` } : {},
          );
        } catch {
          // Kuch OEM ye screen nahi dete — app ki notification settings hi
          // khol do, wahan se bhi raasta mil jaata hai.
          await notifee.openNotificationSettings();
        }
        return;
      }
      case "battery":
        await requestBatteryExemption();
        return;
      case "oem":
        await AsyncStorage.setItem(OEM_KEY, "1").catch(() => {});
        await notifee.openPowerManagerSettings();
        return;
    }
  } catch {
    /* screen na khule to modal wahi rehta hai — user dobara try kar sakta hai */
  }
}

/** Kya humne reliability modal pehle dikhaya tha? */
export async function reliabilityPromptShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    return true; // storage na chale to baar-baar mat poochho
  }
}

export async function markReliabilityPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
}

