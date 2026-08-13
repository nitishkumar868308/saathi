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
