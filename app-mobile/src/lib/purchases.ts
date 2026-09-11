/**
 * RevenueCat wrapper — Android (Play Billing) aur iOS (StoreKit), dono.
 * Native module na mile (Expo Go) ya API key na ho to sab no-op.
 *
 * Prereq: entitlement "plus", ek offering jisme packages hon, aur **har platform
 * ki apni key**:
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY  (goog_…)
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY      (appl_…)
 *
 * ⚠️ Dono keys alag hoti hain — RevenueCat har app (Play / App Store) ke liye
 * apni key deta hai. Pehle yahan sirf Android wali padhi jaati thi, isliye iOS
 * build par `configure()` fail ho jaata aur poora Plus flow chup-chaap band
 * rehta. Ab platform ke hisaab se sahi key uthti hai.
 */
import { Platform } from "react-native";

let Purchases: any = null;
try {
  // Expo Go me ye throw kar sakta hai — catch me handle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

const API_KEY =
  (Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) ?? "";
const ENTITLEMENT = "plus";
let configured = false;

export function purchasesAvailable(): boolean {
  return Boolean(Purchases && API_KEY);
}

export async function initPurchases(appUserId?: string): Promise<void> {
  if (!purchasesAvailable() || configured) return;
  try {
    await Purchases.configure({ apiKey: API_KEY, appUserID: appUserId });
    configured = true;
  } catch {
    /* ignore */
  }
}

/**
 * Store ka ek package — humein iska sirf itna hissa chahiye.
 *
 * `priceString` wahi price hai jo Google Play sach me kaatega, pehle se user ke
 * desh aur currency me ("₹99", "$1.99"). Upgrade screen isse tab dikhati hai
 * jab Play chalu ho — taaki jo dikhe wahi kate.
 */
export type PurchasePackage = {
  product?: { identifier?: string; priceString?: string };
};

export async function getPlusPackages(): Promise<PurchasePackage[]> {
  if (!purchasesAvailable()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return (offerings.current?.availablePackages ?? []) as PurchasePackage[];
  } catch {
    return [];
  }
}

/**
 * Kharidari ke baad Plus DIYA ja sakega ya nahi — server se poochho.
 *
 * ── Ye kyun zaroori hai ────────────────────────────────────────────────
 *
 * ⚠️ App khud `profiles.plan` likh hi nahi sakti (aur ye sahi hai — warna APK
 * me padi anon key se koi bhi khud ko Plus de leta). Isliye Plus dene ka EK hi
 * raasta hai: RevenueCat ka webhook. Aur wo webhook server ke env se chalta hai,
 * jiska app ko kuch pata nahi hota.
 *
 * Un env ke bina jo hota tha wo sabse bura tha, aur poori tarah CHUP tha: paisa
 * sach me kat jaata, webhook 503 khaata, `plan` kabhi na badalta, aur app
 * "Plus chalu ho raha hai…" par hamesha ke liye atki rehti. Na koi error, na
 * koi alert — bas ek user jisne paisa diya aur use kuch nahi mila.
 *
 * ⚠️ Jawab na mile to hum `false` maante hain — kharidari ROK dete hain.
 *
 * Ye jaan-boojh ke hai. Do me se ek nuksan chunna hi tha: ya to net kharab hone
 * par ek sahi user thodi der kharid na paye (wo do minute baad dobara kharid
 * lega), ya wo paisa de kar kuch na paye (wo paisa apne aap wapas nahi aata,
 * aur bharosa to bilkul nahi). Pehla nuksan sasta hai.
 */
export async function billingReady(webUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${webUrl}/api/play/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { ready?: boolean };
    return body.ready === true;
  } catch {
    return false;
  }
}

export type PurchaseResult = {
  active: boolean;
  /** ISO date, ya `null` = lifetime (koi expiry nahi). */
  expiresAt: string | null;
};

/**
 * Purchase karo aur entitlement ki ASLI expiry lauta do.
 *
 * Expiry zaroori hai: iske bina profile me plan_expires_at null reh jaata tha,
 * jise "hamesha ke liye Plus" maan liya jaata — cancel/refund ke baad bhi.
 */
export async function purchasePlus(pkg: PurchasePackage): Promise<PurchaseResult> {
  if (!purchasesAvailable()) throw new Error("purchases unavailable");
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const ent = customerInfo.entitlements.active[ENTITLEMENT];
  return {
    active: Boolean(ent),
    expiresAt: (ent?.expirationDate as string | null | undefined) ?? null,
  };
}

export async function isPlusActive(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info.entitlements.active[ENTITLEMENT]);
  } catch {
    return false;
  }
}
