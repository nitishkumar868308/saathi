import { useEffect, useRef } from "react";
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
import { NetworkBanner } from "@/components/network-banner";
import { ScreenLoader } from "@/components/loader";
import { syncNotifications } from "@/lib/notifications";
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
            {/* Reminder/expiry ka full-screen alert — kisi bhi screen ke upar. */}
            <ReminderAlertHost />
            {/* 1 hafte baad rating/review popup. */}
            <ReviewPrompt />
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
    if (uid) void syncNotifications();
    setAnalyticsUser(uid ?? null);
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
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
