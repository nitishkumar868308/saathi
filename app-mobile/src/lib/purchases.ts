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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purchasePlus(pkg: any): Promise<boolean> {
  if (!purchasesAvailable()) throw new Error("purchases unavailable");
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT]);
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
