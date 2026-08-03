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
import { MultiDeviceWarning } from "@/components/multi-device-warning";
import { LockGate } from "@/components/lock-gate";
import { LockOffer } from "@/components/lock-offer";
import { NetworkBanner } from "@/components/network-banner";
import { NetAlertModal } from "@/components/net-alert-modal";
import { ScreenLoader } from "@/components/loader";
import { syncNotifications } from "@/lib/notifications";
import { flushOutbox } from "@/lib/reminder-outbox";
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
            {/*
              App lock — Providers ke andar (lock screen ko bhasha aur session
              chahiye) par app ke poore content ke upar.

              ⚠️ Ye saare overlay bhi ISKE ANDAR hone chahiye, bahar nahi. Ye
              sab `Modal` hain jo har screen ke upar khulte hain — lock ke upar
              bhi khul jaate the. Sabse bura `ReminderAlertHost` tha: lock lage
              hue phone par bhi reminder ka poora text dikh jaata, aur "Ho gaya"
              dabaya bhi ja sakta tha. Lock ka matlab hi yahi hai ki jab tak wo
              laga hai, app ka kuch bhi na dikhe aur kuch bhi na badla ja sake.
            */}
            <LockGate>
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
              {/* Uska ulta: meri ID aur bhi phones par login hai — sign-in ke baad. */}
              <MultiDeviceWarning />
              {/* "Saathi ko lock kar lo?" — login ke baad ek hi baar. */}
              <LockOffer />
            </LockGate>
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

  // `language` naya typed-route hai — string compare ke liye cast (codebase idiom).
  const first = segments[0] as string | undefined;
  const hasSession = !!session;
  const decided = !loading && langReady;

  /**
   * Abhi jis screen par hain, kya wo GALAT screen hai?
   *
   * ⚠️ Ye render ke waqt pata hona zaroori hai. Pehle sirf neeche wala effect
   * tha, aur effect render ke BAAD chalta hai — matlab ek poora frame `Stack`
   * apne default route `(tabs)` (dashboard) ke saath paint ho jaata tha, aur
   * uske baad language/login screen aati thi. User ko app kholte hi "pehle
   * dashboard, phir bhasha wala page" isi wajah se dikhta tha (aur dashboard
   * ka saara data fetch bekaar me chal kar cancel ho jaata tha).
   *
   * Ye sirf "route badalna hai ya nahi" batata hai — KAHAN jaana hai wo faisla
   * effect ka hi hai. Dono ki shartein bilkul ek jaisi rakhi hain, warna ek
   * kahega "badlo" aur doosra kuch karega hi nahi — loader hamesha ke liye
   * atak jaayega.
   */
  const needsRedirect =
    decided &&
    ((!langChosen && first !== "language") ||
      (langChosen &&
        !hasSession &&
        first !== "login" &&
        first !== "auth" &&
        first !== "language") ||
      (langChosen && hasSession && (first === "login" || first === "language")));

  useEffect(() => {
    if (loading || !langReady) return;

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
  }, [hasSession, loading, langReady, langChosen, first, router]);

  // Reminders + document expiries OS me dobara schedule karo. Zaroori hai kyunki
  // scheduled notifications reinstall ke baad nahi bachti, aur doosre device pe
  // banaye gaye data ke liye kabhi bani hi nahi thi.
  const uid = session?.user?.id;
  useEffect(() => {
    // Login/user badla — yahan sach me sab kuch dobara lagana hai, throttle
    // nahi lagna chahiye.
    //
    // Flush PEHLE: offline banaye reminders ke paas abhi `local:` wali id hai.
    // Unhe server par bhej ke asli id mil jaaye, uske baad hi sync chale —
    // warna sync unhe dekh hi nahi paata (server ki list me hain hi nahi) aur
    // do alag ids ke alarm saath-saath chalte rehte hain.
    if (uid) void flushOutbox().finally(() => void syncNotifications({ force: true }));
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
      if (s !== "active") return;
      // Net wapas aa chuka ho sakta hai — kataar me pade reminders ab server par
      // ja sakte hain. Fail ho to kuch nahi bigadta: wo kataar me hi rehte hain.
      void flushOutbox().finally(() => void syncNotifications());
    });
    return () => sub.remove();
  }, [uid]);

  // Har screen change ek event — admin panel ka "journey" isi se banta hai.
  // Ek hi jagah rakha hai taaki nayi screen add karne par kuch yaad na rakhna pade.
  const pathname = usePathname();
  useEffect(() => {
    // Redirect ke beech ka pathname asli screen nahi hai — use log karne se
    // analytics me har launch par ek jhootha "/" (dashboard) view chadh jaata tha.
    if (!decided || needsRedirect) return;
    logScreen(pathname || "/");
  }, [pathname, decided, needsRedirect]);

  // Jab tak faisla nahi hua — ya ho gaya par hum abhi galat screen par hain —
  // loader hi dikhao. `needsRedirect` ke bina yahan dashboard ek pal ke liye
  // paint ho jaata tha.
  if (!decided || needsRedirect) {
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
      <Stack.Screen name="notes" />
      <Stack.Screen name="app-lock" />
      {/* Note likhna ek "abhi ka" kaam hai — modal usse baaki app se alag rakhta
          hai aur band karna ek swipe me ho jaata hai. */}
      <Stack.Screen name="note-edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="support" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
