import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router/js-stack";
import { useRouter, useSegments, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/theme/colors";
import { ToastProvider } from "@/components/toast";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { LanguageProvider, useLocale } from "@/lib/i18n/LanguageProvider";
import { ReminderAlertHost } from "@/components/reminder-alert";
import { ReviewPrompt } from "@/components/review-prompt";
import { DeviceOwnerWarning } from "@/components/device-owner-warning";
import { NetworkBanner } from "@/components/network-banner";
import { NetAlertModal } from "@/components/net-alert-modal";
import { ScreenLoader } from "@/components/loader";
import { syncNotifications } from "@/lib/notifications";
import { listenForegroundPush, listenPushOpens, registerPushToken } from "@/lib/push";
import { setAnalyticsUser, logScreen } from "@/lib/analytics";
import { installGlobalErrorHandler } from "@/lib/report-error";

// App start hote hi uncaught errors pakadna shuru.
installGlobalErrorHandler();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootNavigator />
            {/* Internet nahi/dheema — sabse upar patli patti. */}
            <NetworkBanner />
            {/* Net ki wajah se koi kaam ruka — beech screen me popup + retry. */}
            <NetAlertModal />
            {/* Reminder/expiry ka full-screen alert — kisi bhi screen ke upar. */}
            <ReminderAlertHost />
            {/* 1 hafte baad rating/review popup. */}
            <ReviewPrompt />
            {/* Ye phone kisi aur ke naam par set hai — login ke baad ek baar. */}
            <DeviceOwnerWarning />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { ready: langReady, chosen: langChosen } = useLocale();
  const segments = useSegments();
  const router = useRouter();
  // Pichhli baar session tha ya nahi — logout (tha→null) ko fresh launch se alag
  // karne ke liye. Logout ke baad language-select; fresh launch pe login.
  const prevSession = useRef(false);

  useEffect(() => {
    if (loading || !langReady) return;
    // `language` naya typed-route hai — string compare ke liye cast (codebase idiom).
    const first = segments[0] as string | undefined;
    const hasSession = !!session;

    // Pehli baar (bhasha choose nahi ki): sabse pehle language select.
    if (!langChosen) {
      if (first !== "language") router.replace("/language" as never);
      prevSession.current = hasSession;
      return;
    }

    const inAuthFlow = first === "login" || first === "auth";
    if (!hasSession && !inAuthFlow && first !== "language") {
      // Abhi-abhi logout hua (pehle session tha) -> language select.
      // App pehle se hai par logged out (fresh launch) -> login.
      router.replace(prevSession.current ? ("/language" as never) : "/login");
    } else if (hasSession && (first === "login" || first === "language")) {
      router.replace("/");
    }
    prevSession.current = hasSession;
  }, [session, loading, langReady, langChosen, segments, router]);

  // Reminders + document expiries OS me dobara schedule karo. Zaroori hai kyunki
  // scheduled notifications reinstall ke baad nahi bachti, aur doosre device pe
  // banaye gaye data ke liye kabhi bani hi nahi thi.
  const uid = session?.user?.id;
  useEffect(() => {
    // Login/user badla — yahan sach me sab kuch dobara lagana hai, throttle
    // nahi lagna chahiye.
    if (uid) void syncNotifications({ force: true });
    setAnalyticsUser(uid ?? null);
  }, [uid]);

  /**
   * Push (admin ke message ke liye) — login ke baad is phone ka pata server ko.
   *
   * Login ke saath bandha hai kyunki token user ke naam par save hota hai:
   * logout hone par listener band ho jaata hai, aur agla user login karega to
   * usi token ka maalik badal jaayega (`save_device_token`). Warna ek hi phone
   * par purane user ko naye user ki notification chali jaati.
   *
   * Firebase set na ho to dono function chup-chaap kuch nahi karte — local
   * reminders par koi asar nahi.
   */
  useEffect(() => {
    if (!uid) return;
    const stopToken = registerPushToken();
    const stopForeground = listenForegroundPush();
    // Tap ka hisaab — admin panel ki Report isi se banti hai ("kisne khola").
    // Login ke baad hi, kyunki server ki RPC bina session ke kuch nahi likhti.
    const stopOpens = listenPushOpens();
    return () => {
      stopToken();
      stopForeground();
      stopOpens();
    };
  }, [uid]);

  /**
   * App wapas saamne aate hi schedules dobara mila lo (item 17).
   *
   * ⚠️ Pehle sync SIRF login par chalta tha. Isliye ye sab chup-chaap toot jaata
   * tha: net na hone par bana reminder OS me kabhi schedule hi nahi hota; doosre
   * phone se banaya reminder is phone par kabhi nahi aata; permission baad me
   * di ho to usse pehle ke saare reminders bina alarm ke pade rehte the.
   *
   * Ye sirf local scheduling hai — net ki zaroorat nahi, isliye dheeme internet
   * par bhi notification theek waqt par bajti hai.
   */
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") void syncNotifications();
    });
    return () => sub.remove();
  }, [uid]);

  // Har screen change ek event — admin panel ka "journey" isi se banta hai.
  // Ek hi jagah rakha hai taaki nayi screen add karne par kuch yaad na rakhna pade.
  const pathname = usePathname();
  useEffect(() => {
    if (loading || !langReady) return;
    logScreen(pathname || "/");
  }, [pathname, loading, langReady]);

  if (loading || !langReady) {
    return <ScreenLoader />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="language" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="add-document" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-reminder" options={{ presentation: "modal" }} />
      <Stack.Screen name="support" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
