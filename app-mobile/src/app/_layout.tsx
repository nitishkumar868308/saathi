import { useEffect } from "react";
import { Stack } from "expo-router/js-stack";
import { useRouter, useSegments } from "expo-router";
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
import { setAnalyticsUser } from "@/lib/analytics";
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

  useEffect(() => {
    if (loading || !langReady) return;
    // `language` naya typed-route hai — string compare ke liye cast (codebase idiom).
    const first = segments[0] as string | undefined;
    // Pehli baar: bhasha choose karne se pehle kuch aur mat dikhao.
    if (!langChosen) {
      if (first !== "language") router.replace("/language" as never);
      return;
    }
    const inAuthFlow = first === "login" || first === "auth";
    if (!session && !inAuthFlow && first !== "language") router.replace("/login");
    else if (session && (first === "login" || first === "language")) router.replace("/");
  }, [session, loading, langReady, langChosen, segments, router]);

  // Reminders + document expiries OS me dobara schedule karo. Zaroori hai kyunki
  // scheduled notifications reinstall ke baad nahi bachti, aur doosre device pe
  // banaye gaye data ke liye kabhi bani hi nahi thi.
  const uid = session?.user?.id;
  useEffect(() => {
    if (uid) void syncNotifications();
    setAnalyticsUser(uid ?? null);
  }, [uid]);

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
