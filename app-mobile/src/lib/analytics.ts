/**
 * Analytics + Crashlytics wrapper (#6).
 *
 * ABHI NO-OP hai — koi Firebase call nahi (isliye Expo Go / bina google-services
 * ke kuch nahi tootta). Firebase enable karne ke baad (dekho FIREBASE-SETUP.md)
 * neeche `USE_FIREBASE` true karo aur do require lines uncomment karo — poori app
 * me jitne bhi logEvent/recordError/logScreen calls hain, sab apne aap live ho
 * jaayenge. Kahin aur code change nahi karna.
 */

// Firebase install + google-services.json add karne ke baad:
//   1. USE_FIREBASE = true
//   2. neeche ke do require uncomment karo
const USE_FIREBASE = false;

// import analytics from "@react-native-firebase/analytics";
// import crashlytics from "@react-native-firebase/crashlytics";
const analytics: any = null;
const crashlytics: any = null;

/** Koi event log karo (jaise "reminder_created", "document_added"). */
export function logEvent(name: string, params?: Record<string, unknown>): void {
  if (!USE_FIREBASE || !analytics) return;
  try {
    analytics().logEvent(name, params);
  } catch {
    /* best-effort */
  }
}

/** Screen view (navigation ke liye). */
export function logScreen(name: string): void {
  if (!USE_FIREBASE || !analytics) return;
  try {
    analytics().logScreenView({ screen_name: name, screen_class: name });
  } catch {
    /* best-effort */
  }
}

/** Non-fatal error Crashlytics me record karo. */
export function recordError(err: unknown, context?: string): void {
  if (!USE_FIREBASE || !crashlytics) return;
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    if (context) crashlytics().log(context);
    crashlytics().recordError(e);
  } catch {
    /* best-effort */
  }
}

/** Logged-in user ko analytics/crashlytics se jodo (id + optional plan). */
export function setAnalyticsUser(userId: string | null, plan?: string): void {
  if (!USE_FIREBASE || !analytics) return;
  try {
    analytics().setUserId(userId);
    if (plan) analytics().setUserProperty("plan", plan);
    if (userId && crashlytics) crashlytics().setUserId(userId);
  } catch {
    /* best-effort */
  }
}
