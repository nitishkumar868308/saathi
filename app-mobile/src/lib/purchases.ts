/**
 * RevenueCat (Google Play Billing) wrapper — safe.
 * Native module na mile (Expo Go) ya API key na ho to sab no-op.
 * Prereq: EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, entitlement "plus", offering with packages.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
try {
  // Expo Go me ye throw kar sakta hai — catch me handle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlusPackages(): Promise<any[]> {
  if (!purchasesAvailable()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purchasePlus(pkg: any): Promise<PurchaseResult> {
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
